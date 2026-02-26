# AI Service

## Overview

Conversational AI agent for annuity e-applications. FastAPI + Claude Haiku 4.5 via AWS Bedrock (text) and AWS Nova Sonic via `aws_sdk_bedrock_runtime` (voice). Guides users through application fields via natural language or real-time voice, extracts and validates data using tool calls. Requires Python 3.12+.

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

**Advisor mode exception:** When `state.advisor_name` is set, `force_tool=False` on the first call too — the LLM decides when to call tools based on the conversation. The system prompt strongly instructs the LLM to use CRM tools when the advisor mentions a client.

**AWS credentials** must be explicitly passed to `AnthropicBedrock()` — the system credential chain resolves to a different account.

**Message format:** Anthropic API requires alternating user/assistant roles. Tool results must be combined into a single user message to avoid role errors.

## Tool Definitions

Built dynamically per phase by `extraction_service.py`:

- **`extract_application_fields`** — Extracts field values from user input. Schema generated from active fields with validation constraints.
- **`confirm_known_fields`** — Confirms pre-populated values are correct (used in SPOT_CHECK and REVIEWING phases).

Phase determines which tools are available and which fields they target.

**Advisor tools:** When `state.advisor_name` is set, `build_tools_for_phase()` prepends the full `ADVISOR_TOOLS` list (9 tools) to the phase-specific tools. These are the same tools used by the prefill agent but available interactively in the chat:
- `lookup_crm_client`, `lookup_family_members`, `lookup_crm_notes` — Redtail CRM lookups
- `lookup_prior_policies`, `lookup_annual_statements` — Policy/document data
- `extract_document_fields` — LLM document analysis
- `get_advisor_preferences`, `get_carrier_suitability` — Advisor prefs and suitability scoring
- `call_client` — Initiates Retell AI outbound phone call

In `handle_message()`, advisor tool calls are separated from field tools and executed async via `execute_prefill_tool()` (or `retell_service.create_outbound_call()` for `call_client`). Tool results are combined into a single user message for the follow-up LLM call.

**Tool result surfacing:** `ToolCallInfo` response model includes `result_data` (parsed JSON from tool execution, excluding errors) and `source_label` (human-readable source name from `TOOL_SOURCE_LABELS` mapping in `conversation_service.py`). Frontend uses these to populate field mapping panels with source attribution. Source labels: "Redtail CRM", "CRM Notes", "Prior Policies", "Document Store", "Advisor Preferences", "Suitability Check", "Client Call".

## System Prompt

