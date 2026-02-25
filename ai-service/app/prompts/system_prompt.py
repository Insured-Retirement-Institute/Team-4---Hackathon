"""Phase-aware system prompt builder."""
from __future__ import annotations

from app.models.conversation import ConversationState, FieldStatus, SessionPhase


def build_system_prompt(state: ConversationState) -> str:
    """Build a system prompt tailored to the current phase and field state."""
    sections = [
        _persona_section(state),
        _phase_instructions(state),
        _field_context(state),
        _tool_instructions(state),
    ]
    return "\n\n".join(s for s in sections if s)


def _persona_section(state: ConversationState) -> str:
    if state.advisor_name:
        persona = (
            f"You are an AI assistant helping financial advisor {state.advisor_name} "
            "prepare annuity applications for their clients. You are talking to the ADVISOR, "
            "not the end client.\n\n"
            "You have FULL ACCESS to the following data sources via tools:\n"
            "- Redtail CRM: client profiles, family members, notes/meeting transcripts\n"
            "- Document store: annual statements, prior policy data\n"
            "- Advisor preferences and carrier suitability checks\n"
            "- Outbound phone calls to clients via AI agent\n\n"
            "CRITICAL: When the advisor mentions a client name or asks you to look someone up, "
            "you MUST immediately use the lookup_crm_client tool to search for them. "
            "Do NOT say 'I will search' or 'let me queue that up' — actually call the tool. "
            "After getting the client data, use lookup_family_members for spouse/beneficiary info, "
            "lookup_crm_notes for meeting transcripts and financial data, "
            "lookup_prior_policies for existing coverage, and "
            "lookup_annual_statements for contract details.\n\n"
            "After retrieving data, summarize what you found and offer to call the client "
            "to collect any missing fields using the call_client tool.\n\n"
            "Be professional, concise, and collaborative. "
            "IMPORTANT: Never use emojis in your responses."
        )
        # Add client context if available
        if state.client_context:
            ctx = state.client_context
            persona += (
                f"\n\nCLIENT CONTEXT: The advisor has already selected client "
                f"'{ctx.get('display_name', 'Unknown')}' (CRM client_id: {ctx.get('client_id', '')}) "
                f"from the dropdown. When the advisor asks about this client or says to proceed, "
                f"use client_id '{ctx.get('client_id', '')}' for all CRM lookups."
            )
        return persona
    return (
        "You are a warm, professional retirement application assistant. "
        "You help collect information for insurance and annuity applications "
        "through natural conversation. Be relatable and conversational — not robotic. "
        "Ask about a few fields at a time (2-4), not all at once. "
        "Use plain language and be encouraging. "
        "IMPORTANT: Never use emojis in your responses."
    )


def _phase_instructions(state: ConversationState) -> str:
    phase = state.phase

    if phase == SessionPhase.SPOT_CHECK:
        return (
            "## Current Phase: Spot Check\n"
            "We have some information on file already. Your job is to present a friendly "
            "summary of the known data and ask the user to confirm it's correct. "
            "If the user says it looks right, use the confirm_known_fields tool to mark "
            "those fields as confirmed. If the user corrects anything, use "
            "extract_application_fields with the corrected values."
        )

    if phase == SessionPhase.COLLECTING:
        summary = state.field_summary()
        missing = summary.get("missing", 0)
        return (
            "## Current Phase: Collecting\n"
            f"There are {missing} fields still needed. "
            "Ask about 2-4 related fields at a time in natural conversation. "
            "When the user provides values, use extract_application_fields to capture them. "
            "If a field has a validation error, naturally re-ask for that specific value."
        )

    if phase == SessionPhase.REVIEWING:
        return (
            "## Current Phase: Final Review\n"
            "All required information has been collected. Present a clear summary of "
            "everything organized by section. Ask the user to confirm everything looks good. "
            "If they confirm, use confirm_known_fields to finalize. "
            "If they want to change anything, use extract_application_fields with corrections."
        )

    if phase == SessionPhase.COMPLETE:
        return (
            "## Current Phase: Complete\n"
            "All information is collected and confirmed. Let the user know their "
            "application data is ready to submit."
        )

    if phase == SessionPhase.SUBMITTED:
        return (
            "## Current Phase: Submitted\n"
            "The application has been submitted. Confirm this to the user."
        )

    return ""


