"""Adapt external eApp schema formats to our internal session format.

Transforms Midland-style eApp definitions (pages/questions/visibility)
into our CreateSessionRequest format (steps/fields/conditions).
"""
from __future__ import annotations

from typing import Any


# Map external question types to our internal field types
_TYPE_MAP = {
    "short_text": "text",
    "long_text": "textarea",
    "number": "number",
    "currency": "currency",
    "date": "date",
    "boolean": "checkbox",
    "select": "select",
    "multi_select": "select",
    "radio": "select",
    "phone": "phone",
    "email": "email",
    "ssn": "ssn",
    "signature": "text",
    "initials": "text",
    "file_upload": "text",
    "repeatable_group": "text",
    "allocation_table": "text",
}


def adapt_eapp_schema(eapp: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert a full eApp definition (Midland format) to our questions list.

    Input: eApp JSON with top-level 'pages' array.
    Output: list of step dicts suitable for CreateSessionRequest.questions.
    """
    steps = []
    for page in eapp.get("pages", []):
        step = _adapt_page(page)
        if step["fields"]:  # skip pages with no questions (e.g. disclosure-only)
            steps.append(step)
    return steps


def _adapt_page(page: dict[str, Any]) -> dict[str, Any]:
    """Convert a single page to a step."""
    fields = []
    for q in page.get("questions", []):
        field = _adapt_question(q)
        if field:
            fields.append(field)

    return {
        "step_id": page["id"],
        "title": page.get("title", ""),
        "fields": fields,
    }


def _adapt_question(q: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a single question to a field definition."""
    qtype = q.get("type", "short_text")

    # Skip complex types that don't map to single fields
    if qtype == "repeatable_group":
        return _adapt_repeatable_group(q)
    if qtype == "allocation_table":
        return None  # skip for now

    field_type = _TYPE_MAP.get(qtype, "text")

    field: dict[str, Any] = {
        "field_id": q["id"],
        "type": field_type,
        "label": q.get("label", q["id"]),
        "required": q.get("required", False),
    }

    # Hint becomes part of the label context for the LLM
    if q.get("hint"):
        field["hint"] = q["hint"]

    # Options for select/radio/multi_select
    if q.get("options"):
        field["options"] = q["options"]  # already in {value, label} format

    # Convert validation array to our dict format
    if q.get("validation"):
        field["validation"] = _adapt_validation(q["validation"])

    # Convert visibility to our conditions format
    if q.get("visibility"):
        field["conditions"] = _adapt_visibility(q["visibility"])

    return field


def _adapt_repeatable_group(q: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a repeatable_group to a text field placeholder.

    For now, we represent the group as a single text field.
    The LLM will collect the info conversationally.
    """
    config = q.get("groupConfig", {})
    sub_fields = config.get("fields", [])
    if not sub_fields:
        return None

    # Build a description of what's needed
    labels = [f.get("label", f.get("id", "")) for f in sub_fields]

    return {
        "field_id": q["id"],
        "type": "text",
        "label": q.get("label", q["id"]),
        "required": q.get("required", False),
        "hint": q.get("hint", f"Collect: {', '.join(labels)}"),
        "validation": {},
    }


def _adapt_validation(rules: list[dict[str, Any]]) -> dict[str, Any]:
    """Convert validation rule array to our flat validation dict."""
    result: dict[str, Any] = {}
    for rule in rules:
        rtype = rule.get("type", "")
        value = rule.get("value")
        desc = rule.get("description")

        if rtype == "required":
            pass  # handled by the 'required' field flag
        elif rtype == "max_length":
            result["max_length"] = value
        elif rtype == "min_length":
            result["min_length"] = value
        elif rtype == "pattern":
            result["pattern"] = value
            if desc:
                result["custom_message"] = desc
        elif rtype == "min":
            result["min_value"] = value
        elif rtype == "max":
            result["max_value"] = value
        elif rtype == "min_date":
            result["min_date"] = value
            if desc:
                result["custom_message"] = desc
        elif rtype == "max_date":
            result["max_date"] = value
            if desc:
                result["custom_message"] = desc
        elif rtype == "equals":
            result["equals"] = value
            if desc:
                result["custom_message"] = desc
        elif rtype == "equals_today":
            result["equals_today"] = True
            if desc:
                result["custom_message"] = desc
        # Skip async, allocation_sum, cross_field for now

    return result


def _adapt_visibility(visibility: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert compound visibility conditions to our conditions list.

    We store the compound structure directly — our condition evaluator
    handles the AND/OR/NOT format natively.
    """
    # If it's a leaf condition (has 'field' key directly), wrap in AND
    if "field" in visibility:
        return [_leaf_to_condition(visibility)]

    # Compound condition — store as-is for our evaluator
    # We return the whole structure as a single-element list with the compound object
    return [visibility]


def _leaf_to_condition(leaf: dict[str, Any]) -> dict[str, Any]:
    """Convert a leaf visibility condition to our internal format."""
    op = leaf.get("op", "eq")
    # Map eApp ops to our operators
    op_map = {
        "eq": "equals",
        "neq": "not_equals",
        "contains": "in",
    }
    return {
        "field_id": leaf["field"],
        "operator": op_map.get(op, op),
        "value": leaf.get("value"),
    }
