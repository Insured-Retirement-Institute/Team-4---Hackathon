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

- `/` — Landing page with feature overview, recent applications, CTAs to wizard, AI chat, and CRM pre-fill
- `/prefill` — Pre-fill page: select CRM client or upload document → AI agent gathers data → start session
- `/ai-experience` — Chat-driven advisor experience: two-panel layout with advisor chat (left) driving CRM lookups, data gathering, and client calls conversationally, and a field mapping panel (right) showing source-attributed data accumulating in real-time. Product selection in side panel, Retell outbound calls, and "Open in Wizard" to launch pre-filled application
- `/wizard-v2` — Product selection → dynamic form wizard (data-driven from product JSON)
- `/wizard-v2/:productId` — Wizard for a specific product (supports `?resume=<id>` for saved applications)
- `/applications` — Application history: list saved/submitted applications, resume or delete
- `/docusign/return` — DocuSign redirect handler after embedded signing
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

**AI Chat flow (text):** Frontend fetches schema from AI service (`GET /api/v1/demo/midland-schema`) → creates session with questions (`POST /api/v1/sessions`) → sends messages (`POST /api/v1/sessions/{id}/message`) → receives reply + `updated_fields` + `tool_calls`.

**Advisor chat mode:** When `advisor_name` and optional `client_context` (`{client_id, display_name}`) are passed to session creation, the chat operates in advisor mode:
- Session creation supports empty `questions` array (product-agnostic) — `questions` field defaults to `[]`
- System prompt switches persona to address the advisor (not end client)
- LLM gets access to 9 advisor tools: `lookup_crm_client`, `lookup_family_members`, `lookup_crm_notes`, `lookup_prior_policies`, `lookup_annual_statements`, `extract_document_fields`, `get_advisor_preferences`, `get_carrier_suitability`, `call_client`
- `force_tool=False` — LLM decides when to call tools (vs regular mode which forces extraction tools)
- Advisor tools execute async via `execute_prefill_tool()` from the prefill agent; `call_client` initiates Retell outbound calls
- Tool results fed back to LLM for a natural language follow-up response
- `tool_calls` in `MessageResponse` now include `result_data` (structured JSON from tool execution) and `source_label` (human-readable source name like "Redtail CRM", "CRM Notes", "Document Store") — frontend uses these to populate the field mapping panel with source attribution
- `client_context` embeds the selected client's CRM ID in the system prompt so the LLM knows which ID to use for lookups

**AI Chat flow (voice):** Same session creation as text. Frontend opens WebSocket to `WS /api/v1/sessions/{id}/voice` → sends `{"type":"audio","data":"<base64 PCM 16kHz>"}` → receives `{"type":"audio","data":"<base64 PCM 24kHz>"}` + `{"type":"transcript"}` + `{"type":"field_update"}`. Uses AWS Nova Sonic (speech-to-speech) via `aws_sdk_bedrock_runtime` bidirectional stream. Voice and text share the same `ConversationState` (fields, phase) so users can switch modes mid-session. Tool calls (field extraction, confirmation) are handled identically via shared `process_tool_calls()`/`maybe_advance_phase()`.

**Widget ↔ Wizard sync (bidirectional):**
- Widget → Wizard: `iri:field_updated` CustomEvents → `useWidgetSync` hook → `mergeFields()` → `collectedFields` in `ApplicationContext` → `bulkSetValues()` in form controller
- Wizard → Widget: Form `values` change → `mergeFields()` → on widget reopen, new fields sent as message to existing session
- `lastAppliedRef` prevents infinite sync loops

**Pre-fill agent flow:** Frontend `/prefill` page → select CRM client and/or upload document → `POST /api/v1/prefill` or `POST /api/v1/prefill/document` → LLM agent loop calls `lookup_crm_client` (live Redtail API), `lookup_crm_notes` (meeting transcripts — LLM extracts financial data), `lookup_prior_policies` (fallback), `lookup_annual_statements`, `extract_document_fields`, `get_advisor_preferences`, `get_carrier_suitability` tools → returns `known_data` (including suitability score/rating and advisor recommendations) → frontend calls `createSession(productId, known_data)` → navigates home and opens widget with session in SPOT_CHECK phase.

