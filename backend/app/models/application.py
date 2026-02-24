import uuid
from datetime import datetime, timezone

from flask import current_app
from app.utils.dynamo import get_table


def get_applications_table():
    return get_table(current_app.config["DYNAMODB_APPLICATIONS_TABLE"])


def create_application(carrier_id, schema_version):
    """Create a new draft application."""
    table = get_applications_table()
    now = datetime.now(timezone.utc).isoformat()
    app_id = str(uuid.uuid4())

    item = {
        "application_id": app_id,
        "carrier_id": carrier_id,
        "schema_version": schema_version,
        "status": "draft",
        "data": {},
        "created_at": now,
        "updated_at": now,
        "submitted_at": None,
    }
    table.put_item(Item=item)
    return item


def get_application(application_id):
    """Get an application by ID."""
    table = get_applications_table()
    resp = table.get_item(Key={"application_id": application_id})
    return resp.get("Item")


def update_application(application_id, data):
    """Update application data (merge)."""
    table = get_applications_table()
    now = datetime.now(timezone.utc).isoformat()

    resp = table.update_item(
        Key={"application_id": application_id},
        UpdateExpression="SET #data = :data, updated_at = :now",
        ExpressionAttributeNames={"#data": "data"},
        ExpressionAttributeValues={":data": data, ":now": now},
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes")


def submit_application(application_id):
    """Mark application as submitted."""
    table = get_applications_table()
    now = datetime.now(timezone.utc).isoformat()

    resp = table.update_item(
        Key={"application_id": application_id},
        UpdateExpression="SET #status = :status, submitted_at = :now, updated_at = :now",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":status": "submitted", ":now": now},
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes")
