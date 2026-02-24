from flask import current_app
from app.utils.dynamo import get_table


def get_schemas_table():
    return get_table(current_app.config["DYNAMODB_SCHEMAS_TABLE"])


def put_schema(schema):
    """Store a carrier schema in DynamoDB."""
    table = get_schemas_table()
    table.put_item(Item={
        "carrier_id": schema["carrier_id"],
        "schema_version": schema["schema_version"],
        "carrier_name": schema["carrier_name"],
        "effective_date": schema.get("effective_date", ""),
        "product_types": schema.get("product_types", []),
        "steps": schema.get("steps", []),
        "metadata": schema.get("metadata", {}),
    })


def get_schema(carrier_id, version=None):
    """Get a carrier schema. If version is None, returns the latest."""
    table = get_schemas_table()

    if version:
        resp = table.get_item(Key={
            "carrier_id": carrier_id,
            "schema_version": version,
        })
        return resp.get("Item")

    # Query all versions and return the latest
    from boto3.dynamodb.conditions import Key
    resp = table.query(
        KeyConditionExpression=Key("carrier_id").eq(carrier_id),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def list_schemas():
    """List all carrier schemas (latest version per carrier)."""
    table = get_schemas_table()
    resp = table.scan()
    items = resp.get("Items", [])

    # Deduplicate to latest version per carrier
    latest = {}
    for item in items:
        cid = item["carrier_id"]
        if cid not in latest or item["schema_version"] > latest[cid]["schema_version"]:
            latest[cid] = item

    return list(latest.values())
