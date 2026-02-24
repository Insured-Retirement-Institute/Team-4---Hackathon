# Architecture

## System Overview

```
                              ┌──────────────┐
                              │   DynamoDB    │
                              │  (Schemas +   │
                              │ Applications) │
                              └──────┬───────┘
                                     │
┌─────────────┐       ┌──────────────┤       ┌──────────────┐
│  React UI   │──────▶│  Flask API   │       │  AI Service  │
│  (Vite)     │◀──────│  /api/v1     │       │  (FastAPI)   │
└─────────────┘       └──────────────┘       └──────┬───────┘
                                                     │
                                              ┌──────┴───────┐
                                              │ AWS Bedrock  │
                                              │  (Claude)    │
                                              └──────────────┘
```

## Schema-Driven Architecture

The central design decision: **carrier JSON schemas drive everything**.

A single carrier schema document defines:
- **Wizard steps** — what pages the user sees
- **Field definitions** — type, label, options, placeholder
- **Validation rules** — required, patterns, min/max, cross-field
- **AI conversation context** — field definitions for LLM-assisted collection
- **Visibility conditions** — compound AND/OR/NOT conditions controlling field display

This means adding a new carrier requires **zero code changes** — just a new JSON schema.

## AI Service Architecture

The AI service is a standalone conversational engine that collects application data through natural conversation with Claude via AWS Bedrock.

### Conversation Flow

1. **Session created** with questions (schema) + known_data → fields initialized
2. **Spot-check phase** — summarize known data, ask user to confirm
3. **Collecting phase** — ask about missing fields 2-4 at a time
4. **Reviewing phase** — present final summary for approval
5. **Submit** — batch POST collected data to callback URL

### AI Service Layers

**Routes (`routes/`):** FastAPI endpoints — sessions, chat, health, demo. Thin — delegates to services.

**Services (`services/`):**
- `conversation_service.py` — main orchestrator: session management, turn handling, phase transitions
- `llm_service.py` — Anthropic Bedrock SDK wrapper with tool use support
- `extraction_service.py` — builds LLM tool definitions per phase
- `validation_service.py` — field-level validation (pattern, length, enum, date, etc.)
- `schema_adapter.py` — transforms carrier eApp JSON format to internal format
- `eapp_client.py` — HTTP client for submitting collected data

**Models (`models/`):**
- `conversation.py` — `ConversationState`, `TrackedField`, `SessionPhase`, `FieldStatus`
- `api_contracts.py` — Pydantic request/response models

**Prompts (`prompts/`):**
- `system_prompt.py` — phase-aware prompt builder with field context

### LLM Tool Use

The AI uses two tools that vary by phase:
- **`extract_application_fields`** — extract field values from user messages → validate → accept/reject
- **`confirm_known_fields`** — batch-confirm pre-populated fields during spot-check

## Backend Layers

### API Layer (`routes/`)
Flask blueprints handling HTTP. Thin — delegates to services.

### Service Layer (`services/`)
Business logic: CRUD operations, schema validation, submission workflows.

### Model Layer (`models/`)
DynamoDB data access. Handles serialization and table operations.

### Schema Files (`schemas/`)
JSON seed data. `base_application.json` defines shared fields; `carriers/*.json` defines carrier-specific schemas.

## Data Flow

### AI-Assisted Application (AI Service)
1. Caller POSTs to `/sessions` with questions (from carrier schema) + known_data
2. AI greets user, summarizes known data, asks for confirmation
3. User chats naturally — AI extracts and validates field values via tool use
4. Once all required fields collected, AI presents summary for review
5. Caller POSTs to `/sessions/{id}/submit` → data sent to callback URL

### Manual Application (Backend)
1. User selects carrier on home page
2. Frontend fetches carrier schema via `GET /api/v1/schemas/{carrier_id}`
3. Schema parsed into wizard steps and field definitions
4. User fills out wizard, each step validated client-side
5. On submit: `POST /api/v1/applications/{id}/submit` validates and stores

## DynamoDB Tables

### CarrierSchemas
- **PK:** `carrier_id` (string)
- **SK:** `schema_version` (string, e.g. "1.0")
- Stores the full carrier schema JSON

### Applications
- **PK:** `application_id` (UUID string)
- **GSI:** `carrier_id` for querying by carrier
- Stores application data, status, timestamps

## Infrastructure

### AI Service Deployment
- **Runtime:** AWS App Runner (auto-scaling, managed HTTPS)
- **Container:** ECR repository `iri-ai-service`
- **CI/CD:** GitHub Actions → Docker build → ECR push → App Runner auto-deploy
- **IAM:** `AppRunnerInstanceRole` with Bedrock invoke permissions

### Backend Deployment
- AWS App Runner from ECR repository `iri-backend`
