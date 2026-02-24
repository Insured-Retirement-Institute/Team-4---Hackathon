"""Session CRUD and submit endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.api_contracts import (
    CreateSessionRequest,
    FieldResponse,
    FieldSummaryResponse,
    SessionResponse,
    SubmitResponse,
)
from app.services.conversation_service import (
    create_session,
    get_session,
    submit_session,
)

router = APIRouter(tags=["sessions"])


def _field_summary(state) -> FieldSummaryResponse:
    s = state.field_summary()
    return FieldSummaryResponse(
        missing=s.get("missing", 0),
        unconfirmed=s.get("unconfirmed", 0),
        confirmed=s.get("confirmed", 0),
        collected=s.get("collected", 0),
    )


def _field_list(state) -> list[FieldResponse]:
    return [
        FieldResponse(
            field_id=f.field_id,
            label=f.label,
            status=f.status.value,
            value=f.value,
        )
        for f in state.active_fields()
    ]


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session_endpoint(req: CreateSessionRequest):
    try:
        state, greeting = create_session(
            questions=[q.model_dump() for q in req.questions],
            known_data=req.known_data,
            callback_url=req.callback_url,
            model=req.model,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return SessionResponse(
        session_id=state.session_id,
        phase=state.phase.value,
        greeting=greeting,
        field_summary=_field_summary(state),
        fields=_field_list(state),
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session_endpoint(session_id: str):
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        session_id=state.session_id,
        phase=state.phase.value,
        field_summary=_field_summary(state),
        fields=_field_list(state),
    )


@router.post("/sessions/{session_id}/submit", response_model=SubmitResponse)
async def submit_session_endpoint(session_id: str):
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = await submit_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return SubmitResponse(
        status=result.get("status", "unknown"),
        field_count=result.get("field_count", 0),
        submitted_at=result.get("submitted_at"),
        errors=result.get("errors", []),
    )
