# Architecture

## System Overview

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  React UI   │──────▶│  Flask API   │──────▶│  DynamoDB    │
│  (Vite)     │◀──────│  /api/v1     │◀──────│              │
└─────────────┘       └──────────────┘       └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Carrier    │
                    │   Schemas    │
                    │   (JSON)     │
                    └──────────────┘
```

## Schema-Driven Architecture

The central design decision: **carrier JSON schemas drive everything**.

A single carrier schema document defines:
- **Wizard steps** — what pages the user sees
- **Field definitions** — type, label, options, placeholder
- **Validation rules** — required, patterns, min/max, cross-field
- **Future: PDF mapping** — field-to-coordinate mapping for form filling
- **Future: LLM context** — field definitions for AI chat completion

This means adding a new carrier requires **zero code changes** — just a new JSON schema.

## Layers

### API Layer (`routes/`)
Flask blueprints handling HTTP. Thin — delegates to services.

### Service Layer (`services/`)
Business logic: CRUD operations, schema validation, submission workflows.

### Model Layer (`models/`)
DynamoDB data access. Handles serialization and table operations.

### Schema Files (`schemas/`)
JSON seed data. `base_application.json` defines shared fields; `carriers/*.json` defines carrier-specific schemas.

## Data Flow

### Creating an Application
1. User selects carrier on home page
2. Frontend fetches carrier schema via `GET /api/v1/schemas/{carrier_id}`
3. Schema parsed into wizard steps and field definitions
4. User fills out wizard
5. Each step validated client-side against schema rules
6. On submit: `POST /api/v1/applications/{id}/submit`
7. Server validates full application against schema
8. Application stored with status `submitted`

### Saving Progress
- `POST /api/v1/applications` creates a draft
- `PUT /api/v1/applications/{id}` saves partial data
- Application status remains `draft` until submitted

## DynamoDB Tables

### CarrierSchemas
- **PK:** `carrier_id` (string)
- **SK:** `schema_version` (string, e.g. "1.0")
- Stores the full carrier schema JSON

### Applications
- **PK:** `application_id` (UUID string)
- **GSI:** `carrier_id` for querying by carrier
- Stores application data, status, timestamps

## Phase Roadmap

### Phase 1 (Current)
- Centralized application repository
- Dynamic wizard UI driven by carrier schemas
- Carrier submission API with validation

### Phase 2 (Designed For)
- DTCC converter for industry-standard data exchange
- PDF form filling from application data
- LLM chat completion for assisted form filling

### Phase 3 (Designed For)
- Agentic AI for end-to-end application processing
- CRM integration for advisor workflows
- Call transcript parsing to pre-fill applications
