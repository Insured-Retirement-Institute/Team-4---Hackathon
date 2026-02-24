from app.models.application import (
    create_application as db_create,
    get_application as db_get,
    update_application as db_update,
    submit_application as db_submit,
)
from app.models.carrier_schema import get_schema
from app.services.validation_service import validate_application


def create_application(carrier_id, schema_version):
    """Create a new draft application."""
    schema = get_schema(carrier_id, schema_version)
    if not schema:
        return None, f"Schema not found for carrier '{carrier_id}' version '{schema_version}'"

    app = db_create(carrier_id, schema_version)
    return app, None


def get_application(application_id):
    """Retrieve an application."""
    return db_get(application_id)


def save_application(application_id, data):
    """Save partial application data."""
    app = db_get(application_id)
    if not app:
        return None, "Application not found"

    if app["status"] == "submitted":
        return None, "Cannot modify a submitted application"

    # Merge new data with existing
    existing_data = app.get("data", {})
    existing_data.update(data)

    updated = db_update(application_id, existing_data)
    return updated, None


def validate(application_id):
    """Validate application against its carrier schema."""
    app = db_get(application_id)
    if not app:
        return None, None, "Application not found"

    schema = get_schema(app["carrier_id"], app["schema_version"])
    if not schema:
        return None, None, "Carrier schema not found"

    is_valid, errors = validate_application(schema, app.get("data", {}))
    return is_valid, errors, None


def submit(application_id):
    """Validate and submit an application."""
    is_valid, errors, err = validate(application_id)
    if err:
        return None, err

    if not is_valid:
        return {"valid": False, "errors": errors}, "Validation failed"

    result = db_submit(application_id)
    return result, None
