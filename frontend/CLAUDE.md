# Wizard Workflow

## Flow
1. `/wizard-v2` → `ProductSelectionPage` — fetches `GET /products`, user picks a product, navigates to `/wizard-v2/:productId`
2. `/wizard-v2/:productId` → `WizardPageV2` — reads `:productId` from route params, fetches `GET /applications/:productId` to get an `ApplicationDefinition`, then renders the dynamic form wizard

## Key Files
- `src/pages/ProductSelectionPage.tsx` — product picker; navigates on selection, does NOT prefetch the application definition
- `src/features/wizard-v2/WizardPage.tsx` — outer shell fetches the definition; inner `WizardPageContent` drives the step-by-step wizard UI
- `src/features/wizard-v2/formController.tsx` — React context provider; accepts `definition: ApplicationDefinition` as a prop; owns all form values, errors, validation, and dummy-data population
- `src/features/wizard-v2/WizardField.tsx` — renders any `QuestionDefinition` dynamically; already fully generic, no product-specific logic
- `src/features/wizard-v2/WizardSidebar.tsx` — step navigation sidebar; driven by `pages[]`, `productName`, and `carrier` props
- `src/types/application.ts` — canonical types: `ApplicationDefinition`, `PageDefinition`, `QuestionDefinition`, `AnswerMap`
- `src/services/apiService.ts` — `getProducts()`, `getApplication(productId)`, `validateApplication()`, `submitApplication()`

## ApplicationDefinition Shape
Pages → Questions → `QuestionDefinition` (id, label, type, options, groupConfig, allocationConfig, …).
All question types are handled in `WizardField.tsx`: `short_text`, `long_text`, `number`, `currency`, `date`, `boolean`, `select`, `multi_select`, `radio`, `phone`, `email`, `ssn`, `signature`, `repeatable_group`, `allocation_table`.

---

# Frontend

## Overview

React 19 + TypeScript single-page application for the annuity e-application. Vite bundler, MUI v7 component library, React Router for navigation. Supports both a traditional wizard form and an AI conversational chat, with bidirectional field sync between them.

## Commands

```bash
npm run dev      # Dev server on port 5173
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/context/ApplicationContext.tsx` | Shared state: `collectedFields`, `sessionId`, `phase`, step progress |
| `src/services/aiService.ts` | AI service client: `fetchSchema()`, `createSession(productId?, knownData?, advisorName?, clientContext?)`, `sendMessage()`. `ToolCallInfo` includes `result_data` and `source_label` for source-attributed field mapping. `productId` is optional — when omitted, skips schema fetch and sends empty `questions` |
| `src/services/prefillService.ts` | Pre-fill API client: `fetchClients()`, `runPrefill()`, `runPrefillWithDocument()`, `runPrefillStream()` (SSE) |
| `src/services/apiService.ts` | Backend API client: `getProducts()`, `getApplication()`, `validateApplication()`, `submitApplication()` (hardcoded base URL) |
| `src/services/applicationStorageService.ts` | localStorage save/resume: `listSaves()`, `saveApplication()`, `loadApplicationData()`, `markSubmitted()`, `deleteApplication()` |
| `src/types/application.ts` | Canonical types: `ApplicationDefinition`, `PageDefinition`, `QuestionDefinition`, `AnswerMap`, visibility/validation types |
| `src/hooks/useWidgetSync.ts` | Bridges widget.js CustomEvents ↔ React context, exports `openWidget()` |
| `src/pages/PrefillPage.tsx` | CRM client selector + doc upload → agent results → session start |
| `src/pages/AIExperiencePage.tsx` | Chat-driven advisor experience: two-panel layout (ChatPanel left, FieldMappingPanel right) with auto-created advisor session, source-attributed field accumulation, product selection, Retell calls, and wizard launch |
| `src/components/FieldMappingPanel.tsx` | Right-side panel for AI Experience: product dropdown, source summary chips, field matching table (grouped by page with source attribution), raw field list, Call Client and Open in Wizard buttons |
| `src/hooks/useVoiceConnection.ts` | Nova Sonic voice WebSocket hook: getUserMedia, AudioContext, PCM encode/decode, transcript/field events |
| `src/components/VoicePanel.tsx` | Mic button with pulse animation, status label, scrolling role-colored transcript |
| `src/components/ChatPanel.tsx` | Inline text chat panel using `sendMessage()` API, shares session with voice. Displays tool call chips (TOOL_LABELS) between messages and passes `onToolCalls` to parent for agent log integration |
| `src/components/RetellCallPanel.tsx` | Retell outbound call UI: initiate, poll status, live transcript, extracted field display |
| `src/services/retellService.ts` | Retell API client: `initiateCall()`, `getCallStatus()` |
| `src/pages/ApplicationHistoryPage.tsx` | Lists saved/submitted applications from localStorage with resume and delete |
| `src/pages/DocusignReturnPage.tsx` | DocuSign redirect handler after embedded signing |
| `src/features/wizard-v2/WizardPage.tsx` | Dynamic wizard with bidirectional field sync and save/resume |
| `src/features/wizard-v2/formController.tsx` | Form state management, includes `bulkSetValues()` |
| `src/features/wizard-v2/visibility.ts` | Frontend visibility evaluator: AND/OR conditions, ops: `eq`, `neq`, `in`, `contains`, `gt` |
| `src/features/wizard-v2/applicationDefinition.ts` | Static bundled product definition normalizer (fallback when API unavailable) |
| `public/widget.js` | Embeddable chat widget (self-contained IIFE) |

