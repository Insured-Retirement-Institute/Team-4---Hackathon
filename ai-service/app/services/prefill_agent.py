"""LLM-orchestrated pre-fill agent that gathers data from CRM, policies, and documents."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from app.services.datasources.mock_redtail import MockRedtailCRM
from app.services.datasources.mock_policy import MockPolicySystem
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

# ── Tool definitions ────────────────────────────────────────────────────────

PREFILL_TOOLS: list[dict[str, Any]] = [
    {
        "name": "lookup_crm_client",
        "description": (
            "Look up a client in the CRM system (Redtail) to retrieve their personal "
            "information such as name, date of birth, SSN, contact info, and address."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The CRM client identifier (e.g. 'client_001').",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_prior_policies",
        "description": (
            "Look up a client's prior policy and suitability data including income, "
            "net worth, risk tolerance, investment experience, and existing insurance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The client identifier to look up policies for.",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "extract_document_fields",
        "description": (
            "Extract application fields from an uploaded document (image or PDF). "
            "Analyze the document and return any fields you can identify."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "analysis": {
                    "type": "string",
                    "description": "Your analysis of what the document contains.",
                },
                "extracted_fields": {
                    "type": "object",
                    "description": "Map of field_id to extracted value from the document.",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["analysis", "extracted_fields"],
            "additionalProperties": False,
        },
    },
    {
        "name": "report_prefill_results",
        "description": (
            "Report the final pre-fill results after gathering data from all available sources. "
            "Call this tool ONCE after you have gathered all available data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "known_data": {
                    "type": "object",
                    "description": "All field values gathered, as {field_id: value}.",
                    "additionalProperties": {},
                },
                "sources_used": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of data sources consulted (e.g. 'CRM', 'Prior Policies', 'Document').",
                },
                "fields_found": {
                    "type": "integer",
                    "description": "Total number of fields populated.",
                },
                "summary": {
                    "type": "string",
                    "description": "Human-readable summary of what was found.",
                },
            },
            "required": ["known_data", "sources_used", "fields_found", "summary"],
            "additionalProperties": False,
        },
    },
]

SYSTEM_PROMPT = """\
You are a pre-fill data gathering agent for an annuity e-application system.

Your job is to collect as much client data as possible from the available sources \
before the application begins. This saves the advisor time by pre-populating fields.

Available data sources:
- CRM (Redtail): Client personal info — name, DOB, SSN, gender, contact, address
- Prior Policies: Suitability data — income, net worth, risk tolerance, investment details

Workflow:
1. If a client_id is provided, call lookup_crm_client to get their CRM profile
2. Then call lookup_prior_policies to get their suitability/financial data
3. If a document is attached, call extract_document_fields to pull data from it
4. Once all sources are exhausted, call report_prefill_results with the combined data

Always gather from ALL available sources before reporting results. \
Combine data from multiple sources — CRM fields and policy fields together. \
Never fabricate data. Only report what the sources actually return."""


# ── Data source executors ───────────────────────────────────────────────────

_crm = MockRedtailCRM()
_policy = MockPolicySystem()


async def _execute_tool(name: str, input_data: dict[str, Any]) -> str:
    """Execute a pre-fill tool and return the JSON result string."""
    if name == "lookup_crm_client":
        result = await _crm.query(input_data)
        if not result:
            return json.dumps({"error": "Client not found in CRM."})
        return json.dumps(result)

    elif name == "lookup_prior_policies":
        result = await _policy.query(input_data)
        if not result:
            return json.dumps({"error": "No prior policy data found for this client."})
        return json.dumps(result)

    elif name == "extract_document_fields":
        # The LLM already did the extraction via vision — just echo it back
        return json.dumps(input_data.get("extracted_fields", {}))

    elif name == "report_prefill_results":
        # Terminal tool — return its input directly
        return json.dumps(input_data)

    return json.dumps({"error": f"Unknown tool: {name}"})


# ── Agent loop ──────────────────────────────────────────────────────────────

async def run_prefill_agent(
    client_id: str | None = None,
    document_base64: str | None = None,
    document_media_type: str | None = None,
) -> dict[str, Any]:
    """Run the pre-fill agent to gather data from available sources.

    Returns: {known_data, sources_used, fields_found, summary}
    """
    llm = LLMService()

    # Build initial user message
    content_blocks: list[dict[str, Any]] = []

    instruction_parts = ["Please gather all available pre-fill data."]
    if client_id:
        instruction_parts.append(f"Client ID: {client_id}")
    if document_base64:
        instruction_parts.append("A document has been uploaded — please extract any relevant fields from it.")
        content_blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": document_media_type or "image/png",
                "data": document_base64,
            },
        })

    content_blocks.append({"type": "text", "text": " ".join(instruction_parts)})

    messages: list[dict[str, Any]] = [{"role": "user", "content": content_blocks}]

    max_iterations = 5
    for i in range(max_iterations):
        logger.info("Prefill agent iteration %d/%d", i + 1, max_iterations)

        response = llm.chat(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=PREFILL_TOOLS,
            force_tool=True,
        )

        tool_calls = LLMService.extract_tool_calls(response)

        if not tool_calls:
            # No tools called — shouldn't happen with force_tool=True, but handle gracefully
            logger.warning("Prefill agent: no tool calls in iteration %d", i + 1)
            break

        # Add assistant response to message history
        messages.append({"role": "assistant", "content": response.content})

        # Process all tool calls and build tool results
        tool_results: list[dict[str, Any]] = []
        terminal_result = None

        for call in tool_calls:
            result_str = await _execute_tool(call["name"], call["input"])
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": result_str,
            })

            if call["name"] == "report_prefill_results":
                terminal_result = call["input"]

        # Add tool results as a single user message (Anthropic API requirement)
        messages.append({"role": "user", "content": tool_results})

        if terminal_result:
            logger.info(
                "Prefill agent completed: %d fields from %s",
                terminal_result.get("fields_found", 0),
                terminal_result.get("sources_used", []),
            )
            return {
                "known_data": terminal_result.get("known_data", {}),
                "sources_used": terminal_result.get("sources_used", []),
                "fields_found": terminal_result.get("fields_found", 0),
                "summary": terminal_result.get("summary", ""),
            }

    # Fallback: agent didn't call report_prefill_results within max iterations
    logger.warning("Prefill agent hit max iterations without reporting results")
    return {
        "known_data": {},
        "sources_used": [],
        "fields_found": 0,
        "summary": "Pre-fill agent was unable to gather data within the allowed iterations.",
    }
