# Backend API

## Overview

Annuity E-Application API built with Express.js, deployed to AWS App Runner. Serves application definitions for annuity products, validates answers against rules, and accepts submissions.

## Commands

```bash
npm start          # Run locally on port 3001 (via server.js) or 8080 (via index.js in container)
npm run dev        # Run with --watch for auto-restart
```

## Project Structure

```
backend/
├── Assets/                        # Product definition JSON files + OpenAPI spec
│   ├── annuity-eapp-openapi-3.yaml # OpenAPI 3.1.0 specification (active)
│   └── midland-national-eapp.json # Midland National fixed annuity product
├── src/
│   ├── app.js                     # Express app setup, middleware, Swagger UI, routes
│   ├── routes/
│   │   ├── application.js         # GET /application/:productId
│   │   ├── validation.js          # POST /application/:applicationId/validate
│   │   └── submission.js          # POST /application/:applicationId/submit
│   ├── services/
│   │   ├── productStore.js        # Loads & indexes product JSON from Assets/
│   │   └── validationEngine.js    # Full validation engine for all rule types
│   └── utils/
│       └── dateUtils.js           # Relative date parsing (-18y, today, +1d)
├── server.js                      # Dev entry point (port 3001)
├── index.js                       # Container entry point (port 8080)
├── package.json
├── Dockerfile
└── .dockerignore
```

## Deployment

- **AWS Region:** us-east-1
- **ECR Repo:** `536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api:latest`
- **App Runner Service:** eAppAPI
- **Deploy steps:**
  1. Build image: `docker build --platform linux/amd64 -t eappapi .`
  2. Tag: `docker tag eappapi:latest 536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api:latest`
  3. Login: `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 536697244409.dkr.ecr.us-east-1.amazonaws.com`
  4. Push: `docker push 536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api:latest`
  5. Deploy: `aws apprunner start-deployment --service-arn "arn:aws:apprunner:us-east-1:536697244409:service/eAppAPI/21aa6d1c0faf482784c33f92f5cbcc53" --region us-east-1`

## Validation Engine

`src/services/validationEngine.js` — supports all rule types:

`required`, `min`, `max`, `min_length`, `max_length`, `pattern`, `min_date`, `max_date`, `equals`, `equals_today`, `cross_field`, `allocation_sum`, `async` (stub), `group_sum`

Key behaviors:
- Visibility-aware — skips hidden pages/questions via recursive AND/OR/NOT condition evaluator
- Scope support — `page` or `full` validation
- Repeating pages (`pageRepeat`) with per-instance validation
- Repeatable groups with per-item field validation
- Disclosure acknowledgment validation

## API Contract Notes

- The validate (`POST /application/:applicationId/validate`) and submit (`POST /application/:applicationId/submit`) endpoints require `productId` and `answers` in the request body
- Submission metadata (`agentId`, `ipAddress`, `userAgent`, `submissionSource`) is nested under `req.body.metadata`
- The active OpenAPI spec is `Assets/annuity-eapp-openapi-3.yaml`

## Server-Stamped Signature Dates

The submission endpoint (`POST /application/:applicationId/submit`) overwrites `date_signed` and each `writing_agents[].agent_date_signed` with the server's current UTC date **before** validation runs. This is intentional:

- **Why:** The `equals_today` validation rule compares against the server's UTC date. Users in US time zones submitting in the evening would have their local date rejected once UTC rolls past midnight (e.g. 11pm CST = next day UTC). This caused production submission failures.
- **Behavior:** The frontend may still send these date fields for display/UX purposes, but the server ignores them and stamps its own. The persisted submission and canonical payload always reflect the server-authoritative date.
- **Security:** Prevents clients from backdating or future-dating signature dates. The server is the single source of truth for when the application was signed.
- **Scope:** Only affects the submit endpoint. The validate endpoint (`/validate`) does **not** stamp dates, so `equals_today` still runs against client-provided values during page-level validation for frontend UX feedback.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/validationEngine.js` | 500+ line validation engine, 15+ rule types |
| `src/services/productStore.js` | Loads and indexes product JSON on startup |
| `Assets/midland-national-eapp.json` | Midland National fixed annuity product definition |
| `Assets/annuity-eapp-openapi-3.yaml` | OpenAPI 3.1.0 specification |

## Adding New Products

Drop a JSON file into `Assets/` following the same schema as `midland-national-eapp.json`. The product store loads all `*.json` files on startup and indexes by `productId`.
