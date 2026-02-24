# API Reference

Base URL: `http://localhost:5000/api/v1`

## Health

### GET /health

Returns service status.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "iri-retirement-api",
  "version": "1.0.0"
}
```

## Schemas

### GET /schemas

List all active carrier schemas.

**Response 200:**
```json
{
  "schemas": [
    {
      "carrier_id": "sample_carrier",
      "carrier_name": "Sample Insurance Co",
      "schema_version": "1.0",
      "product_types": ["annuity", "life"]
    }
  ]
}
```

### GET /schemas/{carrier_id}

Get full carrier schema including steps and fields.

**Parameters:**
- `carrier_id` (path) — Carrier identifier
- `version` (query, optional) — Schema version, defaults to latest

**Response 200:** Full carrier schema object (see DATA_MODEL.md)

**Response 404:**
```json
{
  "error": "Schema not found",
  "carrier_id": "unknown"
}
```

### POST /schemas

Create or update a carrier schema.

**Request body:** Full carrier schema object

**Response 201:**
```json
{
  "carrier_id": "sample_carrier",
  "schema_version": "1.0",
  "message": "Schema created"
}
```

## Applications

### POST /applications

Create a new draft application.

**Request body:**
```json
{
  "carrier_id": "sample_carrier",
  "schema_version": "1.0"
}
```

**Response 201:**
```json
{
  "application_id": "uuid",
  "carrier_id": "sample_carrier",
  "status": "draft",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### GET /applications/{id}

Get application by ID.

**Response 200:** Full application object (see DATA_MODEL.md)

**Response 404:**
```json
{
  "error": "Application not found",
  "application_id": "uuid"
}
```

### PUT /applications/{id}

Save application progress (partial update).

**Request body:**
```json
{
  "data": {
    "owner_first_name": "John",
    "owner_last_name": "Doe"
  }
}
```

**Response 200:**
```json
{
  "application_id": "uuid",
  "status": "draft",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### POST /applications/{id}/validate

Validate application data against its carrier schema without submitting.

**Response 200:**
```json
{
  "valid": true,
  "errors": []
}
```

**Response 200 (with errors):**
```json
{
  "valid": false,
  "errors": [
    {
      "field_id": "owner_first_name",
      "message": "This field is required"
    },
    {
      "field_id": "owner_email",
      "message": "Invalid email format"
    }
  ]
}
```

### POST /applications/{id}/submit

Validate and submit the application. Fails if validation errors exist.

**Response 200:**
```json
{
  "application_id": "uuid",
  "status": "submitted",
  "submitted_at": "2025-01-01T00:00:00Z"
}
```

**Response 400:**
```json
{
  "error": "Validation failed",
  "errors": [
    {
      "field_id": "owner_first_name",
      "message": "This field is required"
    }
  ]
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
- `400` — Bad request / validation error
- `404` — Resource not found
- `500` — Internal server error
