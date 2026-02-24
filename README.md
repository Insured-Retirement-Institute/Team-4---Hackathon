# eAppAPI — Annuity E-Application API

A dynamic, renderable e-application API for annuity products. Designed for frontend applications and AI agents to retrieve application definitions, validate answers, and submit completed applications.

## Live API

**Swagger UI:** https://y5s8xyzi3v.us-east-1.awsapprunner.com/api-docs/

**Base URL:** https://y5s8xyzi3v.us-east-1.awsapprunner.com

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/application/:productId` | Get full application definition for a product |
| POST | `/application/:applicationId/validate` | Validate answers against application rules |
| POST | `/application/:applicationId/submit` | Submit a completed application |

## DocuSign Demo

- Start signing: `POST /application/:applicationId/docusign/start`
- Open the returned `signingUrl` in a new tab/window
- The DocuSign return page (`/docusign/return`) is currently a placeholder

## Quick Start

```bash
npm install
npm start
```

The API runs on port 8080 by default. Visit http://localhost:8080/api-docs/ for the interactive Swagger UI.

## Example Requests

**Get application definition:**
```bash
curl https://y5s8xyzi3v.us-east-1.awsapprunner.com/application/midland-fixed-annuity-001
```

**Validate answers:**
```bash
curl -X POST https://y5s8xyzi3v.us-east-1.awsapprunner.com/application/test-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "midland-fixed-annuity-001",
    "answers": {
      "annuitant_first_name": "Jane",
      "annuitant_last_name": "Smith",
      "annuitant_dob": "1965-03-15"
    }
  }'
```

**Validate a single page:**
```bash
curl -X POST "https://y5s8xyzi3v.us-east-1.awsapprunner.com/application/test-123/validate?scope=page&pageId=page-annuitant" \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "midland-fixed-annuity-001",
    "answers": {
      "annuitant_first_name": "Jane",
      "annuitant_last_name": "Smith"
    }
  }'
```

**Submit application:**
```bash
curl -X POST https://y5s8xyzi3v.us-east-1.awsapprunner.com/application/app-001/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "midland-fixed-annuity-001",
    "answers": { ... },
    "metadata": {
      "submissionSource": "ai_agent",
      "agentId": "agent-001"
    }
  }'
```

## Validation Rules

The API enforces all validation rules defined in the product definition:

- **required** — Non-null, non-empty value
- **min / max** — Numeric range
- **min_length / max_length** — String length
- **pattern** — Regular expression match
- **min_date / max_date** — Date range with relative date support (`-85y`, `today`, `+1d`)
- **equals** — Exact value match
- **equals_today** — Date must be today
- **cross_field** — Compare two answer values
- **allocation_sum** — Fund allocation percentages must sum to target
- **group_sum** — Sum a field across repeatable group items (with optional filter)
- **async** — External service validation (stub)

## Docker

```bash
docker build --platform linux/amd64 -t eappapi .
docker run -d --name eappapi -p 8080:8080 eappapi
```

## Tech Stack

- Node.js 20
- Express.js
- Swagger UI Express
- AWS App Runner + ECR
