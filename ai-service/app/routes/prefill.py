"""Pre-fill agent endpoints: client list, CRM prefill, document prefill, and SSE stream."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.datasources.redtail_crm import RedtailCRM
from app.services.prefill_agent import run_prefill_agent, run_prefill_agent_stream

logger = logging.getLogger(__name__)
router = APIRouter(tags=["prefill"])


# ── Request / Response models ───────────────────────────────────────────────

class PrefillRequest(BaseModel):
    client_id: str
    advisor_id: str | None = None


class PrefillResponse(BaseModel):
    known_data: dict[str, Any]
    sources_used: list[str]
    fields_found: int
    summary: str


class ClientInfo(BaseModel):
    client_id: str
    display_name: str


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/prefill/clients", response_model=list[ClientInfo])
async def list_clients():
    """Return list of CRM clients for the dropdown selector."""
    return await RedtailCRM.list_clients()


@router.post("/prefill", response_model=PrefillResponse)
async def run_prefill(req: PrefillRequest):
    """Run the pre-fill agent for a selected CRM client."""
    advisor_id = req.advisor_id or "advisor_002"
    logger.info("Prefill requested for client_id=%s, advisor_id=%s", req.client_id, advisor_id)
    result = await run_prefill_agent(client_id=req.client_id, advisor_id=advisor_id)
    return PrefillResponse(**result)


@router.post("/prefill/stream")
async def run_prefill_stream(req: PrefillRequest):
    """Run the pre-fill agent with real-time SSE streaming of tool calls."""
    advisor_id = req.advisor_id or "advisor_002"
    logger.info("Prefill stream requested for client_id=%s, advisor_id=%s", req.client_id, advisor_id)

    async def event_generator():
        async for event in run_prefill_agent_stream(
            client_id=req.client_id,
            advisor_id=advisor_id,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/prefill/document", response_model=PrefillResponse)
async def run_prefill_with_document(
    file: UploadFile = File(...),
    client_id: str | None = Form(default=None),
):
    """Run the pre-fill agent with an uploaded document (and optional client_id)."""
    logger.info("Prefill with document requested: filename=%s, client_id=%s", file.filename, client_id)

    file_bytes = await file.read()
    doc_base64 = base64.b64encode(file_bytes).decode("utf-8")

    # Determine media type from upload
    media_type = file.content_type or "image/png"

    result = await run_prefill_agent(
        client_id=client_id,
        document_base64=doc_base64,
        document_media_type=media_type,
    )
    return PrefillResponse(**result)
