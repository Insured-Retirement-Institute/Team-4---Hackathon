# Carrier Onboarding Guide

How to add a new insurance carrier to the platform.

## Overview

Adding a new carrier requires **one JSON file** — no code changes. The carrier schema defines all fields, wizard steps, validation rules, and metadata.

## Steps

### 1. Create the Schema File

Copy the sample carrier schema and modify it:

```bash
cp backend/app/schemas/carriers/sample_carrier.json backend/app/schemas/carriers/your_carrier.json
```

### 2. Define Carrier Info

```json
{
  "carrier_id": "your_carrier",
  "carrier_name": "Your Insurance Company",
  "schema_version": "1.0",
  "effective_date": "2025-06-01",
  "product_types": ["annuity"]
}
```

Rules:
- `carrier_id` must be unique, snake_case, no spaces
- `schema_version` uses semver — increment when changing fields
- `product_types` must be from: `annuity`, `life`, `disability`, `long_term_care`

### 3. Define Steps

Steps are the pages of the wizard. Order them logically:

```json
{
  "steps": [
    {
      "step_id": "owner_info",
      "title": "Owner Information",
      "description": "Primary account owner",
      "order": 1,
      "fields": []
    },
    {
      "step_id": "beneficiary_info",
      "title": "Beneficiary Information",
      "order": 2,
      "fields": []
    }
  ]
}
```

### 4. Define Fields

Each step contains fields. Available field types:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text | Name, address |
| `email` | Email with format validation | Email address |
| `phone` | Phone number | Phone |
| `ssn` | Social security number (masked) | SSN |
| `number` | Numeric input | Age |
| `currency` | Dollar amount | Premium |
| `date` | Date picker | Date of birth |
| `select` | Dropdown | State, product type |
| `checkbox` | Boolean toggle | Consent checkboxes |
| `textarea` | Multi-line text | Notes |

Field example:

```json
{
  "field_id": "owner_state",
  "type": "select",
  "label": "State",
  "required": true,
  "options": [
    { "value": "NY", "label": "New York" },
    { "value": "CA", "label": "California" }
  ],
  "validation": {
    "custom_message": "Please select your state of residence"
  }
}
```

### 5. Add Conditional Logic (Optional)

Show/hide fields or steps based on other field values:

```json
{
  "field_id": "annuity_type",
  "type": "select",
  "label": "Annuity Type",
  "required": true,
  "conditions": [
    {
      "field_id": "product_type",
      "operator": "equals",
      "value": "annuity"
    }
  ]
}
```

### 6. Load the Schema

Upload via API:

```bash
curl -X POST http://localhost:5000/api/v1/schemas \
  -H "Content-Type: application/json" \
  -d @backend/app/schemas/carriers/your_carrier.json
```

Or place the file in `backend/app/schemas/carriers/` — it will be seeded on startup in development mode.

### 7. Verify

1. `GET /api/v1/schemas` — your carrier should appear in the list
2. `GET /api/v1/schemas/your_carrier` — full schema returned
3. Open the UI — your carrier appears on the home page
4. Click through the wizard — all fields render correctly

## Schema Validation Checklist

- [ ] `carrier_id` is unique and snake_case
- [ ] All `field_id` values are unique within the schema
- [ ] All `step_id` values are unique
- [ ] Steps have sequential `order` values starting at 1
- [ ] All `select` fields have `options` defined
- [ ] Required fields have `required: true`
- [ ] Validation patterns are valid regex
- [ ] Conditional `field_id` references point to existing fields
