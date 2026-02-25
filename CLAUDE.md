# IRI Hackathon — Annuity E-Application

## Overview

AI-powered annuity e-application system. Four services in a monorepo: users fill out applications via a traditional wizard form OR conversational AI chat, with bidirectional field sync between them. Carrier PDF generation handles form population for submission.

## Architecture

| Service | Framework | Local Port | Deploy Target |
|---------|-----------|-----------|---------------|
| `frontend/` | React 19, TypeScript, Vite, MUI v7 | 5173 | AWS Amplify (auto-deploy from main) |
| `ai-service/` | FastAPI, Uvicorn, Claude Haiku 4.5 | 8001 | AWS App Runner |
| `backend/` | Express.js, Node 20 | 3001 | AWS App Runner |
| `backend_carrier/` | Express.js, pdf-lib | 8080 | AWS App Runner |

Each service has its own `CLAUDE.md` with service-specific details.

## Live URLs

- **Frontend:** https://main.d3467nj2uaisg3.amplifyapp.com
- **AI Service:** https://3ddrg3spbd.us-east-1.awsapprunner.com
- **Backend API:** https://y5s8xyzi3v.us-east-1.awsapprunner.com
- **Swagger UI:** https://y5s8xyzi3v.us-east-1.awsapprunner.com/api-docs/

## Key Routes

- `/` — Landing page with feature overview, CTAs to wizard, AI chat, and CRM pre-fill
- `/prefill` — Pre-fill page: select CRM client or upload document → AI agent gathers data → start session
- `/wizard-v2` — Dynamic form wizard (data-driven from product JSON)
- Widget popup available on all pages (floating chat bubble, bottom-right)

## Local Development

```bash
# All services (from root)
npm run dev                # Starts backend + frontend via concurrently

# Individual services
cd frontend && npm run dev                                                  # Port 5173
cd backend && npm start                                                     # Port 3001
cd ai-service && source venv/Scripts/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
cd backend_carrier && npm start                                             # Port 8080
```

When running locally, set `VITE_AI_SERVICE_URL=http://localhost:8001` or update `data-api-base` in `frontend/index.html`.

## Deployment

**AWS Account:** 536697244409, Region: us-east-1

**Docker Desktop gotcha:** Credential store conflicts with ECR. Use `docker --config /tmp/docker-ecr` for login and push commands.

### ECR Login (shared across services)
```bash
aws ecr get-login-password --region us-east-1 | docker --config /tmp/docker-ecr login --username AWS --password-stdin 536697244409.dkr.ecr.us-east-1.amazonaws.com
```

### AI Service
```bash
cd ai-service && docker build --platform linux/amd64 -t iri-ai-service .
docker tag iri-ai-service:latest 536697244409.dkr.ecr.us-east-1.amazonaws.com/iri-ai-service:latest
docker --config /tmp/docker-ecr push 536697244409.dkr.ecr.us-east-1.amazonaws.com/iri-ai-service:latest
aws apprunner start-deployment --service-arn "arn:aws:apprunner:us-east-1:536697244409:service/iri-ai-service/2953a2b8ea0b4b21bb191cae6eafdb7a" --region us-east-1
```

### Backend API
```bash
cd backend && docker build --platform linux/amd64 -t eappapi .
docker tag eappapi:latest 536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api:latest
docker --config /tmp/docker-ecr push 536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api:latest
aws apprunner start-deployment --service-arn "arn:aws:apprunner:us-east-1:536697244409:service/eAppAPI/21aa6d1c0faf482784c33f92f5cbcc53" --region us-east-1
```

### Frontend
Push to `main` branch → Amplify auto-deploys. No Docker needed.

## Cross-Service Integration

**AI Chat flow:** Frontend fetches schema from AI service (`GET /api/v1/demo/midland-schema`) → creates session with questions (`POST /api/v1/sessions`) → sends messages (`POST /api/v1/sessions/{id}/message`) → receives reply + `updated_fields`.

**Widget ↔ Wizard sync (bidirectional):**
- Widget → Wizard: `iri:field_updated` CustomEvents → `useWidgetSync` hook → `mergeFields()` → `collectedFields` in `ApplicationContext` → `bulkSetValues()` in form controller
- Wizard → Widget: Form `values` change → `mergeFields()` → on widget reopen, new fields sent as message to existing session
- `lastAppliedRef` prevents infinite sync loops

**Pre-fill agent flow:** Frontend `/prefill` page → select CRM client and/or upload document → `POST /api/v1/prefill` or `POST /api/v1/prefill/document` → LLM agent loop calls `lookup_crm_client`, `lookup_prior_policies`, `extract_document_fields` tools → returns `known_data` → frontend calls `createSession(productId, known_data)` → navigates home and opens widget with session in SPOT_CHECK phase.

**State hub:** `ApplicationContext.tsx` holds `collectedFields`, `sessionId`, `phase`, and step progress shared across wizard and chat.

## Shared Conventions

- All AI service routes use `/api/v1/` prefix
- System prompt includes "never use emojis" instruction
- AWS credentials must be explicitly passed to `AnthropicBedrock()` — system creds resolve to a different account
- Product ID for Midland National: `midland-fixed-annuity-001`

## AWS Resources

| Resource | Identifier |
|----------|-----------|
| ECR: backend | `536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api` |
| ECR: ai-service | `536697244409.dkr.ecr.us-east-1.amazonaws.com/iri-ai-service` |
| App Runner: eAppAPI | `arn:aws:apprunner:us-east-1:536697244409:service/eAppAPI/21aa6d1c0faf482784c33f92f5cbcc53` |
| App Runner: iri-ai-service | `arn:aws:apprunner:us-east-1:536697244409:service/iri-ai-service/2953a2b8ea0b4b21bb191cae6eafdb7a` |
| IAM Roles | `AppRunnerECRAccessRole`, `AppRunnerInstanceRole`, `WSParticipantRole` |
| IAM Policy | `BedrockInvokeModelAccess` |

## Common Issues & Fixes

- **ECR push 403** — Wrong AWS account creds. Export correct creds from `ai-service/.env`.
- **Empty chat bubbles** — `tool_choice: any` on follow-up LLM call. Fix: `force_tool=False` on follow-up.
- **Widget not syncing fields** — Model not calling extraction tools. Fix: ensure `tool_choice: {"type": "any"}` on initial call.
- **"model identifier is invalid"** — App Runner env var `BEDROCK_MODEL` had `BEDROCK_MODEL=` prefix in value. Value should be just the model ID.
- **Alternating roles error** — Combine tool results into single user message.
- **Amplify build fails on missing dep** — Add to `frontend/package.json` (e.g., `lottie-web`, `@lottiefiles/dotlottie-react`).
- **Widget 404** — Restart server after adding new routes.
- **Git push rejected** — Remote has new commits. `git stash && git pull --rebase origin main && git stash pop && git push`.
