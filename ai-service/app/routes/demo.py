"""Demo routes for loading test schemas and serving the chat UI."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.schema_adapter import adapt_eapp_schema

router = APIRouter(tags=["demo"])

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


@router.get("/demo/midland-schema")
async def get_midland_schema():
    """Load the Midland eApp schema and return it in our internal format."""
    schema_path = SCHEMAS_DIR / "midland-national-eapp.json"
    with open(schema_path) as f:
        eapp = json.load(f)
    questions = adapt_eapp_schema(eapp)
    return JSONResponse(content=questions)
