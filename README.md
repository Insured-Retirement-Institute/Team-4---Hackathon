# Team 4 Hackathon — Annuity E-Application

A monorepo containing the Express backend API and React frontend for the annuity e-application wizard.

## Project Structure

```
├── backend/               # Express API
│   ├── server.js          # Entry point (port 3001 locally)
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/        # application, validation, submission
│   │   ├── services/      # productStore, validationEngine
│   │   └── utils/
│   ├── Assets/            # OpenAPI spec + product definitions
│   └── package.json
├── frontend/              # React + Vite app (port 5173 locally)
│   ├── src/
│   │   ├── features/
│   │   │   ├── wizard-v1/ # Annuity application wizard (v1)
│   │   │   └── wizard-v2/ # Annuity application wizard (v2)
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── package.json           # Root scripts — runs both together
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+

### 1. Install all dependencies

```bash
# Install root dev tools (concurrently)
npm install

# Install backend + frontend dependencies
npm run install:all
```

### 2. Run in development

Start both servers simultaneously:

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Swagger UI:** http://localhost:3001/api-docs

Run individually:

```bash
npm run dev:backend    # Express with --watch (auto-restarts on file changes)
npm run dev:frontend   # Vite with HMR
```

> The frontend proxies `/application`, `/health`, and `/api-docs` to the backend automatically — no CORS config needed during development.

---

## Backend

### Live API

**Swagger UI:** https://y5s8xyzi3v.us-east-1.awsapprunner.com/api-docs/

**Base URL:** https://y5s8xyzi3v.us-east-1.awsapprunner.com

### Endpoints

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

### Validation Rules

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

### Docker

```bash
docker build --platform linux/amd64 -t eappapi .
docker run -d --name eappapi -p 8080:8080 eappapi
```

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, MUI v7, React Router v6, React Hook Form
- **Backend:** Node.js 20, Express.js, Swagger UI Express
- **Infrastructure:** AWS App Runner + ECR
