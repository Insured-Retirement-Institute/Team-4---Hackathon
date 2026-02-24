"""Shared test fixtures for the decoupled AI service."""
from __future__ import annotations

import pytest

from app.models.conversation import (
    ConversationState,
    FieldStatus,
    SessionPhase,
    TrackedField,
)

SAMPLE_QUESTIONS = [
    {
        "step_id": "owner_info",
        "title": "Owner Information",
        "fields": [
            {
                "field_id": "owner_first_name",
                "type": "text",
                "label": "First Name",
                "required": True,
                "validation": {"min_length": 1, "max_length": 50},
            },
            {
                "field_id": "owner_last_name",
                "type": "text",
                "label": "Last Name",
                "required": True,
            },
            {
                "field_id": "owner_dob",
                "type": "date",
                "label": "Date of Birth",
                "required": True,
            },
            {
                "field_id": "owner_ssn",
                "type": "ssn",
                "label": "SSN",
                "required": True,
            },
            {
                "field_id": "owner_email",
                "type": "email",
                "label": "Email",
                "required": False,
            },
        ],
    },
    {
        "step_id": "product_selection",
        "title": "Product Selection",
        "fields": [
            {
                "field_id": "product_type",
                "type": "select",
                "label": "Product Type",
                "required": True,
                "options": [
                    {"value": "annuity", "label": "Annuity"},
                    {"value": "life", "label": "Life Insurance"},
                ],
            },
            {
                "field_id": "initial_premium",
                "type": "currency",
                "label": "Initial Premium Amount",
                "required": True,
                "validation": {"min_value": 5000, "max_value": 1000000},
            },
        ],
    },
]

SAMPLE_KNOWN_DATA = {
    "owner_first_name": "John",
    "owner_last_name": "Smith",
    "owner_dob": "1965-03-15",
}


def make_fields(
    questions: list[dict] = None,
    known_data: dict = None,
) -> dict[str, TrackedField]:
    """Build TrackedField dict from questions + known_data."""
    questions = questions or SAMPLE_QUESTIONS
    known_data = known_data or {}
    fields = {}
    for step in questions:
        for fd in step.get("fields", []):
            fid = fd["field_id"]
            known_value = known_data.get(fid)
            fields[fid] = TrackedField(
                field_id=fid,
                value=known_value,
                status=FieldStatus.UNCONFIRMED if known_value is not None else FieldStatus.MISSING,
                label=fd.get("label", fid),
                field_type=fd.get("type", "text"),
                required=fd.get("required", False),
                validation=fd.get("validation", {}),
                options=fd.get("options"),
                conditions=fd.get("conditions"),
            )
    return fields


@pytest.fixture
def sample_questions():
    return [q.copy() for q in SAMPLE_QUESTIONS]


@pytest.fixture
def sample_known_data():
    return SAMPLE_KNOWN_DATA.copy()


@pytest.fixture
def sample_fields():
    return make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA)


@pytest.fixture
def sample_state():
    return ConversationState(
        session_id="test-session-1",
        phase=SessionPhase.SPOT_CHECK,
        fields=make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA),
        steps=SAMPLE_QUESTIONS,
    )


@pytest.fixture
def collecting_state():
    """State where all known data is confirmed, some fields still missing."""
    fields = make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA)
    # Confirm the known fields
    for fid in SAMPLE_KNOWN_DATA:
        fields[fid].status = FieldStatus.CONFIRMED
    return ConversationState(
        session_id="test-session-2",
        phase=SessionPhase.COLLECTING,
        fields=fields,
        steps=SAMPLE_QUESTIONS,
    )


@pytest.fixture
def complete_state():
    """State where all required fields are resolved."""
    fields = make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA)
    for f in fields.values():
        if f.value is not None:
            f.status = FieldStatus.CONFIRMED
    # Fill in missing required fields
    fields["owner_ssn"].value = "123-45-6789"
    fields["owner_ssn"].status = FieldStatus.COLLECTED
    fields["product_type"].value = "annuity"
    fields["product_type"].status = FieldStatus.COLLECTED
    fields["initial_premium"].value = 50000
    fields["initial_premium"].status = FieldStatus.COLLECTED
    return ConversationState(
        session_id="test-session-3",
        phase=SessionPhase.REVIEWING,
        fields=fields,
        steps=SAMPLE_QUESTIONS,
        callback_url="https://example.com/callback",
    )
