from flask import Blueprint, jsonify, request

from app.services.carrier_service import (
    get_all_schemas,
    get_carrier_schema,
    create_or_update_schema,
)

schemas_bp = Blueprint("schemas", __name__)


@schemas_bp.route("/schemas", methods=["GET"])
def list_schemas():
    schemas = get_all_schemas()
    return jsonify({"schemas": schemas})


@schemas_bp.route("/schemas/<carrier_id>", methods=["GET"])
def get_schema(carrier_id):
    version = request.args.get("version")
    schema = get_carrier_schema(carrier_id, version)

    if not schema:
        return jsonify({"error": "Schema not found", "carrier_id": carrier_id}), 404

    return jsonify(schema)


@schemas_bp.route("/schemas", methods=["POST"])
def create_schema():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required_fields = ["carrier_id", "carrier_name", "schema_version", "steps"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    result = create_or_update_schema(data)
    return jsonify(result), 201
