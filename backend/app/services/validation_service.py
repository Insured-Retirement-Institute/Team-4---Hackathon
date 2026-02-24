from app.utils.validators import validate_field, evaluate_conditions


def validate_application(schema, data):
    """Validate application data against a carrier schema.

    Returns (is_valid, errors) where errors is a list of
    {"field_id": str, "message": str} dicts.
    """
    errors = []

    for step in schema.get("steps", []):
        # Check if step is conditionally visible
        if not evaluate_conditions(step.get("conditions", []), data):
            continue

        for field in step.get("fields", []):
            # Check if field is conditionally visible
            if not evaluate_conditions(field.get("conditions", []), data):
                continue

            value = data.get(field["field_id"])
            field_errors = validate_field(field, value)
            errors.extend(field_errors)

    return len(errors) == 0, errors
