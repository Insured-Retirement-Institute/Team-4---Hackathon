# eAppAPI

## Overview

Annuity E-Application API built with Express.js, deployed to AWS App Runner. Serves application definitions for annuity products, validates answers against rules, and accepts submissions.

## Project Structure

```
simpleAPI/
├── Assets/                        # Product definition JSON files + OpenAPI spec
│   ├── annuity-eapp-openapi.yaml  # OpenAPI 3.1.0 specification
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
├── index.js                       # Entry point
├── package.json
├── Dockerfile
└── .dockerignore
```

## Key Commands

- `npm start` — Run the API locally on port 8080
- `docker build --platform linux/amd64 -t eappapi .` — Build Docker image for deployment
- `docker run -d --name eappapi -p 8080:8080 eappapi` — Run container locally

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

Supports all rule types: `required`, `min`, `max`, `min_length`, `max_length`, `pattern`, `min_date`, `max_date`, `equals`, `equals_today`, `cross_field`, `allocation_sum`, `async` (stub), `group_sum`.

Key behaviors:
- Visibility-aware (skips hidden pages/questions via recursive AND/OR/NOT condition evaluator)
- Scope support (`page` or `full`)
- Repeating pages (pageRepeat) with per-instance validation
- Repeatable groups with per-item field validation
- Disclosure acknowledgment validation

## Adding New Products

Drop a JSON file into `Assets/` following the same schema as `midland-national-eapp.json`. The product store loads all `*.json` files on startup and indexes by `productId`.