`app/prompts/system_prompt.py` — `build_system_prompt(state)` generates phase-aware prompt:
1. **Persona** — Two modes: (a) warm, professional client-facing assistant, or (b) advisor-facing assistant when `state.advisor_name` is set. Advisor mode lists available data sources, instructs LLM to immediately use CRM tools, and includes `client_context` (selected client's CRM ID + name) if available. Never use emojis.
2. **Phase instructions** — Different guidance per phase (what to ask, when to advance)
3. **Field context** — Groups active fields by status (missing, unconfirmed, confirmed, collected, errors)
4. **Tool instructions** — When to use each extraction tool. Advisor mode adds instructions for CRM lookups, suitability checks, client calls, product selection guidance (asks advisor which annuity product), and family member lookup suggestions.

`build_voice_system_prompt(state)` wraps the standard prompt with voice-specific guidelines: 1-3 sentence responses, digit-by-digit number reading, no markdown/bullets, natural spoken language.

## Schema Adapter

`app/services/schema_adapter.py` — `adapt_eapp_schema(eapp)` transforms backend product JSON into flat question list for session creation. Maps question types, validation rules, and visibility conditions.

Exposed via `GET /api/v1/demo/midland-schema` — frontend fetches this before creating a session.

## API Endpoints

All routes under `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create session (`questions` array defaults to `[]` + optional `known_data`, `advisor_name`, `client_context`) |
| GET | `/sessions/{id}` | Get session state |
| POST | `/sessions/{id}/message` | Send message → reply + `updated_fields` + `tool_calls` |
| POST | `/sessions/{id}/submit` | Submit completed application |
| GET | `/demo/midland-schema` | Fetch adapted product schema |
| GET | `/prefill/clients` | List CRM clients for dropdown selection |
| POST | `/prefill` | Run pre-fill agent for a CRM client (`{client_id, advisor_id?}` in body) |
| POST | `/prefill/stream` | SSE streaming pre-fill agent — same as `/prefill` but returns `text/event-stream` with real-time tool call events |
| POST | `/prefill/document` | Run pre-fill agent with uploaded document (multipart form: `file` + optional `client_id`) |
| WS | `/sessions/{id}/voice` | Real-time voice conversation via Nova Sonic (WebSocket) |
| POST | `/retell/calls` | Initiate Retell outbound call (`{to_number, missing_fields, client_name, advisor_name}`) |
| GET | `/retell/calls/{id}` | Poll call status (checks webhook cache, falls back to Retell API) |
| POST | `/retell/webhook` | Retell webhook handler (`call_started`, `call_ended`, `call_analyzed` events) |
| GET | `/health` | Health check |

## Nova Sonic Voice Integration

**Model:** `amazon.nova-sonic-v1:0` — speech-to-speech on Bedrock via `aws_sdk_bedrock_runtime` (Python SDK, requires 3.12+).

**How it works:** `NovaSonicStreamManager` opens a bidirectional stream to Bedrock. The WebSocket route (`voice.py`) runs two concurrent async tasks: `ws_to_nova` (browser audio → Nova Sonic) and `nova_to_ws` (Nova Sonic audio/transcript/tool events → browser). Audio format: 16kHz 16-bit PCM mono in, 24kHz 16-bit PCM mono out, base64-encoded.

**Session setup sequence:** `sessionStart` (inference config) → `promptStart` (audio/text output config, voice ID, all tools upfront) → system prompt as TEXT content block. All tools from `build_tools_for_phase()` are provided at stream start, converted from Anthropic format via `tool_adapter.py`. Phase-specific guidance in the system prompt controls which tools the model uses. After setup, `send_initial_greeting()` sends a text USER prompt to trigger Nova Sonic to speak first (called from `voice.py` right after `start_session()`).

**Tool call bridging:** When Nova Sonic emits a `toolUse` event, the manager normalizes it to `{id, name, input}`. If `tool_name in ADVISOR_TOOL_NAMES`, the tool is routed through `execute_prefill_tool()` and a `tool_call_info` WebSocket message is emitted with `result_data` and `source_label` (same format as text mode). Otherwise, the tool goes through the existing `process_tool_calls()` path from `conversation_service.py`, sending `field_update` to the browser via WebSocket. In both cases, `maybe_advance_phase()` is called and the `toolResult` event is sent back to Nova Sonic so the model resumes speaking.

**Session sharing:** Voice and text modes read/write the **same `ConversationState`** from the in-memory `_sessions` store. They use different LLMs (Nova Sonic vs Claude) but share fields, phase, and tool processing. The system prompt includes full field context, so either model picks up seamlessly when switching modes.

**WebSocket protocol (JSON over WS):**
- Client → Server: `{"type":"audio","data":"<b64>"}`, `{"type":"end_session"}`
- Server → Client: `{"type":"audio","data":"<b64>"}`, `{"type":"transcript","role":"assistant"|"user","text":"..."}`, `{"type":"field_update","fields":[...]}`, `{"type":"tool_call_info","tool_call":{...}}` (advisor tool results with `result_data` + `source_label`), `{"type":"phase_change","phase":"..."}`, `{"type":"error","message":"..."}`, `{"type":"session_ended"}`

**Config:** `NOVA_SONIC_MODEL` (default `amazon.nova-sonic-v1:0`), `NOVA_SONIC_VOICE` (default `tiffany`, options: matthew, tiffany, amy, lupe, carlos). Reuses existing AWS credentials. **Note:** App Runner does not support WebSockets — voice requires EC2 or ECS+ALB deployment.

**Frontend integration:** `useVoiceConnection` hook handles `getUserMedia()` for mic (16kHz PCM mono), `AudioContext` for playback (24kHz), WebSocket messaging. `VoicePanel` component renders mic button with pulse animation and scrolling transcript. `field_update` messages fire `iri:field_updated` CustomEvents for wizard sync.

## Pre-Fill Agent

`app/services/prefill_agent.py` — LLM-orchestrated agent that gathers client data from external sources before the application begins, feeding results into the existing `known_data` → SPOT_CHECK flow.

**Agent tools** (9 tools, Anthropic tool_use format):
- `lookup_crm_client` — Queries live Redtail CRM API (`RedtailCRM`) for client profile (name, DOB, SSN, contact, address, occupation, employer, citizenship). Deterministic field mapping from API response. Maps both owner and annuitant fields with dual-ID aliases (e.g. `owner_dob` + `owner_date_of_birth`).
- `lookup_family_members` — Queries Redtail family API (`GET /contacts/{id}/family`). Fetches full contact record for each member (spouse, children). Returns structured data the LLM maps to `joint_owner_*` fields (spouse) and beneficiary fields (children). Infers "spouse" relationship for HOH members with null relationship_name.
- `lookup_crm_notes` — Fetches CRM notes/activity records for a client. Notes contain meeting transcripts with rich unstructured data (income, net worth, risk tolerance, goals, family). LLM extracts financial fields from note text.
- `lookup_prior_policies` — Queries `MockPolicySystem` for suitability data (income, net worth, risk tolerance, investment details)
- `lookup_annual_statements` — Fetches latest annual statement PDF from S3 (`S3StatementStore`)
- `extract_document_fields` — LLM extracts fields from uploaded/retrieved document via vision
- `get_advisor_preferences` — Fetches advisor profile from S3 (`S3AdvisorPrefsStore`): philosophy, preferred carriers, allocation strategy, suitability thresholds
- `get_carrier_suitability` — Fetches carrier guidelines from S3 (`S3SuitabilityStore`), runs weighted scoring engine against client data. Returns score, rating, and per-criterion breakdown
- `report_prefill_results` — Terminal tool, returns combined `{known_data, sources_used, fields_found, summary}`

**Agent loop:** `run_prefill_agent(client_id, document_base64, document_media_type, advisor_id)` — up to 10 iterations with `force_tool=True`. Terminates when `report_prefill_results` is called. Uses same `LLMService.chat()` and `extract_tool_calls()` as the conversation flow.

**Streaming agent loop:** `run_prefill_agent_stream(...)` — async generator wrapping the same agent loop. Yields SSE event dicts at each step: `agent_start` (beginning), `tool_start` (before each tool execution, with display name/description), `tool_result` (after each tool, with `fields_extracted`, `duration_ms`), `agent_complete` (final results with `known_data`, `sources_used`, `total_duration_ms`). Used by `POST /prefill/stream` via `StreamingResponse`. `TOOL_DESCRIPTIONS` dict maps tool names to human-readable descriptions for the frontend log UI.

**Data sources** (`app/services/datasources/`):
- `RedtailClient` — Async HTTP client for Redtail CRM API. Two-step auth (Basic → UserKey with 1hr cache), 401 retry, typed methods for contacts/addresses/phones/emails/notes/family.
- `RedtailCRM` — `DataSource` impl wrapping `RedtailClient`. `list_clients()` paginates contacts (Individual type filter). `query({client_id})` fetches contact+addresses+phones+emails via `asyncio.gather()`, deterministic field mapping to ~35 app fields (owner + annuitant + address + occupation + citizenship), copies owner→annuitant. `get_notes(contact_id)` fetches notes with HTML stripping. `get_family_members(contact_id)` fetches family, enriches each member with full contact data.
- `MockRedtailCRM` — Legacy mock CRM (4 hardcoded clients: Whitfield, Morales, Hargrove, Pemberton). Kept for reference/testing but no longer used in production flow.
- `MockPolicySystem` — 10 suitability/financial fields per client (income, net worth, risk tolerance, investment details). Used as fallback when CRM notes lack financial data.
- `S3StatementStore` — Fetches annual statement PDFs from S3 bucket (`statements/{client_id}/`).
- `S3AdvisorPrefsStore` — Fetches advisor preference profiles from S3 (`advisors/{advisor_id}/profile.json`). Default advisor: Andrew Barnett (`advisor_002`, balanced). Other profiles: advisor_001 (conservative), advisor_003 (accumulation).
- `S3SuitabilityStore` — Fetches carrier suitability guidelines from S3 (`suitability/{carrier_id}/guidelines.json`) and runs `evaluate_suitability()` weighted scoring. 3 carriers: midland-national, aspida, equitrust.
- `DataSource` base class — `async query(params) -> dict` and `available_fields() -> list[str]`.

**Response format:** `{known_data: dict, sources_used: list[str], fields_found: int, summary: str}`

## API Flow

1. Frontend fetches `/demo/midland-schema` → adapted question list (skipped for product-agnostic advisor sessions)
2. Frontend POSTs `/sessions` with `questions` (defaults to `[]`) + optional `known_data`, `advisor_name`, `client_context` → session ID + greeting
3. User messages go to `/sessions/{id}/message`:
   - Build phase-aware system prompt (advisor vs client persona)
   - First LLM call (forced tools for client mode, optional for advisor mode) → extract/confirm fields + advisor tools
   - Separate advisor tool calls (CRM, documents, Retell) from field tools → execute async
   - Process field tool results → validate fields → update statuses
   - Follow-up LLM call (natural language) with all tool results → assistant reply
   - Check phase transitions → return reply + updated_fields + tool_calls + phase
4. Frontend calls `/sessions/{id}/submit` when complete

**Voice flow (alternative to step 3):**
3v. Frontend opens `WS /sessions/{id}/voice` → `NovaSonicStreamManager` opens bidirectional Bedrock stream
   - Browser sends audio chunks → Nova Sonic processes speech → responds with audio + transcript
   - Tool calls handled mid-stream: `toolUse` → `process_tool_calls()` → `field_update` to browser + `toolResult` to Nova Sonic
   - Phase transitions via shared `maybe_advance_phase()` — same logic as text
   - On disconnect, stream is gracefully closed (`contentEnd` → `promptEnd` → `sessionEnd`)

## Config

`app/config.py` — Pydantic `BaseSettings`, reads from `.env`:

| Env Var | Default | Notes |
|---------|---------|-------|
| `BEDROCK_MODEL` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Must be just the model ID, not `BEDROCK_MODEL=...` |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` | — | Required, explicit |
| `AWS_SECRET_ACCESS_KEY` | — | Required, explicit |
| `AWS_SESSION_TOKEN` | — | Required, explicit |
| `S3_STATEMENTS_BUCKET` | `iri-hackathon-statements` | S3 bucket for statements, advisor profiles, and suitability guidelines |
| `REDTAIL_API_KEY` | — | Redtail CRM API key. Falls back to SSM Parameter Store if missing. |
| `REDTAIL_USERNAME` | — | Redtail CRM username |
| `REDTAIL_PASSWORD` | — | Redtail CRM password |
| `REDTAIL_BASE_URL` | `https://smf.crm3.redtailtechnology.com/api/public/v1` | Redtail CRM API base URL |
| `HOST` | `0.0.0.0` | |
| `NOVA_SONIC_MODEL` | `amazon.nova-sonic-v1:0` | Nova Sonic model ID for voice |
| `NOVA_SONIC_VOICE` | `tiffany` | Voice ID (matthew, tiffany, amy, lupe, carlos) |
| `PORT` | `8000` | Use 8001 locally to avoid conflicts |
| `RETELL_API_KEY` | — | Retell AI API key. Falls back to SSM Parameter Store if missing. |
| `RETELL_AGENT_ID` | — | Retell agent ID (from `setup_retell.py`) |
| `RETELL_PHONE_NUMBER` | — | Retell outbound phone number (from `setup_retell.py`) |

## Key Files

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, CORS, route registration |
| `app/services/llm_service.py` | Bedrock client, chat/stream methods, tool extraction |
| `app/services/conversation_service.py` | Session store, message handling, phase transitions. `process_tool_calls()` and `maybe_advance_phase()` are public — shared by text and voice. Advisor mode separates advisor tools from field tools and executes them async. `TOOL_SOURCE_LABELS` and `ADVISOR_TOOL_NAMES` are module-level constants. `tool_calls_info` includes parsed `result_data` + `source_label` for frontend field mapping |
| `app/services/extraction_service.py` | Tool definitions, field validation, phase-aware tool sets |
| `app/services/nova_sonic_service.py` | `NovaSonicStreamManager`: bidirectional Bedrock stream lifecycle, audio forwarding, tool call bridging |
| `app/services/tool_adapter.py` | Anthropic → Nova Sonic tool format converter (`input_schema` → `toolSpec.inputSchema.json`) |
| `app/routes/voice.py` | WebSocket `/sessions/{id}/voice` — two async tasks for bidirectional audio + tool events |
| `app/services/schema_adapter.py` | eApp JSON → internal question format |
| `app/services/prefill_agent.py` | LLM-orchestrated pre-fill agent: tool defs, agent loop, SSE streaming generator, source execution |
| `app/services/datasources/redtail_client.py` | Async HTTP client for Redtail CRM API: two-step auth, UserKey caching, typed API methods |
| `app/services/datasources/redtail_crm.py` | Live Redtail CRM DataSource: `list_clients()`, `query()` with field mapping, `get_notes()` with HTML stripping |
| `app/services/datasources/mock_redtail.py` | Legacy mock CRM (4 hardcoded clients, kept for reference) |
| `app/services/datasources/mock_policy.py` | Mock prior policy/suitability data: 10 fields per client (fallback) |
| `app/services/datasources/s3_statements.py` | S3 annual statement PDF fetcher |
| `app/services/datasources/s3_advisor_prefs.py` | S3 advisor preference profile fetcher |
| `app/services/datasources/s3_suitability.py` | S3 carrier suitability guidelines + weighted scoring engine |
| `app/services/datasources/base.py` | Abstract `DataSource` interface |
| `app/routes/prefill.py` | Pre-fill endpoints: client list, CRM prefill (with optional advisor_id), SSE streaming prefill, document prefill |
| `app/models/conversation.py` | Enums, TrackedField, ConversationState, condition evaluator |
| `app/prompts/system_prompt.py` | Phase-aware system prompt builder |
| `app/services/retell_service.py` | Retell AI API wrapper: `create_outbound_call()`, `get_call()` via httpx |
| `app/routes/retell.py` | Retell endpoints: initiate call, poll status, webhook handler. In-memory `_call_results` cache |
| `scripts/setup_retell.py` | One-time Retell setup: create LLM config, agent, buy phone number |
| `app/config.py` | Pydantic settings (includes Retell + Redtail + AWS + Nova Sonic) |