## Bidirectional Sync

Widget and wizard share field data through `ApplicationContext.collectedFields`:

**Widget → Wizard:**
1. Widget dispatches `iri:field_updated` CustomEvents with field data
2. `useWidgetSync` hook listens and calls `mergeFields()` on context
3. `collectedFields` updates trigger `bulkSetValues()` in wizard form controller

**Wizard → Widget:**
1. Form `values` change triggers `mergeFields()` on context
2. When widget reopens, accumulated new fields are sent as a message to existing AI session

**Loop prevention:** `lastAppliedRef` tracks which fields were already synced, preventing infinite update cycles.

## Widget Integration

`public/widget.js` — self-contained IIFE that renders a floating chat bubble (bottom-right):
- Uses Shadow DOM for style isolation
- Markdown rendering via internal `_mdToHtml()` method
- Dispatches `iri:field_updated` and `iri:phase_changed` CustomEvents
- Configured via script tag attributes in `index.html`:
  - `data-api-base` — AI service URL (must point to App Runner URL in production, NOT localhost)

## Wizard v2

`src/features/wizard-v2/` — data-driven form wizard:
- Product selected on `/wizard-v2` (`ProductSelectionPage`) → navigates to `/wizard-v2/:productId`
- Schema fetched from backend `GET /applications/:productId`
- `formController.tsx` manages form state with `bulkSetValues()` for external field injection
- `visibility.ts` evaluates per-question visibility (AND/OR conditions, same logic as backend)
- Supports repeating pages, repeatable groups, and `multi_select` fields
- **Save/resume:** `applicationStorageService.ts` persists form state to localStorage; resume via `/wizard-v2/:productId?resume=<id>`

## Pre-Fill Page

`src/pages/PrefillPage.tsx` — three-stage UI for gathering data before the application starts:

1. **Input stage**: Client selector (`Autocomplete` from `fetchClients()`) and/or document upload (drag-and-drop zone)
2. **Loading stage**: Progress indicator while the AI agent gathers data from CRM, policies, and documents
3. **Results stage**: Shows summary, field count, source chips, and scrollable field preview

**"Start Application" flow:** Calls `createSession('midland-fixed-annuity-001', result.known_data)` → stores session in `ApplicationContext` → navigates to `/` → opens widget with `openWidget()`. Session starts in SPOT_CHECK phase with all pre-filled data as `known_data`.

**API client** (`src/services/prefillService.ts`):
- `fetchClients()` — `GET /api/v1/prefill/clients`
- `runPrefill(clientId)` — `POST /api/v1/prefill`
- `runPrefillWithDocument(file, clientId?)` — `POST /api/v1/prefill/document` (multipart FormData)
- `runPrefillStream(clientId, advisorId, onEvent)` — `POST /api/v1/prefill/stream` (SSE consumer, returns `AbortController`)

## AI Experience Page

`src/pages/AIExperiencePage.tsx` — chat-driven advisor workflow with two-panel layout. No stages, no voice, no SSE.

