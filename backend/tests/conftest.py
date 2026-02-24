import json
import os
import pytest

from app import create_app


@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app("testing")
    yield app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def sample_schema():
    """Load the sample carrier schema."""
    schema_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "app", "schemas", "carriers", "sample_carrier.json",
    )
    with open(schema_path) as f:
        return json.load(f)
