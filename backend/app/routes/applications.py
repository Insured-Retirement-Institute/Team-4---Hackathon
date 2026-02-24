from flask import Blueprint, jsonify, request

from app.services.application_service import (
    create_application,
    get_application,
    save_application,
    validate,
    submit,
)

applications_bp = Blueprint("applications", __name__)


@applications_bp.route("/applications", methods=["POST"])
def create():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    carrier_id = data.get("carrier_id")
    schema_version = data.get("schema_version")

    if not carrier_id or not schema_version:
        return jsonify({"error": "carrier_id and schema_version are required"}), 400

    app, err = create_application(carrier_id, schema_version)
    if err:
        return jsonify({"error": err}), 400

    return jsonify({
        "application_id": app["application_id"],
        "carrier_id": app["carrier_id"],
        "status": app["status"],
        "created_at": app["created_at"],
    }), 201


@applications_bp.route("/applications/<application_id>", methods=["GET"])
def get(application_id):
    app = get_application(application_id)
    if not app:
        return jsonify({"error": "Application not found", "application_id": application_id}), 404
    return jsonify(app)


@applications_bp.route("/applications/<application_id>", methods=["PUT"])
def update(application_id):
    body = request.get_json()
    if not body or "data" not in body:
        return jsonify({"error": "Request body must contain 'data'"}), 400

    result, err = save_application(application_id, body["data"])
    if err:
        status = 404 if "not found" in err.lower() else 400
        return jsonify({"error": err}), status

    return jsonify({
        "application_id": result["application_id"],
        "status": result["status"],
        "updated_at": result["updated_at"],
    })


@applications_bp.route("/applications/<application_id>/validate", methods=["POST"])
def validate_app(application_id):
    is_valid, errors, err = validate(application_id)
    if err:
        return jsonify({"error": err}), 404

    return jsonify({"valid": is_valid, "errors": errors})


@applications_bp.route("/applications/<application_id>/submit", methods=["POST"])
def submit_app(application_id):
    result, err = submit(application_id)
    if err:
        if err == "Validation failed":
            return jsonify({"error": err, "errors": result["errors"]}), 400
        return jsonify({"error": err}), 404

    return jsonify({
        "application_id": result["application_id"],
        "status": result["status"],
        "submitted_at": result["submitted_at"],
    })