**AI Experience flow (chat-driven):** Frontend `/ai-experience` page → auto-creates advisor session (no product required, `questions: []`) with `advisor_name: "Andrew Barnett"` → two-panel layout: ChatPanel (left) + FieldMappingPanel (right). Chat greets advisor and asks about client → advisor types client name → LLM calls `lookup_crm_client` → tool response includes `result_data` + `source_label` → frontend extracts fields into `gatheredFields` Map with source attribution → FieldMappingPanel shows raw fields with source chips. Advisor selects product from dropdown in side panel → product definition loaded → field matching table appears (grouped by page, with fill percentage). LLM suggests family lookup → `lookup_family_members` → beneficiary fields added. "Call Client" button in side panel triggers RetellCallPanel (appears above chat) → extracted fields merge with "Client Call" source. "Open in Wizard" navigates to `/wizard-v2/:productId` with all collected data pre-filled via `mergeFields()`.

**Retell AI outbound call flow:** Frontend `POST /api/v1/retell/calls` with `{to_number, missing_fields, client_name, advisor_name}` → AI service calls Retell API to initiate outbound call with dynamic variables (missing fields prompt, names) → Retell agent (voice: 11labs-Adrian) calls client, collects missing field values conversationally → frontend polls `GET /api/v1/retell/calls/{id}` every 3s for status + live transcript → on call completion, Retell post-call analysis extracts `collected_fields` as JSON → webhook `POST /api/v1/retell/webhook` caches results → frontend merges extracted fields into gathered data.

**Application persistence flow:** Frontend `ProductSelectionPage` fetches `GET /products` → user picks product → `POST /applications` creates DynamoDB record → wizard saves progress to localStorage via `applicationStorageService` → on submit, `POST /applications/:applicationId/submit` runs 5-step pipeline (validate → transform → business rules → persist to Submissions table → mark submitted). Resume via `/wizard-v2/:productId?resume=<id>`.

**State hub:** `ApplicationContext.tsx` holds `collectedFields`, `sessionId`, `phase`, and step progress shared across wizard and chat.

## Shared Conventions

- Nova Sonic voice requires Python 3.12+ (`aws_sdk_bedrock_runtime` SDK). Docker image uses `python:3.12-slim`.
- All AI service routes use `/api/v1/` prefix
- System prompt includes "never use emojis" instruction
- AWS credentials must be explicitly passed to `AnthropicBedrock()` — system creds resolve to a different account
- Product IDs: Midland National `midland-fixed-annuity-001`, Aspida `aspida-myga-001`, EquiTrust `certainty-select`
- S3 bucket `iri-hackathon-statements` stores annual statements (`statements/`), advisor profiles (`advisors/`), and carrier suitability guidelines (`suitability/`)
- Retell AI: Agent ID `agent_a4375e256ad8942382840b4c22`, Phone `+19802528898`, LLM ID `llm_04f164a3d7d67767ba9dc84798e2`. Creds in SSM or `ai-service/.env`.

## AWS Resources

| Resource | Identifier |
|----------|-----------|
| ECR: backend | `536697244409.dkr.ecr.us-east-1.amazonaws.com/simple-api` |
| ECR: ai-service | `536697244409.dkr.ecr.us-east-1.amazonaws.com/iri-ai-service` |
| App Runner: eAppAPI | `arn:aws:apprunner:us-east-1:536697244409:service/eAppAPI/21aa6d1c0faf482784c33f92f5cbcc53` |
| App Runner: iri-ai-service | `arn:aws:apprunner:us-east-1:536697244409:service/iri-ai-service/2953a2b8ea0b4b21bb191cae6eafdb7a` |
| DynamoDB: Applications | Table `Applications` (id key) — application records |
| DynamoDB: Products | Table `Products` (id key) — product catalog |
| DynamoDB: Submissions | Table `Submissions` (id key, GSI: `applicationId-index`) — submitted applications |
| S3: statements/advisors/suitability | Bucket `iri-hackathon-statements` — `statements/{client_id}/`, `advisors/{advisor_id}/`, `suitability/{carrier_id}/` |
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
