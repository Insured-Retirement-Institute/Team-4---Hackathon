import boto3
from flask import current_app


_client = None
_resource = None


def get_dynamodb_resource():
    global _resource
    if _resource is None:
        kwargs = {"region_name": current_app.config["AWS_REGION"]}
        endpoint = current_app.config.get("AWS_ENDPOINT_URL")
        if endpoint:
            kwargs["endpoint_url"] = endpoint
        _resource = boto3.resource("dynamodb", **kwargs)
    return _resource


def get_table(table_name):
    return get_dynamodb_resource().Table(table_name)


def reset_clients():
    """Reset cached clients (useful for testing)."""
    global _client, _resource
    _client = None
    _resource = None
