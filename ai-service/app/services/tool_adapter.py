"""Convert Anthropic tool definitions to Nova Sonic toolSpec format."""
from __future__ import annotations

from typing import Any


def anthropic_to_nova_sonic(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert a list of Anthropic-format tools to Nova Sonic toolSpec format.

    Anthropic format:
        {"name": ..., "description": ..., "input_schema": {...}}

    Nova Sonic format:
        {"toolSpec": {"name": ..., "description": ..., "inputSchema": {"json": {...}}}}
    """
    return [_convert_one(tool) for tool in tools]


def _convert_one(tool: dict[str, Any]) -> dict[str, Any]:
    return {
        "toolSpec": {
            "name": tool["name"],
            "description": tool["description"],
            "inputSchema": {
                "json": tool["input_schema"],
            },
        }
    }
