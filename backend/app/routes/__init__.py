from app.routes.health import health_bp
from app.routes.schemas import schemas_bp
from app.routes.applications import applications_bp
from app.routes.carriers import carriers_bp


def register_blueprints(app):
    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(schemas_bp, url_prefix="/api/v1")
    app.register_blueprint(applications_bp, url_prefix="/api/v1")
    app.register_blueprint(carriers_bp, url_prefix="/api/v1")
