# Carrier PDF Service

## Overview

PDF population service for carrier forms. Accepts annuity application submissions, maps field data to fillable PDF templates using configurable mapping files, and returns base64-encoded populated PDFs.

## Commands

```bash
npm start                    # Run on port 8080 (or PORT env var)
node generate-fieldmap.js    # Extract all form fields from a PDF template
node verify-pdf-fields.js    # Verify mapping file matches actual PDF fields
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/submit` | Save submission JSON to `apps/` directory |
| POST | `/generate-pdf` | Populate PDF template with submission data, return base64 |

`/generate-pdf` requires `envelope.submissionId` and `envelope.applicationDefinitionId` (e.g., `midland-national-fixed-annuity-v1`).

## Architecture

```
backend_carrier/
├── index.js              # Express app, endpoints, Swagger UI at /api-docs
├── pdfHelper.js          # PDF population with pdf-lib: field extraction, type transforms, nested paths
├── generate-fieldmap.js  # Utility: extract PDF field inventory → maps/{name}_fieldmap.json
├── verify-pdf-fields.js  # Utility: verify mapping ↔ PDF field alignment
├── forms/                # PDF templates (e.g., midland-national-fixed-annuity-v1.pdf)
├── maps/                 # JSON field mappings (jsonPath → pdfField)
├── apps/                 # Saved submission JSON (generated)
└── pdfs/                 # Populated PDFs (generated)
```

## Field Mapping

Mapping files in `maps/` define how submission data maps to PDF form fields:

- **jsonPath** — dot notation path into submission data (e.g., `annuitant.firstName`), supports array indexing (`beneficiaries[0].name`)
- **pdfField** — PDF field name (string or array for split fields like date → month/day/year)
- **dataType** — `text`, `date`, `phone`, `currency`, `number`, `radio`, `checkbox`
- **format** — optional, e.g., `split` for date/phone/currency fields that map to multiple PDF fields
- **options** — value mapping for radio/checkbox (e.g., `{"male": "M", "female": "F"}`)

`pdfHelper.js` uses `getNestedValue()` for dot-notation path resolution and `transformFieldValue()` for type-specific formatting. Form fields are flattened (non-editable) after population.

## Adding New Carriers

1. Add PDF template to `forms/{productId}.pdf`
2. Run `node generate-fieldmap.js` to extract field inventory
3. Create mapping at `maps/{productId}.json` using the field inventory as reference
4. API loads mappings on-demand per request
