from flask import Blueprint, jsonify

from app.services.carrier_service import get_all_schemas

carriers_bp = Blueprint("carriers", __name__)


@carriers_bp.route("/carriers", methods=["GET"])
def list_carriers():
    """List available carriers (convenience alias for /schemas)."""
    schemas = get_all_schemas()
    carriers = [
        {
            "carrier_id": s["carrier_id"],
            "carrier_name": s["carrier_name"],
            "product_types": s.get("product_types", []),
        }
        for s in schemas
    ]
    return jsonify({"carriers": carriers})
