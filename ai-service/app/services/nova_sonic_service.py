"""Nova Sonic bidirectional stream manager for real-time voice conversations."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from typing import Any, AsyncGenerator

from app.config import settings
from app.models.conversation import ConversationState
from app.prompts.system_prompt import build_voice_system_prompt
from app.services.conversation_service import (
    ADVISOR_TOOL_NAMES,
    TOOL_SOURCE_LABELS,
    maybe_advance_phase,
    process_tool_calls,
)
from app.services.extraction_service import build_tools_for_phase
from app.services.prefill_agent import _execute_tool as execute_prefill_tool
from app.services.retell_service import retell_service
from app.services.tool_adapter import anthropic_to_nova_sonic

logger = logging.getLogger(__name__)


class NovaSonicStreamManager:
    """Manages one bidirectional Nova Sonic stream for a voice WebSocket connection."""

    def __init__(self, state: ConversationState):
        self.state = state
        self.model_id = settings.nova_sonic_model
        self.voice_id = settings.nova_sonic_voice
        self.prompt_name = f"voice-{state.session_id[:8]}"
        self.content_name = f"content-{uuid.uuid4().hex[:8]}"
        self._client = None
        self._stream = None
        self._closed = False

    async def start_session(self) -> None:
        """Initialize the Bedrock client and open the bidirectional stream."""
        logger.info("[Voice] Starting Nova Sonic session for %s (model=%s, voice=%s, advisor=%s)",
                     self.state.session_id, self.model_id, self.voice_id, self.state.advisor_name)
        # Set AWS env vars for the SDK's EnvironmentCredentialsResolver.
        # Only set if non-empty — in App Runner the instance role provides creds,
        # and setting empty values would override role-based resolution.
        if settings.aws_access_key_id:
            os.environ["AWS_ACCESS_KEY_ID"] = settings.aws_access_key_id
        if settings.aws_secret_access_key:
            os.environ["AWS_SECRET_ACCESS_KEY"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            os.environ["AWS_SESSION_TOKEN"] = settings.aws_session_token
        os.environ["AWS_REGION"] = settings.aws_region
        os.environ["AWS_DEFAULT_REGION"] = settings.aws_region

        from aws_sdk_bedrock_runtime import BedrockRuntimeClient, InvokeModelWithBidirectionalStreamOperationInput

        self._client = BedrockRuntimeClient(region=settings.aws_region)
        self._stream = await self._client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(model_id=self.model_id)
        )

        # Send session setup sequence
        logger.info("[Voice] Bedrock stream opened, sending setup sequence...")
        await self._send_session_start()
        await self._send_prompt_start()
        await self._send_system_prompt()
        logger.info("[Voice] Session setup complete (sessionStart + promptStart + systemPrompt sent)")

    async def _send_session_start(self) -> None:
        """Send sessionStart event with inference config."""
        event = {
            "event": {
                "sessionStart": {
                    "inferenceConfiguration": {
                        "maxTokens": 1024,
                        "temperature": 0.7,
                        "topP": 0.9,
                    }
                }
            }
        }
        await self._send_event(event)

    async def _send_prompt_start(self) -> None:
        """Send promptStart event with audio/text output config and tool config."""
        # Build tools from current phase
        anthropic_tools = build_tools_for_phase(self.state)
        tool_names = [t.get("name", "?") for t in anthropic_tools] if anthropic_tools else []
        logger.info("[Voice] Tools available (%d): %s", len(tool_names), tool_names)
        nova_tools = anthropic_to_nova_sonic(anthropic_tools)

        tool_config = {}
        if nova_tools:
            tool_config = {
                "tools": nova_tools,
                "toolChoice": {"auto": {}},
            }

        event = {
            "event": {
                "promptStart": {
                    "promptName": self.prompt_name,
                    "textOutputConfiguration": {
                        "mediaType": "text/plain",
                    },
                    "audioOutputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 24000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "voiceId": self.voice_id,
                    },
                    **({"toolConfiguration": tool_config} if tool_config else {}),
                }
            }
        }
        await self._send_event(event)

    async def _send_system_prompt(self) -> None:
        """Send the system prompt as a text content block."""
        system_prompt = build_voice_system_prompt(self.state)

        # contentStart for system prompt
        await self._send_event({
            "event": {
                "contentStart": {
                    "promptName": self.prompt_name,
                    "contentName": self.content_name,
                    "type": "TEXT",
                    "role": "SYSTEM",
                    "textInputConfiguration": {
                        "mediaType": "text/plain",
                    },
                }
            }
        })

        # textInput with the actual prompt
        await self._send_event({
            "event": {
                "textInput": {
                    "promptName": self.prompt_name,
                    "contentName": self.content_name,
                    "content": system_prompt,
                }
            }
        })

        # contentEnd
        await self._send_event({
            "event": {
                "contentEnd": {
                    "promptName": self.prompt_name,
                    "contentName": self.content_name,
                }
            }
        })

    async def send_initial_greeting(self) -> None:
        """Send an initial text prompt to trigger Nova Sonic to speak a greeting."""
        logger.info("[Voice] Sending initial greeting prompt to trigger Nova Sonic speech")
        content_name = f"greeting-{uuid.uuid4().hex[:8]}"
        await self._send_event({"event": {"contentStart": {
            "promptName": self.prompt_name,
            "contentName": content_name,
            "type": "TEXT", "role": "USER",
            "textInputConfiguration": {"mediaType": "text/plain"},
        }}})
        await self._send_event({"event": {"textInput": {
            "promptName": self.prompt_name,
            "contentName": content_name,
            "content": "Hello, I just connected. Please greet me and ask what I'd like to work on.",
        }}})
        await self._send_event({"event": {"contentEnd": {
            "promptName": self.prompt_name, "contentName": content_name,
        }}})

    async def send_audio(self, base64_chunk: str) -> None:
        """Forward a base64-encoded audio chunk to Nova Sonic."""
        if self._closed:
            return

        audio_content_name = f"audio-{uuid.uuid4().hex[:8]}"

        # contentStart for audio input
        await self._send_event({
            "event": {
                "contentStart": {
                    "promptName": self.prompt_name,
                    "contentName": audio_content_name,
                    "type": "AUDIO",
                    "role": "USER",
                    "audioInputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 16000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                    },
                }
            }
        })

        # audioInput
        await self._send_event({
            "event": {
                "audioInput": {
                    "promptName": self.prompt_name,
                    "contentName": audio_content_name,
                    "content": base64_chunk,
                }
            }
        })

        # contentEnd
        await self._send_event({
            "event": {
                "contentEnd": {
                    "promptName": self.prompt_name,
                    "contentName": audio_content_name,
                }
            }
        })

    async def process_responses(self) -> AsyncGenerator[dict[str, Any], None]:
        """Read response events from Nova Sonic and yield WebSocket messages.

        Yields dicts with "type" key: audio, transcript, field_update, phase_change, error.
        """
        if not self._stream:
            return

        try:
            async for event in self._stream.output_stream:
                parsed = self._parse_event(event)
                if parsed is None:
                    continue

                event_type = parsed.get("type")
                if event_type not in ("audioOutput",):  # Don't log every audio chunk
                    logger.info("[Voice] Nova Sonic event: %s", event_type)

                if event_type == "audioOutput":
                    yield {
                        "type": "audio",
                        "data": parsed["content"],
                    }

                elif event_type == "textOutput":
                    yield {
                        "type": "transcript",
                        "role": "assistant",
                        "text": parsed["content"],
                    }

                elif event_type == "textInput":
                    # User transcript from speech recognition
                    yield {
                        "type": "transcript",
                        "role": "user",
                        "text": parsed.get("content", ""),
                    }

                elif event_type == "toolUse":
                    # Process tool call through shared logic
                    tool_results = await self._handle_tool_use(parsed)
                    for msg in tool_results:
                        yield msg

                elif event_type == "error":
                    yield {
                        "type": "error",
                        "message": parsed.get("message", "Unknown stream error"),
                    }

        except Exception as e:
            logger.exception("Error processing Nova Sonic responses")
            yield {
                "type": "error",
                "message": str(e),
            }

    async def _handle_tool_use(self, parsed: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle a toolUse event: run tool, send result back, return WS messages."""
        messages: list[dict[str, Any]] = []

        tool_name = parsed.get("toolName", "")
        tool_use_id = parsed.get("toolUseId", str(uuid.uuid4()))
        tool_input = parsed.get("content", {})

        logger.info("[Voice] toolUse received: name=%s, id=%s, input_type=%s",
                     tool_name, tool_use_id, type(tool_input).__name__)

        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except json.JSONDecodeError:
                tool_input = {}

        logger.info("[Voice] Tool input (parsed): %s", json.dumps(tool_input, default=str)[:500])

        if tool_name in ADVISOR_TOOL_NAMES:
            # Execute advisor tools (CRM, documents, suitability, calls)
            logger.info("[Voice] >>> ADVISOR TOOL: %s — routing to execute_prefill_tool", tool_name)
            try:
                if tool_name == "call_client":
                    missing = [{"id": f, "label": f} for f in tool_input.get("missing_fields", [])]
                    call_result = await retell_service.create_outbound_call(
                        to_number=tool_input.get("phone_number", ""),
                        missing_fields=missing,
                        client_name=tool_input.get("client_name", ""),
                        advisor_name=self.state.advisor_name or "",
                    )
                    result_str = json.dumps({
                        "status": "call_initiated",
                        "call_id": call_result.get("call_id", ""),
                        "message": f"Call initiated to {tool_input.get('client_name', 'client')}.",
                    })
                else:
                    raw = await execute_prefill_tool(tool_name, tool_input)
                    result_str = raw if isinstance(raw, str) else json.dumps(raw)

                logger.info("[Voice] Tool %s executed, result length=%d chars",
                             tool_name, len(result_str) if isinstance(result_str, str) else 0)
                logger.debug("[Voice] Tool %s raw result: %s", tool_name, result_str[:1000] if isinstance(result_str, str) else str(result_str)[:1000])

                # Parse result for frontend field mapping
                source_label = TOOL_SOURCE_LABELS.get(tool_name)
                try:
                    result_data = json.loads(result_str) if isinstance(result_str, str) else result_str
                    if isinstance(result_data, dict) and "error" not in result_data:
                        field_count = len(result_data)
                        logger.info("[Voice] Emitting tool_call_info: name=%s, source=%s, fields=%d, keys=%s",
                                     tool_name, source_label, field_count,
                                     list(result_data.keys())[:15])
                        messages.append({
                            "type": "tool_call_info",
                            "name": tool_name,
                            "result_data": result_data,
                            "source_label": source_label,
                        })
                    else:
                        logger.warning("[Voice] Tool %s result has error or is not dict: %s",
                                        tool_name, str(result_data)[:200])
                except (json.JSONDecodeError, TypeError) as exc:
                    logger.warning("[Voice] Failed to parse tool %s result as JSON: %s", tool_name, exc)

            except Exception as e:
                logger.exception("Advisor tool %s failed in voice", tool_name)
                result_str = json.dumps({"error": str(e)})

            logger.info("[Voice] Sent tool result back to Nova Sonic for %s", tool_name)
            await self._send_tool_result(tool_use_id, result_str)
        else:
            # Field extraction/confirmation tools — use existing shared logic
            logger.info("[Voice] >>> FIELD TOOL: %s — routing to process_tool_calls", tool_name)
            normalized = {
                "id": tool_use_id,
                "name": tool_name,
                "input": tool_input,
            }
            results = process_tool_calls([normalized], self.state)
            updated_fields = results.get("updated_fields", [])

            if updated_fields:
                messages.append({
                    "type": "field_update",
                    "fields": updated_fields,
                })

            tool_result_str = json.dumps(results.get(tool_use_id, "OK"))
            await self._send_tool_result(tool_use_id, tool_result_str)

        # Check phase transitions
        old_phase = self.state.phase
        maybe_advance_phase(self.state)
        if self.state.phase != old_phase:
            messages.append({
                "type": "phase_change",
                "phase": self.state.phase.value,
            })

        return messages

    async def _send_tool_result(self, tool_use_id: str, result: str) -> None:
        """Send a toolResult event back to Nova Sonic."""
        result_content_name = f"toolresult-{uuid.uuid4().hex[:8]}"

        await self._send_event({
            "event": {
                "contentStart": {
                    "promptName": self.prompt_name,
                    "contentName": result_content_name,
                    "type": "TOOL_RESULT",
                    "role": "TOOL",
                    "toolResultInputConfiguration": {
                        "toolUseId": tool_use_id,
                        "status": "success",
                    },
                }
            }
        })

        await self._send_event({
            "event": {
                "textInput": {
                    "promptName": self.prompt_name,
                    "contentName": result_content_name,
                    "content": result,
                }
            }
        })

        await self._send_event({
            "event": {
                "contentEnd": {
                    "promptName": self.prompt_name,
                    "contentName": result_content_name,
                }
            }
        })

    def _parse_event(self, event: Any) -> dict[str, Any] | None:
        """Parse a Nova Sonic output event into a normalized dict."""
        # The SDK delivers events as typed objects; extract the relevant data
        try:
            logger.debug("[Voice] Raw event type: %s, attrs: %s",
                          type(event).__name__,
                          [a for a in dir(event) if not a.startswith("_")][:10])
            # Try to access as dict-like or attribute-based depending on SDK version
            if hasattr(event, "to_dict"):
                data = event.to_dict()
            elif isinstance(event, dict):
                data = event
            else:
                # Try common attribute patterns
                data = {}
                for attr in ("audio_output", "text_output", "tool_use", "content_start",
                             "content_end", "error"):
                    val = getattr(event, attr, None)
                    if val is not None:
                        data[attr] = val if isinstance(val, dict) else (
                            val.to_dict() if hasattr(val, "to_dict") else str(val)
                        )

            # Normalize to our internal format
            if "audioOutput" in data or "audio_output" in data:
                audio = data.get("audioOutput") or data.get("audio_output", {})
                content = audio.get("content", "") if isinstance(audio, dict) else ""
                return {"type": "audioOutput", "content": content}

            if "textOutput" in data or "text_output" in data:
                text = data.get("textOutput") or data.get("text_output", {})
                content = text.get("content", "") if isinstance(text, dict) else ""
                return {"type": "textOutput", "content": content}

            if "toolUse" in data or "tool_use" in data:
                tool = data.get("toolUse") or data.get("tool_use", {})
                if isinstance(tool, dict):
                    return {
                        "type": "toolUse",
                        "toolName": tool.get("toolName") or tool.get("tool_name", ""),
                        "toolUseId": tool.get("toolUseId") or tool.get("tool_use_id", ""),
                        "content": tool.get("content", {}),
                    }

            if "error" in data:
                err = data["error"]
                msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                return {"type": "error", "message": msg}

            return None

        except Exception as e:
            logger.debug("Could not parse Nova Sonic event: %s", e)
            return None

    async def _send_event(self, event: dict[str, Any]) -> None:
        """Send an event dict to the Nova Sonic stream."""
        if self._closed or not self._stream:
            return
        try:
            await self._stream.input_stream.send(event)
        except Exception as e:
            logger.error("Failed to send event to Nova Sonic: %s", e)
            raise

    async def close(self) -> None:
        """Gracefully close the Nova Sonic stream."""
        if self._closed:
            return
        self._closed = True

        try:
            # Send closing sequence
            await self._send_event({
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                    }
                }
            })
            await self._send_event({
                "event": {
                    "promptEnd": {
                        "promptName": self.prompt_name,
                    }
                }
            })
            await self._send_event({
                "event": {
                    "sessionEnd": {}
                }
            })
        except Exception:
            logger.debug("Error sending close sequence", exc_info=True)

        try:
            if self._stream and hasattr(self._stream, "input_stream"):
                await self._stream.input_stream.close()
        except Exception:
            logger.debug("Error closing stream", exc_info=True)
