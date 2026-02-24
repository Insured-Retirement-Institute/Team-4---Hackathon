# IRI Retirement Application Platform

## Project Overview

A schema-driven platform for processing retirement (annuity/life insurance) applications across multiple carriers. One JSON schema per carrier drives the entire pipeline: UI rendering, validation, and future PDF/AI features.

## Architecture

- **Monorepo:** `backend/` (Python Flask) + `frontend/` (React/TypeScript/Vite)
- **Database:** AWS DynamoDB (CarrierSchemas + Applications tables)
- **Core pattern:** Schema-driven everything — carrier JSON schemas define fields, validation, wizard steps, and future PDF mappings

## Tech Stack

- Backend: Python 3.11+, Flask, boto3, jsonschema
- Frontend: React 18, TypeScript, Vite
- Database: AWS DynamoDB
- Testing: pytest (backend), vitest (frontend)

## Key Concepts

- **Carrier Schema:** JSON document defining all fields, steps, and validation rules for a carrier's application. Stored in DynamoDB and seeded from `backend/app/schemas/carriers/`.
- **Application:** A user's in-progress or submitted application, validated against its carrier schema.
- **Wizard:** Dynamic multi-step form rendered from a carrier schema. Steps, fields, and validation are all schema-driven.

## Project Structure

```
backend/           Python Flask API
  app/
    models/        DynamoDB data models
    routes/        API endpoint blueprints
    services/      Business logic layer
    schemas/       JSON schema seed files
    utils/         Shared utilities
  tests/           pytest tests
frontend/          React + TypeScript + Vite
  src/
    api/           HTTP client and API calls
    types/         TypeScript type definitions
    components/    UI components (wizard/, fields/, layout/)
    pages/         Route-level page components
    hooks/         Custom React hooks
    utils/         Client-side utilities
docs/              Architecture and reference docs
scripts/           Setup and utility scripts
infra/             Infrastructure definitions
```

## API Base

All endpoints under `/api/v1`. Key routes:
- `GET /health` — health check
- `GET /schemas` — list carrier schemas
- `GET /schemas/{carrier_id}` — get carrier schema
- `POST /applications` — create application
- `PUT /applications/{id}` — save progress
- `POST /applications/{id}/submit` — validate and submit

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt && python run.py

# Frontend
cd frontend && npm install && npm run dev
```

## Phase Roadmap

- **Phase 1 (current):** Centralized app, dynamic wizard UI, carrier submission API
- **Phase 2 (planned):** DTCC converter, PDF form filling, LLM chat completion
- **Phase 3 (planned):** Agentic AI, CRM integration, call transcript parsing
