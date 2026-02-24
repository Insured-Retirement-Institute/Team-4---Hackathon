"""Conversation state models with field tracking and session phases."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class FieldStatus(str, Enum):
    MISSING = "missing"
    UNCONFIRMED = "unconfirmed"
    CONFIRMED = "confirmed"
    COLLECTED = "collected"


class SessionPhase(str, Enum):
    SPOT_CHECK = "spot_check"
    COLLECTING = "collecting"
    REVIEWING = "reviewing"
    COMPLETE = "complete"
    SUBMITTED = "submitted"


class TrackedField(BaseModel):
    field_id: str
    value: Any = None
    status: FieldStatus = FieldStatus.MISSING
    label: str = ""
    field_type: str = "text"
    required: bool = False
    validation: dict[str, Any] = Field(default_factory=dict)
    options: list[dict[str, Any]] | None = None
    conditions: list[dict[str, Any]] | None = None
    validation_error: str | None = None


class Message(BaseModel):
    role: Role
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extracted_fields: dict[str, Any] | None = None


class ConversationState(BaseModel):
    session_id: str
    phase: SessionPhase = SessionPhase.SPOT_CHECK
    fields: dict[str, TrackedField] = Field(default_factory=dict)
    steps: list[dict[str, Any]] = Field(default_factory=list)
    callback_url: str | None = None
    messages: list[Message] = Field(default_factory=list)
    model_override: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    submitted_at: datetime | None = None

    def fields_by_status(self, status: FieldStatus) -> list[TrackedField]:
        return [f for f in self.fields.values() if f.status == status]

    def active_fields(self) -> list[TrackedField]:
        """Return fields whose conditions are met given current data."""
        return [
            f for f in self.fields.values()
            if self._conditions_met(f.conditions)
        ]

    def missing_required(self) -> list[TrackedField]:
        return [
            f for f in self.active_fields()
            if f.required and f.status == FieldStatus.MISSING
        ]

    def unconfirmed_fields(self) -> list[TrackedField]:
        return [
            f for f in self.active_fields()
            if f.status == FieldStatus.UNCONFIRMED
        ]

    def all_required_resolved(self) -> bool:
        for f in self.active_fields():
            if f.required and f.status in (FieldStatus.MISSING, FieldStatus.UNCONFIRMED):
                return False
        return True

    def application_data(self) -> dict[str, Any]:
        """Flat dict of confirmed + collected field values."""
        return {
            f.field_id: f.value
            for f in self.fields.values()
            if f.status in (FieldStatus.CONFIRMED, FieldStatus.COLLECTED)
            and f.value is not None
        }

    def field_summary(self) -> dict[str, int]:
        counts = {s.value: 0 for s in FieldStatus}
        for f in self.active_fields():
            counts[f.status.value] += 1
        return counts

    def _conditions_met(self, conditions: list[dict] | None) -> bool:
        if not conditions:
            return True
        data = {f.field_id: f.value for f in self.fields.values() if f.value is not None}
        for cond in conditions:
            if not self._eval_condition(cond, data):
                return False
        return True

    def _eval_condition(self, cond: dict, data: dict[str, Any]) -> bool:
        """Evaluate a single condition — supports both simple and compound formats."""
        # Compound condition (AND/OR/NOT with nested conditions array)
        if "operator" in cond and "conditions" in cond:
            return self._eval_compound(cond, data)

        # Simple condition — our internal format: field_id, operator, value
        if "field_id" in cond:
            return self._eval_simple(cond, data)

        # Leaf condition — eApp format: field, op, value
        if "field" in cond:
            return self._eval_leaf(cond, data)

        return True

    def _eval_compound(self, cond: dict, data: dict[str, Any]) -> bool:
        op = cond["operator"]
        children = cond.get("conditions", [])

        if op == "AND":
            return all(self._eval_condition(c, data) for c in children)
        if op == "OR":
            return any(self._eval_condition(c, data) for c in children)
        if op == "NOT":
            return not any(self._eval_condition(c, data) for c in children)
        return True

    def _eval_simple(self, cond: dict, data: dict[str, Any]) -> bool:
        value = data.get(cond["field_id"])
        op = cond["operator"]
        expected = cond["value"]
        if op == "equals" and value != expected:
            return False
        if op == "not_equals" and value == expected:
            return False
        if op == "in" and value not in expected:
            return False
        if op == "not_in" and value in expected:
            return False
        return True

    def _eval_leaf(self, cond: dict, data: dict[str, Any]) -> bool:
        """Evaluate an eApp-format leaf condition: {field, op, value}."""
        value = data.get(cond["field"])
        op = cond.get("op", "eq")
        expected = cond.get("value")

        if op == "eq":
            return value == expected
        if op == "neq":
            return value != expected
        if op == "contains":
            if isinstance(value, (list, tuple)):
                return expected in value
            return False
        if op == "gt":
            return value is not None and value > expected
        if op == "gte":
            return value is not None and value >= expected
        if op == "lt":
            return value is not None and value < expected
        if op == "lte":
            return value is not None and value <= expected
        if op == "in":
            return value in (expected or [])
        if op == "not_in":
            return value not in (expected or [])
        return True
