# AI Service

## Overview

Conversational AI agent for annuity e-applications. FastAPI + Claude Haiku 4.5 via AWS Bedrock. Guides users through application fields via natural language, extracts and validates data using tool calls.

## Commands

```bash
source venv/Scripts/activate                                    # Activate venv (Windows)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001      # Run locally
pytest                                                          # Run tests
```

## Conversation State Machine

**Phases:** `SPOT_CHECK` → `COLLECTING` → `REVIEWING` → `COMPLETE` → `SUBMITTED`

- **SPOT_CHECK** — Confirms pre-populated `known_data` values. Advances when no unconfirmed fields remain.
- **COLLECTING** — Gathers missing required fields. Advances when `all_required_resolved()` is true.
- **REVIEWING** — User confirms all collected data. Advances on user confirmation.
- **COMPLETE** — All fields resolved. Awaits submission call.
- **SUBMITTED** — After `submit_session()` POSTs data to callback URL.

**Field Statuses:** `MISSING` → `UNCONFIRMED` | `COLLECTED` | `CONFIRMED`

## LLM Integration

**Model:** `us.anthropic.claude-haiku-4-5-20251001-v1:0` — the `us.` prefix is required for newer Bedrock inference profiles.

**Two-call pattern** (critical for Haiku/Sonnet):
1. First call: `tool_choice={"type": "any"}` — forces the model to use extraction tools
2. Follow-up call: `force_tool=False` — gets natural language reply with tool results in context

Without this pattern, the model either skips tools or returns empty text responses.

**AWS credentials** must be explicitly passed to `AnthropicBedrock()` — the system credential chain resolves to a different account.

**Message format:** Anthropic API requires alternating user/assistant roles. Tool results must be combined into a single user message to avoid role errors.

## Tool Definitions

Built dynamically per phase by `extraction_service.py`:

- **`extract_application_fields`** — Extracts field values from user input. Schema generated from active fields with validation constraints.
- **`confirm_known_fields`** — Confirms pre-populated values are correct (used in SPOT_CHECK and REVIEWING phases).

Phase determines which tools are available and which fields they target.

## System Prompt

`app/prompts/system_prompt.py` — `build_system_prompt(state)` generates phase-aware prompt:
1. **Persona** — Warm, professional, conversational. Never use emojis.
2. **Phase instructions** — Different guidance per phase (what to ask, when to advance)
3. **Field context** — Groups active fields by status (missing, unconfirmed, confirmed, collected, errors)
4. **Tool instructions** — When to use each extraction tool

## Schema Adapter

`app/services/schema_adapter.py` — `adapt_eapp_schema(eapp)` transforms backend product JSON into flat question list for session creation. Maps question types, validation rules, and visibility conditions.

Exposed via `GET /api/v1/demo/midland-schema` — frontend fetches this before creating a session.

## API Endpoints

All routes under `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create session (requires `questions` array + optional `known_data`) |
| GET | `/sessions/{id}` | Get session state |
| POST | `/sessions/{id}/message` | Send message → reply + `updated_fields` |
| POST | `/sessions/{id}/submit` | Submit completed application |
| GET | `/demo/midland-schema` | Fetch adapted product schema |
| GET | `/health` | Health check |

## API Flow

1. Frontend fetches `/demo/midland-schema` → adapted question list
2. Frontend POSTs `/sessions` with questions + optional `known_data` → session ID + greeting
3. User messages go to `/sessions/{id}/message`:
   - Build phase-aware system prompt
   - First LLM call (forced tools) → extract/confirm fields
   - Process tool results → validate fields → update statuses
   - Follow-up LLM call (natural language) → assistant reply
   - Check phase transitions → return reply + updated_fields + phase
4. Frontend calls `/sessions/{id}/submit` when complete

## Config

`app/config.py` — Pydantic `BaseSettings`, reads from `.env`:

| Env Var | Default | Notes |
|---------|---------|-------|
| `BEDROCK_MODEL` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Must be just the model ID, not `BEDROCK_MODEL=...` |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` | — | Required, explicit |
| `AWS_SECRET_ACCESS_KEY` | — | Required, explicit |
| `AWS_SESSION_TOKEN` | — | Required, explicit |
| `HOST` | `0.0.0.0` | |
| `PORT` | `8000` | Use 8001 locally to avoid conflicts |

## Key Files

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, CORS, route registration |
| `app/services/llm_service.py` | Bedrock client, chat/stream methods, tool extraction |
| `app/services/conversation_service.py` | Session store, message handling, phase transitions |
| `app/services/extraction_service.py` | Tool definitions, field validation, phase-aware tool sets |
| `app/services/schema_adapter.py` | eApp JSON → internal question format |
| `app/models/conversation.py` | Enums, TrackedField, ConversationState, condition evaluator |
| `app/prompts/system_prompt.py` | Phase-aware system prompt builder |
| `app/config.py` | Pydantic settings |
