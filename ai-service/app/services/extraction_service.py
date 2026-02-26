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


ADVISOR_TOOLS: list[dict[str, Any]] = [
    {
        "name": "lookup_crm_client",
        "description": (
            "Look up a client in the CRM system (Redtail) to retrieve their personal "
            "information such as name, date of birth, SSN, contact info, and address."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The CRM client identifier (e.g. '5' or '11').",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_family_members",
        "description": (
            "Look up a client's family members and relationships from the CRM (Redtail). "
            "Returns spouse, children, and other family members with their contact details."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The CRM client identifier.",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_crm_notes",
        "description": (
            "Look up a client's notes and activity records from the CRM (Redtail). "
            "Notes often contain meeting transcripts with financial data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The CRM client identifier.",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_prior_policies",
        "description": (
            "Look up a client's prior policy and suitability data including income, "
            "net worth, risk tolerance, investment experience, and existing insurance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The client identifier.",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_annual_statements",
        "description": (
            "Look up a client's most recent annual statement from the document store (S3). "
            "Returns a PDF with contract values, interest rates, balances, and beneficiary info."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The client identifier.",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "extract_document_fields",
        "description": (
            "Extract application fields from a document (image or PDF). "
            "Analyze the document and return any fields you can identify."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "analysis": {
                    "type": "string",
                    "description": "Your analysis of what the document contains.",
                },
                "extracted_fields": {
                    "type": "object",
                    "description": "Map of field_id to extracted value from the document.",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["analysis", "extracted_fields"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_advisor_preferences",
        "description": (
            "Retrieve the advisor's preference profile including investment philosophy, "
            "preferred carriers, allocation strategy, and suitability thresholds."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "advisor_id": {
                    "type": "string",
                    "description": "The advisor identifier (e.g. 'advisor_002').",
                },
            },
            "required": ["advisor_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_carrier_suitability",
        "description": (
            "Run the carrier's suitability decision engine against client data. "
            "Returns approved/declined/pending with per-rule findings."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "carrier_id": {
                    "type": "string",
                    "description": "The carrier: 'midland-national', 'aspida', or 'equitrust'.",
                },
                "client_data": {
                    "type": "object",
                    "description": "Client data gathered so far.",
                    "additionalProperties": {},
                },
            },
            "required": ["carrier_id", "client_data"],
            "additionalProperties": False,
        },
    },
    {
        "name": "select_product",
        "description": (
            "Select the annuity product for this application. Call this tool "
            "immediately when the advisor indicates which product to use."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "enum": [
                        "midland-fixed-annuity-001",
                        "aspida-myga-001",
                        "certainty-select",
                    ],
                    "description": "The product identifier.",
                },
                "product_name": {
                    "type": "string",
                    "description": "Human-readable product name.",
                },
            },
            "required": ["product_id", "product_name"],
            "additionalProperties": False,
        },
    },
    {
        "name": "call_client",
        "description": (
            "Initiate an outbound phone call to the client via Retell AI to collect "
            "missing application fields. The AI agent will call the client, ask for "
            "the missing information conversationally, and report back."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_name": {
                    "type": "string",
                    "description": "The client's full name.",
                },
                "phone_number": {
                    "type": "string",
                    "description": "The client's phone number to call.",
                },
                "missing_fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of field labels that need to be collected.",
                },
            },
            "required": ["client_name", "phone_number", "missing_fields"],
            "additionalProperties": False,
        },
    },
]


def build_tools_for_phase(state: ConversationState) -> list[dict[str, Any]]:
    """Build the tool set appropriate for the current session phase."""
    tools: list[dict[str, Any]] = []
    active = state.active_fields()

    # Add advisor tools when in advisor mode
    if state.advisor_name:
        tools.extend(ADVISOR_TOOLS)

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
