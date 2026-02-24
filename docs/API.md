# API Reference

## AI Service

Base URL: `http://localhost:8000/api/v1` (local) or `https://<app-runner-url>/api/v1` (deployed)

### GET /health

Returns service status.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "iri-ai-service",
  "version": "1.0.0"
}
```

### POST /sessions

Create a new conversation session.

**Request body:**
```json
{
  "questions": [
    {
      "step_id": "owner_info",
      "title": "Owner Information",
      "fields": [
        {
          "field_id": "owner_first_name",
          "type": "text",
          "label": "First Name",
          "required": true,
          "validation": {"max_length": 50}
        }
      ]
    }
  ],
  "known_data": {
    "owner_first_name": "John",
    "owner_dob": "1965-03-15"
  },
  "callback_url": "https://eapp-api.example.com/applications/abc-123"
}
```

**Response 200:**
```json
{
  "session_id": "uuid",
  "phase": "spot_check",
  "greeting": "Hey there! I've got some info on file already...",
  "field_summary": {"missing": 5, "unconfirmed": 3, "confirmed": 0, "collected": 0},
  "fields": [
    {"field_id": "owner_first_name", "label": "First Name", "status": "unconfirmed", "value": "John"}
  ]
}
```

### POST /sessions/{session_id}/message

Send a user message and get an AI reply.

**Request body:**
```json
{
  "message": "Yeah that all looks right"
}
```

**Response 200:**
```json
{
  "reply": "Great! Now let's talk about the annuity details...",
  "phase": "collecting",
  "updated_fields": [
    {"field_id": "owner_first_name", "status": "confirmed", "value": "John"}
  ],
  "field_summary": {"missing": 5, "unconfirmed": 0, "confirmed": 3, "collected": 0},
  "complete": false
}
```

### GET /sessions/{session_id}

Get current session state.

**Response 200:** Same shape as create session response (without greeting).

### POST /sessions/{session_id}/submit

Submit collected data to the callback URL.

**Response 200:**
```json
{
  "status": "submitted",
  "field_count": 25,
  "submitted_at": "2026-02-24T15:30:00Z"
}
```

### GET /demo/midland-schema

Load the Midland National eApp schema in internal format (for testing).

**Response 200:** Array of step definitions with fields.

---

## Backend

Base URL: `http://localhost:5000/api/v1`

### GET /health

Returns service status.

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

### PUT /applications/{id}

Save application progress (partial update).

### POST /applications/{id}/validate

Validate application data against its carrier schema without submitting.

### POST /applications/{id}/submit

Validate and submit the application. Fails if validation errors exist.

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
