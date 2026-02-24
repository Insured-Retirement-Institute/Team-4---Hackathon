"""Chat message endpoint."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models.api_contracts import (
    FieldResponse,
    FieldSummaryResponse,
    MessageResponse,
    SendMessageRequest,
)
from app.services.conversation_service import get_session, handle_message

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


@router.post("/sessions/{session_id}/message", response_model=MessageResponse)
async def send_message(session_id: str, req: SendMessageRequest):
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        reply, updated_fields = await handle_message(session_id, req.message)
    except Exception as e:
        logger.exception("Error handling message")
        raise HTTPException(status_code=500, detail=str(e))

    # Refresh state after handling
    state = get_session(session_id)
    summary = state.field_summary()

    return MessageResponse(
        reply=reply,
        phase=state.phase.value,
        updated_fields=[
            FieldResponse(
                field_id=uf["field_id"],
                label="",
                status=uf.get("status", ""),
                value=uf.get("value"),
            )
            for uf in updated_fields
        ],
        field_summary=FieldSummaryResponse(
            missing=summary.get("missing", 0),
            unconfirmed=summary.get("unconfirmed", 0),
            confirmed=summary.get("confirmed", 0),
            collected=summary.get("collected", 0),
        ),
        complete=state.phase in ("complete", "submitted"),
    )
