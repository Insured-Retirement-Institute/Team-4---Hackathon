"""Build Anthropic tool definitions for field extraction and confirmation."""
from __future__ import annotations

from typing import Any

from app.models.conversation import ConversationState, FieldStatus, SessionPhase, TrackedField

# Maps carrier schema field types to JSON Schema types
FIELD_TYPE_MAP: dict[str, dict[str, Any]] = {
    "text": {"type": "string"},
    "email": {"type": "string", "format": "email"},
    "phone": {"type": "string"},
    "ssn": {"type": "string", "pattern": r"^\d{3}-\d{2}-\d{4}$"},
    "date": {"type": "string", "format": "date"},
    "number": {"type": "number"},
    "currency": {"type": "number"},
    "select": {"type": "string"},
    "checkbox": {"type": "boolean"},
    "textarea": {"type": "string"},
}


def _field_to_json_schema(field: TrackedField) -> dict[str, Any]:
    """Convert a TrackedField to a JSON Schema property."""
    base = FIELD_TYPE_MAP.get(field.field_type, {"type": "string"}).copy()
    base["description"] = field.label or field.field_id

    if field.field_type == "select" and field.options:
        base["enum"] = [opt["value"] for opt in field.options]

    validation = field.validation or {}
    if "min_length" in validation:
        base["minLength"] = validation["min_length"]
    if "max_length" in validation:
        base["maxLength"] = validation["max_length"]
    if "pattern" in validation and "pattern" not in base:
        base["pattern"] = validation["pattern"]
    if "min_value" in validation:
        base["minimum"] = validation["min_value"]
    if "max_value" in validation:
        base["maximum"] = validation["max_value"]

    return base


def build_extraction_tool(fields: list[TrackedField]) -> dict[str, Any]:
    """Build tool for extracting field values from conversation."""
    properties: dict[str, Any] = {}
    for field in fields:
        properties[field.field_id] = _field_to_json_schema(field)

    return {
        "name": "extract_application_fields",
        "description": (
            "Extract application field values from the conversation. "
            "Only include fields the user has clearly provided. "
            "Do not guess or fabricate values."
        ),
        "input_schema": {
            "type": "object",
            "properties": properties,
            "additionalProperties": False,
        },
    }


def build_confirm_tool(unconfirmed_fields: list[TrackedField]) -> dict[str, Any]:
    """Build tool for confirming known field values are correct."""
    field_ids = [f.field_id for f in unconfirmed_fields]
    return {
        "name": "confirm_known_fields",
        "description": (
            "Confirm that pre-populated field values are correct as stated by the user. "
            "Pass the list of field_ids that the user has confirmed are accurate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "field_ids": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": field_ids,
                    },
                    "description": "List of field IDs confirmed as correct by the user.",
                },
            },
            "required": ["field_ids"],
            "additionalProperties": False,
        },
    }


def build_tools_for_phase(state: ConversationState) -> list[dict[str, Any]]:
    """Build the tool set appropriate for the current session phase."""
    tools: list[dict[str, Any]] = []
    active = state.active_fields()

    if state.phase == SessionPhase.SPOT_CHECK:
        # Both confirm (for "looks right") and extract (for corrections)
        unconfirmed = [f for f in active if f.status == FieldStatus.UNCONFIRMED]
        if unconfirmed:
            tools.append(build_confirm_tool(unconfirmed))
        extractable = [f for f in active if f.status in (FieldStatus.MISSING, FieldStatus.UNCONFIRMED)]
        if extractable:
            tools.append(build_extraction_tool(extractable))

    elif state.phase == SessionPhase.COLLECTING:
        # Extract only — collect missing fields
        collectible = [f for f in active if f.status in (FieldStatus.MISSING,)]
        # Also allow re-extraction if there are validation errors
        with_errors = [f for f in active if f.validation_error]
        all_extractable = {f.field_id: f for f in collectible + with_errors}
        if all_extractable:
            tools.append(build_extraction_tool(list(all_extractable.values())))

    elif state.phase == SessionPhase.REVIEWING:
        # Both confirm (for "all good") and extract (for corrections)
        resolved = [f for f in active if f.status in (FieldStatus.CONFIRMED, FieldStatus.COLLECTED)]
        if resolved:
            tools.append(build_confirm_tool(resolved))
        all_fields = [f for f in active]
        if all_fields:
            tools.append(build_extraction_tool(all_fields))

    return tools
