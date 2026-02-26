"""WebSocket endpoint for real-time voice conversations via Nova Sonic."""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.conversation_service import get_session
from app.services.nova_sonic_service import NovaSonicStreamManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])


@router.websocket("/sessions/{session_id}/voice")
async def voice_websocket(websocket: WebSocket, session_id: str):
    """Bidirectional voice WebSocket.

    Client → Server messages:
        {"type": "audio", "data": "<base64 PCM 16kHz 16-bit mono>"}
        {"type": "end_session"}

    Server → Client messages:
        {"type": "audio", "data": "<base64 PCM 24kHz 16-bit mono>"}
        {"type": "transcript", "role": "assistant"|"user", "text": "..."}
        {"type": "field_update", "fields": [...]}
        {"type": "phase_change", "phase": "collecting"}
        {"type": "tool_call_info", "name": "lookup_crm_client", "result_data": {...}, "source_label": "Redtail CRM"}
        {"type": "error", "message": "..."}
        {"type": "session_ended"}
    """
    logger.info("[VoiceWS] Connection request for session %s", session_id)
    state = get_session(session_id)
    if not state:
        logger.warning("[VoiceWS] Session %s not found, closing", session_id)
        await websocket.close(code=4004, reason="Session not found")
        return

    logger.info("[VoiceWS] Session found: phase=%s, advisor=%s, fields=%d",
                 state.phase.value, state.advisor_name, len(state.fields))
    await websocket.accept()

    manager = NovaSonicStreamManager(state)

    try:
        await manager.start_session()
        logger.info("[VoiceWS] Nova Sonic session started, sending greeting...")
        await manager.send_initial_greeting()
        logger.info("[VoiceWS] Greeting sent, starting bidirectional relay")
    except Exception as e:
        logger.exception("Failed to start Nova Sonic session")
        await _send_json(websocket, {"type": "error", "message": f"Failed to start voice session: {e}"})
        await websocket.close()
        return

    # Run two concurrent tasks: ws→nova and nova→ws
    ws_to_nova_task = asyncio.create_task(_ws_to_nova(websocket, manager))
    nova_to_ws_task = asyncio.create_task(_nova_to_ws(websocket, manager))

    try:
        done, pending = await asyncio.wait(
            [ws_to_nova_task, nova_to_ws_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        # Cancel whichever is still running
        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
    except Exception:
        logger.exception("Voice WebSocket error")
    finally:
        await manager.close()
        try:
            await _send_json(websocket, {"type": "session_ended"})
            await websocket.close()
        except Exception:
            pass


async def _ws_to_nova(websocket: WebSocket, manager: NovaSonicStreamManager) -> None:
    """Read from WebSocket, forward audio to Nova Sonic."""
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "audio":
                data = msg.get("data", "")
                if data:
                    await manager.send_audio(data)

            elif msg_type == "end_session":
                return

    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected (session %s)", manager.state.session_id)
    except Exception as e:
        logger.exception("Error in ws_to_nova")


async def _nova_to_ws(websocket: WebSocket, manager: NovaSonicStreamManager) -> None:
    """Read from Nova Sonic, forward audio/transcript/field_updates to WebSocket."""
    msg_count = 0
    try:
        async for msg in manager.process_responses():
            msg_count += 1
            msg_type = msg.get("type", "?")
            # Log non-audio messages in detail, audio just as count
            if msg_type == "audio":
                if msg_count % 50 == 1:
                    logger.debug("[VoiceWS] Audio chunks sent so far: %d", msg_count)
            elif msg_type == "transcript":
                logger.info("[VoiceWS] >>> Transcript (%s): %s", msg.get("role"), msg.get("text", "")[:200])
            elif msg_type == "tool_call_info":
                logger.info("[VoiceWS] >>> tool_call_info: name=%s, source=%s, fields=%d",
                             msg.get("name"), msg.get("source_label"),
                             len(msg.get("result_data", {})))
            elif msg_type == "field_update":
                logger.info("[VoiceWS] >>> field_update: %d fields", len(msg.get("fields", [])))
            elif msg_type == "phase_change":
                logger.info("[VoiceWS] >>> phase_change: %s", msg.get("phase"))
            else:
                logger.info("[VoiceWS] >>> %s: %s", msg_type, json.dumps(msg, default=str)[:200])
            await _send_json(websocket, msg)
    except Exception as e:
        logger.exception("Error in nova_to_ws")
        await _send_json(websocket, {"type": "error", "message": str(e)})
    logger.info("[VoiceWS] nova_to_ws ended, total messages forwarded: %d", msg_count)


async def _send_json(websocket: WebSocket, data: dict) -> None:
    """Send a JSON message to the WebSocket, swallowing errors."""
    try:
        await websocket.send_text(json.dumps(data))
    except Exception:
        pass
