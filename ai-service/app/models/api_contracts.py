"""Request/response schemas for the decoupled AI service API."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# --- Requests ---

class FieldDefinition(BaseModel):
    field_id: str
    type: str = "text"
    label: str = ""
    required: bool = False
    validation: dict[str, Any] = Field(default_factory=dict)
    options: list[dict[str, Any]] | None = None
    conditions: list[dict[str, Any]] | None = None


class StepDefinition(BaseModel):
    step_id: str
    title: str = ""
    fields: list[FieldDefinition] = Field(default_factory=list)


class CreateSessionRequest(BaseModel):
    questions: list[StepDefinition]
    known_data: dict[str, Any] = Field(default_factory=dict)
    callback_url: str | None = None
    model: str | None = None
    advisor_name: str | None = None


class SendMessageRequest(BaseModel):
    message: str


# --- Responses ---

class FieldResponse(BaseModel):
    field_id: str
    label: str = ""
    status: str
    value: Any = None


class FieldSummaryResponse(BaseModel):
    missing: int = 0
    unconfirmed: int = 0
    confirmed: int = 0
    collected: int = 0


class SessionResponse(BaseModel):
    session_id: str
    phase: str
    greeting: str | None = None
    field_summary: FieldSummaryResponse
    fields: list[FieldResponse] = Field(default_factory=list)


class MessageResponse(BaseModel):
    reply: str
    phase: str
    updated_fields: list[FieldResponse] = Field(default_factory=list)
    field_summary: FieldSummaryResponse
    complete: bool = False


class SubmitResponse(BaseModel):
    status: str
    field_count: int = 0
    submitted_at: datetime | None = None
    errors: list[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
