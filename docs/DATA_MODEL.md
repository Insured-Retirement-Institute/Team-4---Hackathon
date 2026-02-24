# Data Model — Carrier Schema Format

This document defines the carrier schema format. This is the central contract for the platform.

## Schema Structure

```json
{
  "carrier_id": "sample_carrier",
  "carrier_name": "Sample Insurance Co",
  "schema_version": "1.0",
  "effective_date": "2025-01-01",
  "product_types": ["annuity", "life"],
  "steps": [
    {
      "step_id": "owner_info",
      "title": "Owner Information",
      "description": "Primary account owner details",
      "order": 1,
      "fields": [
        {
          "field_id": "owner_first_name",
          "type": "text",
          "label": "First Name",
          "required": true,
          "validation": {
            "min_length": 1,
            "max_length": 50,
            "pattern": "^[a-zA-Z'-]+$"
          }
        }
      ]
    }
  ],
  "metadata": {
    "submission_endpoint": null,
    "pdf_template_id": null
  }
}
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `carrier_id` | string | yes | Unique carrier identifier (snake_case) |
| `carrier_name` | string | yes | Display name |
| `schema_version` | string | yes | Semver version of this schema |
| `effective_date` | string | yes | ISO date when schema becomes active |
| `product_types` | string[] | yes | Supported product types |
| `steps` | Step[] | yes | Ordered wizard steps |
| `metadata` | object | no | Carrier-specific metadata |

## Step Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step_id` | string | yes | Unique step identifier |
| `title` | string | yes | Step display title |
| `description` | string | no | Helper text shown on step |
| `order` | number | yes | Display order (1-based) |
| `fields` | Field[] | yes | Fields in this step |
| `conditions` | Condition[] | no | Conditions for showing this step |

## Field Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field_id` | string | yes | Unique field identifier |
| `type` | string | yes | One of: `text`, `select`, `date`, `currency`, `checkbox`, `email`, `phone`, `ssn`, `number`, `textarea` |
| `label` | string | yes | Display label |
| `required` | boolean | yes | Whether field is required |
| `placeholder` | string | no | Placeholder text |
| `default_value` | any | no | Default value |
| `options` | Option[] | no | For `select` type — available choices |
| `validation` | Validation | no | Validation rules |
| `conditions` | Condition[] | no | Conditions for showing this field |
| `help_text` | string | no | Tooltip or helper text |
| `group` | string | no | Visual grouping label |

## Option Object (for select fields)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | Option value |
| `label` | string | yes | Display label |

## Validation Object

| Field | Type | Description |
|-------|------|-------------|
| `min_length` | number | Minimum string length |
| `max_length` | number | Maximum string length |
| `pattern` | string | Regex pattern |
| `min_value` | number | Minimum numeric value |
| `max_value` | number | Maximum numeric value |
| `min_date` | string | Minimum date (ISO) |
| `max_date` | string | Maximum date (ISO) |
| `custom_message` | string | Override default error message |

## Condition Object

Conditions control visibility of steps or fields based on other field values.

| Field | Type | Description |
|-------|------|-------------|
| `field_id` | string | The field to check |
| `operator` | string | One of: `equals`, `not_equals`, `in`, `not_in`, `greater_than`, `less_than` |
| `value` | any | The value to compare against |

Example: Show a field only when product type is "annuity":
```json
{
  "conditions": [
    {
      "field_id": "product_type",
      "operator": "equals",
      "value": "annuity"
    }
  ]
}
```

## Application Object

Stored in the Applications DynamoDB table:

```json
{
  "application_id": "uuid",
  "carrier_id": "sample_carrier",
  "schema_version": "1.0",
  "status": "draft",
  "data": {
    "owner_first_name": "John",
    "owner_last_name": "Doe"
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z",
  "submitted_at": null
}
```

### Application Statuses

| Status | Description |
|--------|-------------|
| `draft` | In progress, can be edited |
| `validated` | Passed validation, ready to submit |
| `submitted` | Submitted to carrier |
| `accepted` | Carrier accepted |
| `rejected` | Carrier rejected |
