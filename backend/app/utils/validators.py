import re


def validate_field(field_def, value):
    """Validate a single field value against its field definition.

    Returns a list of error messages (empty if valid).
    """
    errors = []
    field_id = field_def["field_id"]
    field_type = field_def["type"]
    required = field_def.get("required", False)
    validation = field_def.get("validation", {})

    # Check required
    if required and (value is None or value == ""):
        custom = validation.get("custom_message", f"{field_def['label']} is required")
        errors.append({"field_id": field_id, "message": custom})
        return errors

    # Skip further validation if empty and not required
    if value is None or value == "":
        return errors

    # String validations
    if field_type in ("text", "email", "phone", "ssn", "textarea"):
        str_val = str(value)
        min_len = validation.get("min_length")
        max_len = validation.get("max_length")
        pattern = validation.get("pattern")

        if min_len is not None and len(str_val) < min_len:
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']} must be at least {min_len} characters"),
            })
        if max_len is not None and len(str_val) > max_len:
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']} must be at most {max_len} characters"),
            })
        if pattern and not re.match(pattern, str_val):
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']} format is invalid"),
            })

    # Numeric validations
    if field_type in ("number", "currency"):
        try:
            num_val = float(value)
        except (ValueError, TypeError):
            errors.append({
                "field_id": field_id,
                "message": f"{field_def['label']} must be a number",
            })
            return errors

        min_val = validation.get("min_value")
        max_val = validation.get("max_value")
        if min_val is not None and num_val < min_val:
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']} must be at least {min_val}"),
            })
        if max_val is not None and num_val > max_val:
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']} must be at most {max_val}"),
            })

    # Select validation
    if field_type == "select":
        options = field_def.get("options", [])
        valid_values = [opt["value"] for opt in options]
        if value not in valid_values:
            errors.append({
                "field_id": field_id,
                "message": validation.get("custom_message", f"{field_def['label']}: invalid selection"),
            })

    return errors


def evaluate_conditions(conditions, data):
    """Evaluate whether all conditions are met given the form data.

    Returns True if all conditions pass (or if there are no conditions).
    """
    if not conditions:
        return True

    for cond in conditions:
        field_val = data.get(cond["field_id"])
        op = cond["operator"]
        expected = cond["value"]

        if op == "equals" and field_val != expected:
            return False
        elif op == "not_equals" and field_val == expected:
            return False
        elif op == "in" and field_val not in expected:
            return False
        elif op == "not_in" and field_val in expected:
            return False
        elif op == "greater_than":
            try:
                if float(field_val) <= float(expected):
                    return False
            except (ValueError, TypeError):
                return False
        elif op == "less_than":
            try:
                if float(field_val) >= float(expected):
                    return False
            except (ValueError, TypeError):
                return False

    return True
