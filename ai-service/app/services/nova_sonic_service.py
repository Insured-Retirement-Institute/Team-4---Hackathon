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
from app.services.conversation_service import maybe_advance_phase, process_tool_calls
from app.services.extraction_service import build_tools_for_phase
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
        await self._send_session_start()
        await self._send_prompt_start()
        await self._send_system_prompt()

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

        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except json.JSONDecodeError:
                tool_input = {}

        # Normalize to the format process_tool_calls expects
        normalized = {
            "id": tool_use_id,
            "name": tool_name,
            "input": tool_input,
        }

        # Use shared tool processing logic
        results = process_tool_calls([normalized], self.state)
        updated_fields = results.get("updated_fields", [])

        if updated_fields:
            messages.append({
                "type": "field_update",
                "fields": updated_fields,
            })

        # Check phase transitions
        old_phase = self.state.phase
        maybe_advance_phase(self.state)
        if self.state.phase != old_phase:
            messages.append({
                "type": "phase_change",
                "phase": self.state.phase.value,
            })

        # Send tool result back to Nova Sonic
        tool_result_str = json.dumps(results.get(tool_use_id, "OK"))
        await self._send_tool_result(tool_use_id, tool_result_str)

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
