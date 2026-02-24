import os
from flask import Flask
from flask_cors import CORS

from app.config import config_by_name
from app.routes import register_blueprints
from app.services.carrier_service import seed_carrier_schemas


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    CORS(app)

    register_blueprints(app)

    with app.app_context():
        if config_name != "testing":
            seed_carrier_schemas()

    return app
