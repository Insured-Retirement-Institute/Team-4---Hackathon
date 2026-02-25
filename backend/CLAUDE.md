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
├── server.js                      # Dev entry point (port 3001)
├── index.js                       # Container entry point (port 8080)
├── package.json
├── Dockerfile
└── .dockerignore
```

## Validation Engine

`src/services/validationEngine.js` — supports all rule types:

`required`, `min`, `max`, `min_length`, `max_length`, `pattern`, `min_date`, `max_date`, `equals`, `equals_today`, `cross_field`, `allocation_sum`, `async` (stub), `group_sum`

Key behaviors:
- Visibility-aware — skips hidden pages/questions via recursive AND/OR/NOT condition evaluator
- Scope support — `page` or `full` validation
- Repeating pages (`pageRepeat`) with per-instance validation
- Repeatable groups with per-item field validation
- Disclosure acknowledgment validation

## Adding New Products

Drop a JSON file into `Assets/` following the same schema as `midland-national-eapp.json`. The product store loads all `*.json` files on startup and indexes by `productId`.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/validationEngine.js` | 500+ line validation engine, 15+ rule types |
| `src/services/productStore.js` | Loads and indexes product JSON on startup |
| `Assets/midland-national-eapp.json` | Midland National fixed annuity product definition |
| `Assets/annuity-eapp-openapi.yaml` | OpenAPI 3.1.0 specification |