**Layout:** ChatPanel (left, `md=7`) + FieldMappingPanel (right, `md=5`), full viewport height. RetellCallPanel appears above the chat when a call is active.

**On mount:** Loads products via `getProducts()` and creates an advisor session via `createSession(undefined, undefined, 'Andrew Barnett')` — no product required (empty `questions`). Chat greets: "Hi Andrew! What client would you like to work on today?"

**Data flow:** Advisor types in chat → LLM calls advisor tools → `MessageResponse.tool_calls` includes `result_data` (structured JSON) + `source_label` (e.g., "Redtail CRM") → `handleToolCalls()` extracts key-value pairs into `gatheredFields` Map (keyed by field name, value is `{value, source}`) → FieldMappingPanel renders fields with source attribution chips.

**Product selection:** Advisor selects product from dropdown in FieldMappingPanel → `getApplication(productId)` fetches `ApplicationDefinition` → `computeMatchedFields()` maps gathered data to product questions (handles camelCase/snake_case normalization) → field matching table appears grouped by page with fill percentage.

**Retell call integration:** "Call Client" button in FieldMappingPanel → `callActive=true` → RetellCallPanel appears above chat. Missing fields computed from matched fields. On call completion, extracted fields merge into `gatheredFields` with source "Client Call".

**Launch wizard:** "Open in Wizard" button → normalizes fields to camelCase → `mergeFields()` into ApplicationContext → navigates to `/wizard-v2/:productId`.

**FieldMappingPanel** (`src/components/FieldMappingPanel.tsx`):
- Product dropdown (MUI Select)
- Source summary chips with color coding (e.g., "Redtail CRM: 24", "CRM Notes: 5")
- Field matching table (when product selected): grouped by page, each row shows filled/missing icon, label, value, source chip
- Raw field list (before product selected): simple key-value list with source badges
- Action buttons: "Call Client" (green, disabled when no product or call in progress) and "Open in Wizard" (outlined)
- Source colors: Redtail CRM (blue), CRM Notes (purple), Prior Policies (orange), Document Store (green), Suitability Check (deep purple), Client Call (red)

## Application History

`src/pages/ApplicationHistoryPage.tsx` — lists all saved applications from localStorage:
- Shows in-progress and submitted applications with carrier, product name, status, and relative timestamp
- "Continue" button resumes in-progress applications at `/wizard-v2/:productId?resume=<id>`
- Delete button removes from localStorage
- Empty state links to `/wizard-v2` to start a new application

**Storage keys:** `eapp_saves` (index of all saves) and `eapp_save_data_<id>` (per-application form values + current step).

## AI Chat

AI chat is delivered exclusively via the embeddable widget (`public/widget.js`), not a dedicated page. The widget is available on all pages as a floating chat bubble (bottom-right). It can be opened programmatically via `openWidget()` from `useWidgetSync.ts`.

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_AI_SERVICE_URL` | AI service base URL (default: App Runner URL in production) |

For local development, set `VITE_AI_SERVICE_URL=http://localhost:8001` or update `data-api-base` on the widget script tag in `index.html`.

## API Reference

The canonical source of truth for the backend API is the auto-generated OpenAPI spec at:

```
backend/Assets/annuity-eapp-openapi-3.yaml
```

Before adding or changing any API call in `src/services/apiService.ts`, read this file to verify:
- Correct HTTP method and path
- Required vs optional request body fields and their exact names
- Response shapes and status codes

**Carrier API** (PDF generation, port 8080) is a separate service — its source is in `backend_carrier/`. Endpoints:
- `POST /submit` — save a structured submission; returns `{ submissionId, policyNumber, received }`
- `POST /generate-pdf/:submissionId` — populate PDF from saved submission; returns `application/pdf`

The carrier API base URL (`VITE_CARRIER_URL`) is not yet wired into `apiService.ts`.

---

## MUI Conventions

- Use Grid v2 `size` prop (not legacy `xs`/`sm`/`md` props): `<Grid size={{ xs: 12, md: 6 }}>`
- Import icons individually: `import DeleteIcon from '@mui/icons-material/Delete'` (not `{ Delete }` from barrel)
- Prefer `sx` prop over `styled()` for one-off styles
- Use theme palette colors, not hardcoded hex values