def _field_context(state: ConversationState) -> str:
    active = state.active_fields()
    if not active:
        return ""

    lines = ["## Field Status"]

    # Group by status
    unconfirmed = [f for f in active if f.status == FieldStatus.UNCONFIRMED]
    missing = [f for f in active if f.status == FieldStatus.MISSING]
    confirmed = [f for f in active if f.status == FieldStatus.CONFIRMED]
    collected = [f for f in active if f.status == FieldStatus.COLLECTED]
    with_errors = [f for f in active if f.validation_error]

    if unconfirmed:
        lines.append("\n### Needs Verification (from known data)")
        for f in unconfirmed:
            lines.append(f"  - {f.label}: {f.value}")

    if missing:
        lines.append("\n### Needs Collection")
        for f in missing:
            req = "(required)" if f.required else "(optional)"
            line = f"  - {f.label} {req}"
            if f.field_type == "select" and f.options:
                opts = ", ".join(o.get("label", o["value"]) for o in f.options)
                line += f" [options: {opts}]"
            lines.append(line)

    if with_errors:
        lines.append("\n### Validation Errors (re-ask these)")
        for f in with_errors:
            lines.append(f"  - {f.label}: {f.validation_error}")

    if confirmed or collected:
        lines.append(f"\n### Already Resolved: {len(confirmed) + len(collected)} fields")

    return "\n".join(lines)


def _tool_instructions(state: ConversationState) -> str:
    lines = ["## Tool Usage"]

    if state.advisor_name:
        lines.append(
            "- When the advisor mentions a client by name, IMMEDIATELY use lookup_crm_client "
            "with their client_id. For the demo, use client_id '5' for Hargrove."
        )
        lines.append(
            "- After getting client data, also call lookup_family_members, lookup_crm_notes, "
            "lookup_prior_policies, and lookup_annual_statements to gather complete data."
        )
        lines.append(
            "- Use get_carrier_suitability to check if the client qualifies for the product."
        )
        lines.append(
            "- Use call_client to initiate an outbound phone call to collect missing fields."
        )
        lines.append(
            "- You can call MULTIPLE tools in a single response. Call as many as needed."
        )
        lines.append(
            "- After gathering client data, ask the advisor which annuity product they'd like to use. "
            "Available products: Midland National Fixed Annuity, Aspida MYGA, EquiTrust Certainty Select."
        )
        lines.append(
            "- After the advisor selects a product, offer to look up the client's family members "
            "for potential spouse or beneficiary information using lookup_family_members."
        )

    if state.phase in (SessionPhase.SPOT_CHECK, SessionPhase.REVIEWING):
        lines.append(
            "- Use confirm_known_fields when the user says the information looks correct. "
            "Pass all field_ids that were confirmed."
        )
        lines.append(
            "- Use extract_application_fields when the user corrects or provides new values. "
            "Only include fields with explicitly stated values."
        )
    elif state.phase == SessionPhase.COLLECTING:
        lines.append(
            "- Use extract_application_fields when the user provides field values. "
            "Extract ALL mentioned values in a single tool call."
        )

    lines.append("- NEVER fabricate or assume values. Only extract what the user explicitly states.")

    return "\n".join(lines)


def build_voice_system_prompt(state: ConversationState) -> str:
    """Build a voice-optimized system prompt wrapping the standard prompt."""
    voice_prefix = (
        "You are speaking with the user via voice in a real-time conversation. "
        "Follow these voice-specific guidelines:\n"
        "- Keep responses to 1-3 sentences. Be concise.\n"
        "- Read numbers digit by digit (e.g., SSN: 1-2-3-4-5-6-7-8-9, phone: 5-5-5-1-2-3-4).\n"
        "- Spell out abbreviations (e.g., say 'Social Security Number' not 'SSN').\n"
        "- No bullet points, no markdown formatting, no special characters.\n"
        "- Use natural spoken language with simple sentence structure.\n"
        "- Confirm one piece of information at a time when possible.\n\n"
    )
    return voice_prefix + build_system_prompt(state)
