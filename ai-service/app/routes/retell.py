"""Retell AI phone call endpoints: initiate calls, poll status, receive webhooks."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.retell_service import retell_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["retell"])

# In-memory store for webhook results (keyed by call_id)
_call_results: dict[str, dict[str, Any]] = {}


def _parse_analysis_fields(analysis: dict) -> dict[str, str]:
    """Extract fields from Retell post-call analysis.

    The `collected_fields` value is a JSON string (Retell only supports string
    type for custom analysis data), so we need to parse it.
    """
    import json as _json

    raw = analysis.get("custom_analysis_data") or {}
    collected = raw.get("collected_fields", "")
    if isinstance(collected, str) and collected.strip():
        try:
            parsed = _json.loads(collected)
            if isinstance(parsed, dict):
                return {str(k): str(v) for k, v in parsed.items()}
        except (_json.JSONDecodeError, ValueError):
            logger.warning("Failed to parse collected_fields JSON: %s", collected[:200])
    elif isinstance(raw, dict) and not collected:
        # Fallback: maybe the whole custom_analysis_data is the dict
        return {str(k): str(v) for k, v in raw.items() if k != "collected_fields"}
    return {}


# ── Request / Response models ───────────────────────────────────────────────

class InitiateCallRequest(BaseModel):
    to_number: str
    missing_fields: list[dict[str, str]]
    client_name: str
    advisor_name: str


class InitiateCallResponse(BaseModel):
    call_id: str
    status: str


class CallStatusResponse(BaseModel):
    status: str
    transcript: str | None = None
    live_transcript: list[dict[str, str]] | None = None
    extracted_fields: dict[str, str] | None = None
    duration_seconds: float | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/retell/calls", response_model=InitiateCallResponse)
async def initiate_call(req: InitiateCallRequest):
    """Initiate an outbound Retell call to the client."""
    logger.info("Initiating Retell call to %s for client %s", req.to_number, req.client_name)
    result = await retell_service.create_outbound_call(
        to_number=req.to_number,
        missing_fields=req.missing_fields,
        client_name=req.client_name,
        advisor_name=req.advisor_name,
    )
    call_id = result.get("call_id", "")
    # Initialize in-memory record for live transcript tracking
    _call_results[call_id] = {"live_transcript": [], "status": "registered"}
    return InitiateCallResponse(
        call_id=call_id,
        status=result.get("call_status", "registered"),
    )


@router.get("/retell/calls/{call_id}", response_model=CallStatusResponse)
async def get_call_status(call_id: str):
    """Poll call status. Checks webhook cache first, falls back to Retell API."""
    cached = _call_results.get(call_id, {})

    # If we have a completed result from webhook, return it
    if cached.get("status") in ("ended", "error"):
        return CallStatusResponse(
            status=cached["status"],
            transcript=cached.get("transcript"),
            live_transcript=cached.get("live_transcript"),
            extracted_fields=cached.get("extracted_fields"),
            duration_seconds=cached.get("duration_seconds"),
        )

    # Otherwise poll Retell API
    try:
        call_data = await retell_service.get_call(call_id)
    except Exception as exc:
        logger.warning("Failed to poll Retell call %s: %s", call_id, exc)
        return CallStatusResponse(status=cached.get("status", "unknown"))

    status = call_data.get("call_status", "unknown")

    # Extract transcript and fields from completed calls
    transcript = None
    extracted_fields = None
    duration_seconds = None

    if status == "ended":
        # Build transcript from the call transcript array
        transcript_entries = call_data.get("transcript_object", [])
        if transcript_entries:
            transcript = "\n".join(
                f"{e.get('role', 'unknown')}: {e.get('content', '')}"
                for e in transcript_entries
            )

        # Extract fields from call analysis
        analysis = call_data.get("call_analysis", {})
        extracted_fields = _parse_analysis_fields(analysis)

        # Duration
        start_ts = call_data.get("start_timestamp")
        end_ts = call_data.get("end_timestamp")
        if start_ts and end_ts:
            duration_seconds = (end_ts - start_ts) / 1000.0

        # Cache the final result
        _call_results[call_id] = {
            "status": "ended",
            "transcript": transcript,
            "extracted_fields": extracted_fields,
            "duration_seconds": duration_seconds,
            "live_transcript": cached.get("live_transcript", []),
        }

    return CallStatusResponse(
        status=status,
        transcript=transcript,
        live_transcript=cached.get("live_transcript"),
        extracted_fields=extracted_fields,
        duration_seconds=duration_seconds,
    )


@router.post("/retell/webhook")
async def retell_webhook(request: Request):
    """Handle Retell webhook events (call_ended, transcript_updated, etc.)."""
    body = await request.json()
    event = body.get("event", "")
    call = body.get("call", {})
    call_id = call.get("call_id", "")

    logger.info("Retell webhook: event=%s, call_id=%s", event, call_id)

    if not call_id:
        return {"ok": True}

    if call_id not in _call_results:
        _call_results[call_id] = {"live_transcript": [], "status": "unknown"}

    if event == "call_started":
        _call_results[call_id]["status"] = "in-progress"

    elif event == "call_ended":
        # Extract final transcript
        transcript_entries = call.get("transcript_object", [])
        transcript = "\n".join(
            f"{e.get('role', 'unknown')}: {e.get('content', '')}"
            for e in transcript_entries
        ) if transcript_entries else None

        # Extract fields from call analysis (parse collected_fields JSON)
        analysis = call.get("call_analysis", {})
        extracted_fields = _parse_analysis_fields(analysis)

        # Duration
        start_ts = call.get("start_timestamp")
        end_ts = call.get("end_timestamp")
        duration_seconds = (end_ts - start_ts) / 1000.0 if start_ts and end_ts else None

        _call_results[call_id].update({
            "status": "ended",
            "transcript": transcript,
            "extracted_fields": extracted_fields,
            "duration_seconds": duration_seconds,
        })
        logger.info("Call %s ended: %d extracted fields", call_id, len(extracted_fields))

    elif event == "call_analyzed":
        analysis = call.get("call_analysis", {})
        extracted_fields = _parse_analysis_fields(analysis)
        if extracted_fields:
            _call_results[call_id]["extracted_fields"] = extracted_fields
            logger.info("Call %s analyzed: %d extracted fields", call_id, len(extracted_fields))

    return {"ok": True}
