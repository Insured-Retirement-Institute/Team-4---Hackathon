# Wizard Workflow

## Flow
1. `/wizard-v2` → `ProductSelectionPage` — fetches `GET /products`, user picks a product, navigates to `/wizard-v2/:productId`
2. `/wizard-v2/:productId` → `WizardPageV2` — reads `:productId` from route params, fetches `GET /application/:productId` to get an `ApplicationDefinition`, then renders the dynamic form wizard

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
| `src/services/aiService.ts` | AI service client: `fetchSchema()`, `createSession()`, `sendMessage()` |
| `src/services/prefillService.ts` | Pre-fill API client: `fetchClients()`, `runPrefill()`, `runPrefillWithDocument()` |
| `src/services/apiService.ts` | Backend API client: `getProducts()`, `getApplication()`, `validateApplication()`, `submitApplication()` (hardcoded base URL) |
| `src/services/applicationStorageService.ts` | localStorage save/resume: `listSaves()`, `saveApplication()`, `loadApplicationData()`, `markSubmitted()`, `deleteApplication()` |
| `src/types/application.ts` | Canonical types: `ApplicationDefinition`, `PageDefinition`, `QuestionDefinition`, `AnswerMap`, visibility/validation types |
| `src/hooks/useWidgetSync.ts` | Bridges widget.js CustomEvents ↔ React context, exports `openWidget()` |
| `src/pages/PrefillPage.tsx` | CRM client selector + doc upload → agent results → session start |
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
- Schema fetched from backend `GET /application/:productId`
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
