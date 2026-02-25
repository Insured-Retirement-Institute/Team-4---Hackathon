# Backend API

## Overview

Annuity E-Application API built with Express.js, deployed to AWS App Runner. Serves application definitions for annuity products, validates answers against rules, transforms and persists submissions, and provides CRUD for applications and products. Uses DynamoDB for persistence.

## Commands

```bash
npm start          # Run on PORT (default 8080) via index.js
npm run dev        # Run with --watch for auto-restart
```

## Project Structure

```
backend/
├── Assets/                           # Product definition JSON files + OpenAPI spec
│   ├── annuity-eapp-openapi-3.yaml   # OpenAPI 3.1.0 specification (active)
│   ├── midland-national-eapp.json    # Midland National fixed annuity (active)
│   ├── midland-national-eapp-4.json  # Midland National v4
│   ├── aspida-myga-eapp.json         # Aspida MYGA product
│   ├── equitrust-certainty-select-eapp.json # EquiTrust Certainty Select
│   └── SampleApps/                   # Reference copies of product definitions
├── src/
│   ├── app.js                        # Express app setup, middleware, Swagger UI, routes
│   ├── config/
│   │   └── dynamodb.js               # DynamoDB client setup (region, optional local endpoint)
│   ├── routes/
│   │   ├── application.js            # GET /application/:productId
│   │   ├── applications.js           # POST /applications, GET /:id, PUT /:id/answers
│   │   ├── products.js               # GET/POST/PUT/DELETE /products
│   │   ├── validation.js             # POST /application/:applicationId/validate
│   │   └── submission.js             # POST /application/:applicationId/submit
│   ├── services/
│   │   ├── productStore.js           # Loads & indexes product JSON from Assets/
│   │   ├── productService.js         # DynamoDB CRUD for Products table
│   │   ├── applicationService.js     # DynamoDB CRUD for Applications table
│   │   ├── submissionService.js      # DynamoDB persistence for Submissions table
│   │   ├── submissionTransformer.js  # Converts raw answers → canonical ApplicationSubmission payload
│   │   ├── submissionValidator.js    # Post-transform business rules (beneficiary %, allocation %, etc.)
│   │   ├── validationEngine.js       # Full validation engine for all rule types
│   │   └── docusignService.js        # DocuSign JWT-based embedded signing
│   └── utils/
│       └── dateUtils.js              # Relative date parsing (-18y, today, +1d)
├── scripts/                          # DocuSign test scripts
├── index.js                          # Entry point (port from PORT env, default 8080)
├── package.json
├── Dockerfile
└── .dockerignore
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/application/:productId` | Get application definition for a product |
| POST | `/application/:applicationId/validate` | Validate answers (scope: `page` or `full`) |
| POST | `/application/:applicationId/submit` | Submit application (5-step pipeline) |
| POST | `/applications` | Create new application record (`{productId}` in body) |
| GET | `/applications/:id` | Get application by ID |
| PUT | `/applications/:id/answers` | Merge answers into in-progress application (409 if submitted) |
| GET | `/products` | List all products |
| GET | `/products/:id` | Get product by ID |
| POST | `/products` | Create product (`{carrier, productName, productId}`) |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Delete product |
| GET | `/health` | Health check |
| GET | `/api-docs` | Swagger UI |

## DynamoDB

Three DynamoDB tables provide persistence. The `docClient` is configured in `src/config/dynamodb.js`.

| Table | Env Var | Key | Purpose |
|-------|---------|-----|---------|
| `Applications` | `APPLICATIONS_TABLE_NAME` | `id` (UUID) | Application records: productId, answers, status, timestamps |
| `Products` | `DYNAMODB_TABLE_NAME` | `id` (UUID) | Product catalog (also loaded from Assets/ JSON on startup) |
| `Submissions` | `SUBMISSIONS_TABLE_NAME` | `id` (UUID) | Submitted applications with canonical payload + raw answers |

**GSI:** `applicationId-index` on the `Submissions` table (partition key: `applicationId`).

**Environment variables:**
| Var | Default | Notes |
|-----|---------|-------|
| `AWS_REGION` | `us-east-1` | DynamoDB region |
| `DYNAMODB_ENDPOINT` | — | Optional, for local DynamoDB testing |
| `APPLICATIONS_TABLE_NAME` | `Applications` | |
| `DYNAMODB_TABLE_NAME` | `Products` | |
| `SUBMISSIONS_TABLE_NAME` | `Submissions` | |
| `PORT` | `8080` | Server listen port |

## Submission Pipeline

The submit endpoint (`POST /application/:applicationId/submit`) runs a 5-step pipeline:

1. **Server-stamp dates** — Overwrites `date_signed` and `writing_agents[].agent_date_signed` with server UTC date (prevents timezone-mismatch rejections)
2. **Validate answers** — Full validation via `validationEngine.js` against product rules
3. **Transform** — `submissionTransformer.js` converts raw answers into canonical `ApplicationSubmission` payload (envelope, parties, funding, allocations, transfers, disclosures, signatures, producer certification)
4. **Business validation** — `submissionValidator.js` checks beneficiary %, allocation %, agent commission %, transfer count, SSN encryption flags, signature date equality
5. **Persist** — Writes to `Submissions` table, marks application as `submitted`, returns confirmation number

## Validation Engine

`src/services/validationEngine.js` — supports all rule types:

`required`, `min`, `max`, `min_length`, `max_length`, `pattern`, `min_date`, `max_date`, `equals`, `equals_today`, `cross_field`, `allocation_sum`, `async` (stub), `group_sum`

Key behaviors:
- Visibility-aware — skips hidden pages/questions via recursive AND/OR/NOT condition evaluator
- Scope support — `page` or `full` validation
- Repeating pages (`pageRepeat`) with per-instance validation
- Repeatable groups with per-item field validation
- Disclosure acknowledgment validation

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

## Key Files

| File | Purpose |
|------|---------|
| `src/app.js` | Express app setup, middleware, Swagger UI, route registration |
| `src/config/dynamodb.js` | Shared DynamoDB client (region, optional local endpoint) |
| `src/services/validationEngine.js` | 500+ line validation engine, 15+ rule types |
| `src/services/submissionTransformer.js` | 500+ line canonical payload builder (answers → ApplicationSubmission) |
| `src/services/submissionValidator.js` | Post-transform business rule validation |
| `src/services/applicationService.js` | DynamoDB CRUD for Applications table |
| `src/services/productService.js` | DynamoDB CRUD for Products table |
| `src/services/submissionService.js` | DynamoDB persistence for Submissions table |
| `src/services/productStore.js` | Loads and indexes product JSON from Assets/ on startup |
| `src/services/docusignService.js` | DocuSign JWT-based embedded signing integration |
| `Assets/annuity-eapp-openapi-3.yaml` | OpenAPI 3.1.0 specification |

## Adding New Products

Drop a JSON file into `Assets/` following the same schema as `midland-national-eapp.json`. The product store loads all `*.json` files on startup and indexes by `productId`. Products can also be managed via the `/products` CRUD endpoints (persisted in DynamoDB).
