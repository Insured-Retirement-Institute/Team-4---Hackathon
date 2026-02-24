import json
import os

from flask import current_app

from app.models.carrier_schema import put_schema, get_schema, list_schemas


def get_all_schemas():
    """List all carrier schemas (summary only)."""
    schemas = list_schemas()
    return [
        {
            "carrier_id": s["carrier_id"],
            "carrier_name": s["carrier_name"],
            "schema_version": s["schema_version"],
            "product_types": s.get("product_types", []),
        }
        for s in schemas
    ]


def get_carrier_schema(carrier_id, version=None):
    """Get full carrier schema."""
    return get_schema(carrier_id, version)


def create_or_update_schema(schema_data):
    """Store a carrier schema."""
    put_schema(schema_data)
    return {
        "carrier_id": schema_data["carrier_id"],
        "schema_version": schema_data["schema_version"],
        "message": "Schema created",
    }


def seed_carrier_schemas():
    """Load carrier schemas from JSON seed files into DynamoDB.

    Only seeds if the schema doesn't already exist in the database.
    Gracefully skips if DynamoDB is not available.
    """
    schemas_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "schemas",
        "carriers",
    )

    if not os.path.isdir(schemas_dir):
        return

    for filename in os.listdir(schemas_dir):
        if not filename.endswith(".json"):
            continue

        filepath = os.path.join(schemas_dir, filename)
        with open(filepath) as f:
            schema = json.load(f)

        carrier_id = schema.get("carrier_id")
        version = schema.get("schema_version")

        if not carrier_id or not version:
            current_app.logger.warning(f"Skipping invalid schema file: {filename}")
            continue

        try:
            existing = get_schema(carrier_id, version)
            if not existing:
                put_schema(schema)
                current_app.logger.info(f"Seeded schema: {carrier_id} v{version}")
        except Exception as e:
            current_app.logger.warning(
                f"Could not seed schema {carrier_id}: {e}. "
                "Ensure DynamoDB tables exist (run scripts/create-dynamodb-tables.py)."
            )
            return
