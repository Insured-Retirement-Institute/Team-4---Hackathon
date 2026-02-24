"""Field-level validation based on TrackedField config."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from app.models.conversation import TrackedField


def validate_field(field: TrackedField, value: Any) -> tuple[bool, str | None]:
    """Validate a value against a TrackedField's type and validation rules.

    Returns (is_valid, error_message). error_message is None when valid.
    """
    if value is None or value == "":
        if field.required:
            return False, f"{field.label or field.field_id} is required."
        return True, None

    validation = field.validation or {}
    custom_msg = validation.get("custom_message")

    # Type-specific validation
    validator = _VALIDATORS.get(field.field_type)
    if validator:
        ok, err = validator(field, value, validation)
        if not ok:
            return False, custom_msg or err

    return True, None


def _validate_text(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    s = str(value)
    if "min_length" in validation and len(s) < validation["min_length"]:
        return False, f"{field.label} must be at least {validation['min_length']} characters."
    if "max_length" in validation and len(s) > validation["max_length"]:
        return False, f"{field.label} must be at most {validation['max_length']} characters."
    if "pattern" in validation:
        if not re.fullmatch(validation["pattern"], s):
            return False, f"{field.label} format is invalid."
    return True, None


def _validate_email(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    s = str(value)
    # Basic email pattern
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", s):
        return False, f"{field.label} must be a valid email address."
    return _validate_text(field, value, validation)


def _validate_phone(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    s = str(value)
    if "pattern" in validation:
        if not re.fullmatch(validation["pattern"], s):
            return False, f"{field.label} format is invalid."
    else:
        # Default: at least 10 digits
        digits = re.sub(r"\D", "", s)
        if len(digits) < 10:
            return False, f"{field.label} must have at least 10 digits."
    return True, None


def _validate_ssn(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    s = str(value)
    pattern = validation.get("pattern", r"^\d{3}-\d{2}-\d{4}$")
    if not re.fullmatch(pattern, s):
        return False, f"{field.label} must be in format XXX-XX-XXXX."
    return True, None


def _validate_number(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    try:
        n = float(value)
    except (ValueError, TypeError):
        return False, f"{field.label} must be a number."
    if "min_value" in validation and n < validation["min_value"]:
        return False, f"{field.label} must be at least {validation['min_value']}."
    if "max_value" in validation and n > validation["max_value"]:
        return False, f"{field.label} must be at most {validation['max_value']}."
    return True, None


def _validate_currency(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    return _validate_number(field, value, validation)


def _validate_select(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    if field.options:
        valid_values = [opt["value"] for opt in field.options]
        if value not in valid_values:
            labels = ", ".join(opt.get("label", opt["value"]) for opt in field.options)
            return False, f"{field.label} must be one of: {labels}."
    return True, None


def _validate_checkbox(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    if not isinstance(value, bool):
        return False, f"{field.label} must be true or false."
    return True, None


def _validate_date(field: TrackedField, value: Any, validation: dict) -> tuple[bool, str | None]:
    s = str(value)
    try:
        # Try ISO 8601 formats
        if "T" in s:
            datetime.fromisoformat(s)
        else:
            date.fromisoformat(s)
    except ValueError:
        return False, f"{field.label} must be a valid date (YYYY-MM-DD)."
    return True, None


_VALIDATORS = {
    "text": _validate_text,
    "textarea": _validate_text,
    "email": _validate_email,
    "phone": _validate_phone,
    "ssn": _validate_ssn,
    "number": _validate_number,
    "currency": _validate_currency,
    "select": _validate_select,
    "checkbox": _validate_checkbox,
    "date": _validate_date,
}
