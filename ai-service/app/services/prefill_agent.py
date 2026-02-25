"""LLM-orchestrated pre-fill agent that gathers data from CRM, policies, and documents."""

from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any, AsyncGenerator

from app.services.datasources.redtail_client import RedtailClient
from app.services.datasources.redtail_crm import RedtailCRM
from app.services.datasources.mock_policy import MockPolicySystem
from app.services.datasources.s3_statements import S3StatementStore
from app.services.datasources.s3_advisor_prefs import S3AdvisorPrefsStore
from app.services.datasources.s3_suitability import S3SuitabilityStore
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
                    "description": "The CRM client identifier (e.g. '5' or '11').",
                },
            },
            "required": ["client_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "lookup_crm_notes",
        "description": (
            "Look up a client's notes and activity records from the CRM (Redtail). "
            "Notes often contain meeting transcripts with rich financial data: income, "
            "net worth, risk tolerance, investment goals, family information, and beneficiary "
            "details. Analyze the notes text and extract any relevant suitability/financial data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The CRM client identifier (e.g. '5' or '11').",
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
        "name": "lookup_annual_statements",
        "description": (
            "Look up a client's most recent annual statement from the document store (S3). "
            "Returns the PDF which contains contract values, interest rates, balances, and "
            "beneficiary info. After receiving the document, analyze it and call extract_document_fields."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {
                    "type": "string",
                    "description": "The client identifier (e.g. '5' or '11').",
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
        "name": "get_advisor_preferences",
        "description": (
            "Retrieve an advisor's preference profile including their investment philosophy, "
            "preferred carriers, allocation strategy, and suitability thresholds. Use this to "
            "understand how the advisor typically recommends products and allocations."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "advisor_id": {
                    "type": "string",
                    "description": "The advisor identifier (e.g. 'advisor_001').",
                },
            },
            "required": ["advisor_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_carrier_suitability",
        "description": (
            "Evaluate a client's suitability for a specific carrier's product. Compares the "
            "client's gathered data (age, income, net worth, risk tolerance, etc.) against the "
            "carrier's suitability guidelines and returns a weighted score with detailed breakdown. "
            "Valid carrier IDs: 'midland-national', 'aspida', 'equitrust'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "carrier_id": {
                    "type": "string",
                    "description": "The carrier identifier: 'midland-national', 'aspida', or 'equitrust'.",
                },
                "client_data": {
                    "type": "object",
                    "description": (
                        "Client data gathered so far. Include any available fields: age, annual_income, "
                        "net_worth, risk_tolerance, investment_objective, time_horizon, source_of_funds, "
                        "liquid_net_worth, premium_amount."
                    ),
                    "additionalProperties": {},
                },
            },
            "required": ["carrier_id", "client_data"],
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
- CRM Notes: Meeting transcripts and activity notes — often contain income, net worth, \
risk tolerance, investment goals, family info, and beneficiary details
- Prior Policies: Suitability data — income, net worth, risk tolerance, investment details \
(fallback if CRM notes lack financial data)
- Annual Statements (S3 Document Store): Contract values, interest rates, balances, beneficiary info
- Advisor Preferences: Advisor's investment philosophy, preferred carriers, allocation strategy
- Carrier Suitability: Carrier-specific suitability guidelines with weighted scoring

Workflow:
1. If a client_id is provided, call lookup_crm_client to get their CRM profile
2. Then call lookup_crm_notes to retrieve meeting transcripts and activity notes. \
Carefully analyze the note text to extract financial data: income, net worth, risk tolerance, \
investment goals, existing policies, family members, beneficiaries, etc.
3. If the CRM notes did NOT contain sufficient financial/suitability data, call \
lookup_prior_policies as a fallback to get suitability data
4. Then call lookup_annual_statements to retrieve the latest annual statement PDF
5. If a PDF is returned, analyze it and call extract_document_fields with the extracted values
6. If a document is attached by the user, also call extract_document_fields for it
7. If an advisor_id is provided, call get_advisor_preferences to understand the advisor's approach
8. Call get_carrier_suitability for the most relevant carrier(s) based on advisor preferences \
and client profile. Pass gathered client data (age, annual_income, net_worth, risk_tolerance, \
investment_objective, time_horizon, source_of_funds, liquid_net_worth) to get a suitability score.
9. Once all sources are exhausted, call report_prefill_results with the combined data. \
Include suitability_score, suitability_rating, advisor_name, advisor_philosophy, and \
recommended_allocation_strategy in the known_data if available.

Combine data from structured CRM fields AND notes-extracted data. When notes contain financial \
data that the structured CRM record lacks (e.g., income, net worth), include those values. \
Always gather from ALL available sources before reporting results. \
Never fabricate data. Only report what the sources actually return."""


# ── Data source executors ───────────────────────────────────────────────────

_redtail_client = RedtailClient()
_crm = RedtailCRM(client=_redtail_client)
_policy = MockPolicySystem()
_statements = S3StatementStore()
_advisor_prefs = S3AdvisorPrefsStore()
_suitability = S3SuitabilityStore()


async def _execute_tool(name: str, input_data: dict[str, Any]) -> str | list[dict[str, Any]]:
    """Execute a pre-fill tool and return JSON string or list of content blocks."""
    if name == "lookup_crm_client":
        result = await _crm.query(input_data)
        if not result:
            return json.dumps({"error": "Client not found in CRM."})
        return json.dumps(result)

    elif name == "lookup_crm_notes":
        client_id = input_data.get("client_id", "")
        try:
            notes = await _crm.get_notes(int(client_id))
        except (ValueError, TypeError):
            return json.dumps({"error": f"Invalid client_id: {client_id}"})
        if not notes:
            return json.dumps({"notes": [], "message": "No notes found for this client."})
        return json.dumps({"notes": notes, "count": len(notes)})

    elif name == "lookup_prior_policies":
        result = await _policy.query(input_data)
        if not result:
            return json.dumps({"error": "No prior policy data found for this client."})
        return json.dumps(result)

    elif name == "lookup_annual_statements":
        result = _statements.fetch_latest_statement(input_data.get("client_id", ""))
        if not result:
            return json.dumps({"error": "No annual statements found for this client."})
        return [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": result["media_type"],
                    "data": result["pdf_base64"],
                },
            },
            {
                "type": "text",
                "text": (
                    f"Found {result['filename']}. Analyze this annual statement and call "
                    "extract_document_fields with all values you can identify (contract number, "
                    "balances, interest rates, beneficiary info, etc.)."
                ),
            },
        ]

    elif name == "get_advisor_preferences":
        advisor_id = input_data.get("advisor_id", "")
        result = _advisor_prefs.fetch_advisor_profile(advisor_id)
        if not result:
            return json.dumps({"error": f"No advisor profile found for '{advisor_id}'."})
        return json.dumps(result)

    elif name == "get_carrier_suitability":
        carrier_id = input_data.get("carrier_id", "")
        client_data = input_data.get("client_data", {})
        guidelines = _suitability.fetch_guidelines(carrier_id)
        if not guidelines:
            return json.dumps({"error": f"No suitability guidelines found for carrier '{carrier_id}'."})
        evaluation = S3SuitabilityStore.evaluate_suitability(guidelines, client_data)
        return json.dumps(evaluation)

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
    advisor_id: str | None = None,
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
    if advisor_id:
        instruction_parts.append(f"Advisor ID: {advisor_id}")
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

    max_iterations = 10
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
            result = await _execute_tool(call["name"], call["input"])
            # Content can be a string (JSON) or a list of content blocks (e.g. document + text)
            if isinstance(result, list):
                content = result
            else:
                content = result
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": content,
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


# ── Streaming agent loop ────────────────────────────────────────────────────

TOOL_DESCRIPTIONS: dict[str, str] = {
    "lookup_crm_client": "Looking up client in Redtail CRM",
    "lookup_crm_notes": "Analyzing CRM notes and meeting transcripts",
    "lookup_prior_policies": "Retrieving prior policy and suitability data",
    "lookup_annual_statements": "Fetching annual statement from document store",
    "extract_document_fields": "Extracting fields from document",
    "get_advisor_preferences": "Loading advisor preference profile",
    "get_carrier_suitability": "Evaluating carrier suitability score",
    "report_prefill_results": "Compiling final results",
}


async def run_prefill_agent_stream(
    client_id: str | None = None,
    document_base64: str | None = None,
    document_media_type: str | None = None,
    advisor_id: str | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run the pre-fill agent, yielding SSE events at each step."""
    agent_start = time.time()
    llm = LLMService()

    yield {
        "type": "agent_start",
        "message": "Starting AI agent...",
        "timestamp": time.time(),
    }

    # Build initial user message (same as run_prefill_agent)
    content_blocks: list[dict[str, Any]] = []
    instruction_parts = ["Please gather all available pre-fill data."]
    if client_id:
        instruction_parts.append(f"Client ID: {client_id}")
    if advisor_id:
        instruction_parts.append(f"Advisor ID: {advisor_id}")
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

    max_iterations = 10
    for i in range(max_iterations):
        logger.info("Prefill stream iteration %d/%d", i + 1, max_iterations)

        response = llm.chat(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=PREFILL_TOOLS,
            force_tool=True,
        )

        tool_calls = LLMService.extract_tool_calls(response)
        if not tool_calls:
            break

        messages.append({"role": "assistant", "content": response.content})

        tool_results: list[dict[str, Any]] = []
        terminal_result = None

        for call in tool_calls:
            tool_name = call["name"]
            yield {
                "type": "tool_start",
                "name": tool_name,
                "description": TOOL_DESCRIPTIONS.get(tool_name, tool_name),
                "iteration": i + 1,
                "timestamp": time.time(),
            }

            tool_start = time.time()
            result = await _execute_tool(tool_name, call["input"])
            duration_ms = int((time.time() - tool_start) * 1000)

            # Extract fields for the event
            fields_extracted: dict[str, str] = {}
            if tool_name == "extract_document_fields":
                fields_extracted = call["input"].get("extracted_fields", {})
            elif tool_name == "report_prefill_results":
                fields_extracted = call["input"].get("known_data", {})
            elif tool_name == "lookup_crm_client":
                # Parse the JSON result to show extracted CRM fields
                try:
                    parsed = json.loads(result) if isinstance(result, str) else {}
                    fields_extracted = {k: str(v) for k, v in parsed.items() if v and k != "error"}
                except (json.JSONDecodeError, TypeError):
                    pass
            elif tool_name == "get_carrier_suitability":
                try:
                    parsed = json.loads(result) if isinstance(result, str) else {}
                    if "overall_score" in parsed:
                        fields_extracted["suitability_score"] = str(parsed["overall_score"])
                    if "rating" in parsed:
                        fields_extracted["suitability_rating"] = str(parsed["rating"])
                except (json.JSONDecodeError, TypeError):
                    pass
            elif tool_name == "get_advisor_preferences":
                try:
                    parsed = json.loads(result) if isinstance(result, str) else {}
                    if "advisor_name" in parsed:
                        fields_extracted["advisor_name"] = str(parsed["advisor_name"])
                    if "philosophy" in parsed:
                        fields_extracted["advisor_philosophy"] = str(parsed["philosophy"])
                except (json.JSONDecodeError, TypeError):
                    pass

            yield {
                "type": "tool_result",
                "name": tool_name,
                "fields_extracted": fields_extracted,
                "duration_ms": duration_ms,
                "iteration": i + 1,
                "timestamp": time.time(),
            }

            if isinstance(result, list):
                content = result
            else:
                content = result
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": content,
            })

            if tool_name == "report_prefill_results":
                terminal_result = call["input"]

        messages.append({"role": "user", "content": tool_results})

        if terminal_result:
            total_duration_ms = int((time.time() - agent_start) * 1000)
            yield {
                "type": "agent_complete",
                "known_data": terminal_result.get("known_data", {}),
                "sources_used": terminal_result.get("sources_used", []),
                "fields_found": terminal_result.get("fields_found", 0),
                "summary": terminal_result.get("summary", ""),
                "total_duration_ms": total_duration_ms,
                "timestamp": time.time(),
            }
            return

    # Fallback
    total_duration_ms = int((time.time() - agent_start) * 1000)
    yield {
        "type": "agent_complete",
        "known_data": {},
        "sources_used": [],
        "fields_found": 0,
        "summary": "Pre-fill agent was unable to gather data within the allowed iterations.",
        "total_duration_ms": total_duration_ms,
        "timestamp": time.time(),
    }
