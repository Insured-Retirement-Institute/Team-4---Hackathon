"""Main orchestrator: session management, turn handling, and phase transitions."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.models.conversation import (
    ConversationState,
    FieldStatus,
    Message,
    Role,
    SessionPhase,
    TrackedField,
)
from app.prompts.system_prompt import build_system_prompt
from app.services.eapp_client import submit_to_eapp
from app.services.extraction_service import build_tools_for_phase
from app.services.llm_service import LLMService
from app.services.prefill_agent import _execute_tool as execute_prefill_tool
from app.services.retell_service import retell_service
from app.services.validation_service import validate_field

logger = logging.getLogger(__name__)

TOOL_SOURCE_LABELS = {
    "lookup_crm_client": "Redtail CRM",
    "lookup_family_members": "Redtail CRM",
    "lookup_crm_notes": "CRM Notes",
    "lookup_prior_policies": "Prior Policies",
    "lookup_annual_statements": "Document Store",
    "extract_document_fields": "Document Store",
    "get_advisor_preferences": "Advisor Preferences",
    "get_carrier_suitability": "Suitability Check",
    "call_client": "Client Call",
}

ADVISOR_TOOL_NAMES = {
    "lookup_crm_client", "lookup_family_members", "lookup_crm_notes",
    "lookup_prior_policies", "lookup_annual_statements", "extract_document_fields",
    "get_advisor_preferences", "get_carrier_suitability", "call_client",
}

# In-memory session store
_sessions: dict[str, ConversationState] = {}


def get_session(session_id: str) -> ConversationState | None:
    return _sessions.get(session_id)


def create_session(
    questions: list[dict[str, Any]],
    known_data: dict[str, Any] | None = None,
    callback_url: str | None = None,
    model: str | None = None,
    advisor_name: str | None = None,
    client_context: dict[str, Any] | None = None,
) -> tuple[ConversationState, str]:
    """Create a new conversation session.

    Args:
        questions: Step definitions with field definitions.
        known_data: Pre-populated field values (unconfirmed).
        callback_url: URL to POST final data to on submit.
        model: Optional LLM model override.
        advisor_name: Name of the advisor (used in greeting).

    Returns (state, greeting_message).
    """
    session_id = str(uuid.uuid4())
    known_data = known_data or {}

    # Initialize tracked fields from questions
    fields: dict[str, TrackedField] = {}
    steps: list[dict[str, Any]] = []

    for step_def in questions:
        step_raw = {
            "step_id": step_def.get("step_id", ""),
            "title": step_def.get("title", ""),
            "fields": step_def.get("fields", []),
        }
        steps.append(step_raw)

        for field_def in step_def.get("fields", []):
            fid = field_def["field_id"]
            known_value = known_data.get(fid)
            fields[fid] = TrackedField(
                field_id=fid,
                value=known_value,
                status=FieldStatus.UNCONFIRMED if known_value is not None else FieldStatus.MISSING,
                label=field_def.get("label", fid),
                field_type=field_def.get("type", "text"),
                required=field_def.get("required", False),
                validation=field_def.get("validation", {}),
                options=field_def.get("options"),
                conditions=field_def.get("conditions"),
            )

    # Determine initial phase
    has_unconfirmed = any(f.status == FieldStatus.UNCONFIRMED for f in fields.values())
    initial_phase = SessionPhase.SPOT_CHECK if has_unconfirmed else SessionPhase.COLLECTING

    state = ConversationState(
        session_id=session_id,
        phase=initial_phase,
        fields=fields,
        steps=steps,
        callback_url=callback_url,
        model_override=model,
        advisor_name=advisor_name,
        client_context=client_context,
    )

    # Generate greeting
    llm = LLMService(model=model)
    greeting = _generate_greeting(llm, state, advisor_name=advisor_name)

    state.messages.append(Message(role=Role.ASSISTANT, content=greeting))
    _sessions[session_id] = state

    return state, greeting


async def handle_message(
    session_id: str,
    user_message: str,
) -> tuple[str, list[dict[str, Any]], list[dict[str, str]]]:
    """Process a user message and return (reply, updated_fields, tool_calls_info).

    Orchestrates: prompt build -> tool generation -> LLM call -> tool handling ->
    validation -> phase transition -> return reply.
    """
    state = _sessions.get(session_id)
    if not state:
        raise ValueError(f"Session {session_id} not found")

    # Don't process messages in terminal phases
    if state.phase in (SessionPhase.COMPLETE, SessionPhase.SUBMITTED):
        return "This session is already complete.", []

    state.messages.append(Message(role=Role.USER, content=user_message))

    llm = LLMService(model=state.model_override)
    system_prompt = build_system_prompt(state)
    tools = build_tools_for_phase(state)
    llm_messages = _build_llm_messages(state)

    # Advisor-mode: don't force tools, let LLM decide
    force_tool = not bool(state.advisor_name)
    response = llm.chat(system_prompt, llm_messages, tools=tools or None, force_tool=force_tool if tools else False)

    # Process tool calls
    updated_fields: list[dict[str, Any]] = []
    tool_calls = llm.extract_tool_calls(response)

    if tool_calls:
        # Separate advisor tools from field extraction/confirmation tools

        advisor_tool_calls = [tc for tc in tool_calls if tc["name"] in ADVISOR_TOOL_NAMES]
        field_tool_calls = [tc for tc in tool_calls if tc["name"] not in ADVISOR_TOOL_NAMES]

        # Process field extraction/confirmation tools
        tool_results: dict[str, Any] = {}
        if field_tool_calls:
            field_results = process_tool_calls(field_tool_calls, state)
            updated_fields = field_results.get("updated_fields", [])
            tool_results.update(field_results)

        # Process advisor tools (async)
        for tc in advisor_tool_calls:
            try:
                if tc["name"] == "call_client":
                    # Initiate Retell call
                    call_input = tc.get("input", {})
                    missing = [{"id": f, "label": f} for f in call_input.get("missing_fields", [])]
                    call_result = await retell_service.create_outbound_call(
                        to_number=call_input.get("phone_number", ""),
                        missing_fields=missing,
                        client_name=call_input.get("client_name", ""),
                        advisor_name=state.advisor_name or "",
                    )
                    tool_results[tc["id"]] = json.dumps({
                        "status": "call_initiated",
                        "call_id": call_result.get("call_id", ""),
                        "message": f"Call initiated to {call_input.get('client_name', 'client')}. "
                                   "The AI agent will collect the missing information.",
                    })
                else:
                    result = await execute_prefill_tool(tc["name"], tc.get("input", {}))
                    tool_results[tc["id"]] = result if isinstance(result, str) else json.dumps(result)
            except Exception as e:
                logger.exception("Advisor tool %s failed", tc["name"])
                tool_results[tc["id"]] = json.dumps({"error": str(e)})

        # Follow-up LLM call with tool results for natural language response
        follow_up_messages = llm_messages.copy()
        follow_up_messages.append({"role": "assistant", "content": response.content})

        # Combine all tool results into one user message
        tool_result_blocks = []
        for tc in tool_calls:
            result_content = tool_results.get(tc["id"], "OK")
            if isinstance(result_content, list):
                # Document content blocks (images/PDFs)
                tool_result_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": result_content,
                })
            else:
                tool_result_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": str(result_content),
                })
        follow_up_messages.append({"role": "user", "content": tool_result_blocks})

        follow_up = llm.chat(system_prompt, follow_up_messages, tools=tools or None, force_tool=False)
        reply_text = llm.extract_text(follow_up)
    else:
        reply_text = llm.extract_text(response)

    # Build tool call info for frontend (include result data + source labels)
    tool_calls_info = []
    if tool_calls:
        for tc in tool_calls:
            info: dict[str, Any] = {
                "name": tc["name"],
                "source_label": TOOL_SOURCE_LABELS.get(tc["name"]),
            }
            raw = tool_results.get(tc["id"])
            if raw and tc["name"] in ADVISOR_TOOL_NAMES and isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict) and "error" not in parsed:
                        info["result_data"] = parsed
                except (json.JSONDecodeError, TypeError):
                    pass
            tool_calls_info.append(info)

    # Phase transitions
    maybe_advance_phase(state)

    state.messages.append(Message(
        role=Role.ASSISTANT,
        content=reply_text,
        extracted_fields={uf["field_id"]: uf.get("value") for uf in updated_fields} or None,
    ))

    return reply_text, updated_fields, tool_calls_info


async def submit_session(session_id: str) -> dict[str, Any]:
    """Submit collected data to the callback URL."""
    state = _sessions.get(session_id)
    if not state:
        raise ValueError(f"Session {session_id} not found")

    if state.phase == SessionPhase.SUBMITTED:
        return {"status": "already_submitted", "field_count": len(state.application_data())}

    if state.phase not in (SessionPhase.COMPLETE, SessionPhase.REVIEWING):
        # Allow submit from reviewing too in case caller wants to force it
        missing = state.missing_required()
        if missing:
            return {
                "status": "incomplete",
                "errors": [f"Missing required field: {f.label}" for f in missing],
                "field_count": len(state.application_data()),
            }

    app_data = state.application_data()

    if state.callback_url:
        try:
            await submit_to_eapp(state.callback_url, app_data)
        except Exception as e:
            logger.exception("eApp submission failed")
            return {
                "status": "submission_failed",
                "errors": [str(e)],
                "field_count": len(app_data),
            }

    state.phase = SessionPhase.SUBMITTED
    state.submitted_at = datetime.now(timezone.utc)

    return {
        "status": "submitted",
        "field_count": len(app_data),
        "submitted_at": state.submitted_at,
    }


def _generate_greeting(llm: LLMService, state: ConversationState, advisor_name: str | None = None) -> str:
    """Generate an initial greeting message."""

    if state.phase == SessionPhase.SPOT_CHECK:
        system_prompt = build_system_prompt(state)
        unconfirmed = state.unconfirmed_fields()
        field_summary = ", ".join(f"{f.label}: {f.value}" for f in unconfirmed[:5])
        more = f" (and {len(unconfirmed) - 5} more)" if len(unconfirmed) > 5 else ""
        name_part = f" Address the advisor as {advisor_name}." if advisor_name else ""
        instruction = (
            f"Generate a friendly greeting.{name_part} We have some information on file already. "
            f"Summarize this known data naturally: {field_summary}{more}. "
            "Ask if it all looks correct."
        )
        messages = [{"role": "user", "content": instruction}]
        response = llm.chat(system_prompt, messages)
        return llm.extract_text(response)

    # For COLLECTING phase, return a greeting
    name = advisor_name or "there"
    if state.client_context:
        client_name = state.client_context.get("display_name", "your client")
        return (
            f"Hi {name}! I see you've selected {client_name}. "
            f"I'll pull up their information right away. Just say the word and "
            f"I'll search the CRM, review their documents, and check their policies."
        )
    return f"Hi {name}! What client would you like to work on today?"


def _build_llm_messages(state: ConversationState) -> list[dict[str, Any]]:
    """Convert conversation history to Anthropic message format.

    The Anthropic API requires the first message to be a 'user' role.
    If the history starts with an assistant message (the greeting), we
    prepend a synthetic user message so the API is happy.
    """
    msgs = [
        {"role": msg.role.value, "content": msg.content}
        for msg in state.messages
    ]
    if msgs and msgs[0]["role"] == "assistant":
        msgs.insert(0, {"role": "user", "content": "Hello, let's get started."})
    return msgs


def process_tool_calls(
    tool_calls: list[dict[str, Any]],
    state: ConversationState,
) -> dict[str, Any]:
    """Process tool calls, validate extracted fields, and return results."""
    results: dict[str, Any] = {}
    updated_fields: list[dict[str, Any]] = []

    for tc in tool_calls:
        name = tc["name"]
        inp = tc["input"]
        tc_id = tc["id"]

        if name == "extract_application_fields":
            field_updates = []
            for field_id, value in inp.items():
                if value is None:
                    continue
                field = state.fields.get(field_id)
                if not field:
                    continue

                # Validate
                is_valid, error = validate_field(field, value)
                if is_valid:
                    field.value = value
                    field.status = FieldStatus.COLLECTED
                    field.validation_error = None
                    field_updates.append(field_id)
                    updated_fields.append({
                        "field_id": field_id,
                        "status": FieldStatus.COLLECTED.value,
                        "value": value,
                    })
                else:
                    field.validation_error = error
                    updated_fields.append({
                        "field_id": field_id,
                        "status": field.status.value,
                        "validation_error": error,
                    })

            if field_updates:
                results[tc_id] = f"Accepted fields: {field_updates}"
            else:
                errors = [f.validation_error for f in state.fields.values() if f.validation_error]
                results[tc_id] = f"Validation errors: {errors}"

        elif name == "confirm_known_fields":
            confirmed_ids = inp.get("field_ids", [])
            confirmed = []
            for fid in confirmed_ids:
                field = state.fields.get(fid)
                if field and field.status in (FieldStatus.UNCONFIRMED, FieldStatus.CONFIRMED, FieldStatus.COLLECTED):
                    field.status = FieldStatus.CONFIRMED
                    field.validation_error = None
                    confirmed.append(fid)
                    updated_fields.append({
                        "field_id": fid,
                        "status": FieldStatus.CONFIRMED.value,
                        "value": field.value,
                    })
            results[tc_id] = f"Confirmed fields: {confirmed}"

        else:
            results[tc_id] = f"Unknown tool: {name}"

    results["updated_fields"] = updated_fields
    return results


def maybe_advance_phase(state: ConversationState) -> None:
    """Check conditions and advance the session phase if appropriate."""
    if state.phase == SessionPhase.SPOT_CHECK:
        # Move to collecting once no unconfirmed fields remain
        if not state.unconfirmed_fields():
            state.phase = SessionPhase.COLLECTING
            logger.info("Phase transition: spot_check -> collecting")

    if state.phase == SessionPhase.COLLECTING:
        # Move to reviewing once all required fields are resolved
        if state.all_required_resolved():
            state.phase = SessionPhase.REVIEWING
            logger.info("Phase transition: collecting -> reviewing")

    if state.phase == SessionPhase.REVIEWING:
        # Move to complete once user confirms (all fields confirmed/collected with no unconfirmed)
        # This happens when confirm_known_fields is called in reviewing phase
        active = state.active_fields()
        all_resolved = all(
            f.status in (FieldStatus.CONFIRMED, FieldStatus.COLLECTED)
            for f in active if f.required
        )
        # Check if we just got confirmation in review (no unconfirmed)
        has_unconfirmed = any(f.status == FieldStatus.UNCONFIRMED for f in active)
        if all_resolved and not has_unconfirmed and state.all_required_resolved():
            # Only advance to COMPLETE if there were confirm tool calls in this turn
            # We check by seeing if we're already in REVIEWING and all is good
            pass  # Caller will advance via submit endpoint
