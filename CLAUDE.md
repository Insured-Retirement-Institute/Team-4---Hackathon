# IRI Retirement Application Platform

## Project Overview

A schema-driven platform for processing retirement (annuity/life insurance) applications across multiple carriers. One JSON schema per carrier drives the entire pipeline: UI rendering, validation, AI-assisted data collection, and submission.

## Architecture

- **Monorepo:** `backend/` (Python Flask), `ai-service/` (Python FastAPI), `frontend/` (React/TypeScript/Vite)
- **Database:** AWS DynamoDB (CarrierSchemas + Applications tables)
- **AI Service:** Standalone conversational engine using Claude via AWS Bedrock — collects and validates application data through natural conversation
- **Core pattern:** Schema-driven everything — carrier JSON schemas define fields, validation, wizard steps, and AI conversation flow

## Tech Stack

- Backend: Python 3.11+, Flask, boto3, jsonschema
- AI Service: Python 3.11+, FastAPI, Anthropic SDK (Bedrock), httpx, pydantic
- Frontend: React 18, TypeScript, Vite
- Database: AWS DynamoDB
- Infrastructure: AWS App Runner (ai-service), ECR, IAM
- Testing: pytest (backend + ai-service), vitest (frontend)

## Project Structure

```
ai-service/        Conversational AI service (FastAPI)
  app/
    models/        Conversation state, API request/response contracts
    routes/        HTTP endpoints (sessions, chat, health, demo)
    services/      LLM orchestration, validation, extraction, schema adapter
    prompts/       Phase-aware system prompt builder
    schemas/       Carrier eApp JSON schemas (e.g., Midland National)
    static/        Chat demo UI
  tests/           pytest tests
backend/           Flask API for schema/application CRUD
  app/
    models/        DynamoDB data models
    routes/        API endpoint blueprints
    services/      Business logic layer
    schemas/       JSON schema seed files
    utils/         Shared utilities
  tests/           pytest tests
frontend/          React + TypeScript + Vite
docs/              Architecture and reference docs
scripts/           Setup and utility scripts
infra/             Infrastructure definitions
```

## AI Service API

All endpoints under `/api/v1`. Key routes:
- `GET /health` — health check
- `POST /sessions` — create conversation session (accepts questions, known_data, callback_url)
- `GET /sessions/{session_id}` — get session state and field summary
- `POST /sessions/{session_id}/message` — send user message, get AI reply + field updates
- `POST /sessions/{session_id}/submit` — submit collected data to callback URL
- `GET /demo/midland-schema` — load Midland National eApp as test data

### Conversation Phases

`SPOT_CHECK` → `COLLECTING` → `REVIEWING` → `COMPLETE` → `SUBMITTED`

### Field Statuses

`MISSING` → `UNCONFIRMED` (from known_data) → `CONFIRMED` / `COLLECTED`

## Backend API

All endpoints under `/api/v1`. Key routes:
- `GET /health` — health check
- `GET /schemas` — list carrier schemas
- `GET /schemas/{carrier_id}` — get carrier schema
- `POST /applications` — create application
- `PUT /applications/{id}` — save progress
- `POST /applications/{id}/submit` — validate and submit

## Development

```bash
# AI Service
cd ai-service && python -m venv venv && source venv/Scripts/activate  # or venv/bin/activate on Linux
pip install -r requirements.txt
cp .env.example .env  # add AWS credentials
python run.py

# Backend
cd backend && pip install -r requirements.txt && python run.py

# Frontend
cd frontend && npm install && npm run dev

# Tests
cd ai-service && pytest
cd backend && pytest
```

## AWS Configuration

The AI service requires AWS Bedrock access. Set these in `ai-service/.env`:
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`
- `AWS_REGION` (default: us-east-1)
- `BEDROCK_MODEL` (default: anthropic.claude-3-sonnet-20240229-v1:0)

## Deployment

- **AI Service:** AWS App Runner from ECR image (`iri-ai-service`)
- **CI/CD:** GitHub Actions builds and pushes to ECR on push to `feature/ai-service-standalone` or `main`
- Auto-deploy enabled — App Runner redeploys when new image is pushed to ECR
