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
| `src/hooks/useWidgetSync.ts` | Bridges widget.js CustomEvents ↔ React context, exports `openWidget()` |
| `src/pages/PrefillPage.tsx` | CRM client selector + doc upload → agent results → session start |
| `src/features/wizard-v2/WizardPage.tsx` | Dynamic wizard with bidirectional field sync |
| `src/features/wizard-v2/formController.tsx` | Form state management, includes `bulkSetValues()` |
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
- Schema fetched from backend `GET /application/midland-fixed-annuity-001`
- `formController.tsx` manages form state with `bulkSetValues()` for external field injection
- Visibility conditions evaluated per-question (same AND/OR/NOT logic as backend validation engine)
- Supports repeating pages and repeatable groups

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

## AI Chat

AI chat is delivered exclusively via the embeddable widget (`public/widget.js`), not a dedicated page. The widget is available on all pages as a floating chat bubble (bottom-right). It can be opened programmatically via `openWidget()` from `useWidgetSync.ts`.

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_AI_SERVICE_URL` | AI service base URL (default: App Runner URL in production) |

For local development, set `VITE_AI_SERVICE_URL=http://localhost:8001` or update `data-api-base` on the widget script tag in `index.html`.

## MUI Conventions

- Use Grid v2 `size` prop (not legacy `xs`/`sm`/`md` props): `<Grid size={{ xs: 12, md: 6 }}>`
- Import icons individually: `import DeleteIcon from '@mui/icons-material/Delete'` (not `{ Delete }` from barrel)
- Prefer `sx` prop over `styled()` for one-off styles
- Use theme palette colors, not hardcoded hex values
