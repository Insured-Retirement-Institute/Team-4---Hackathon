# IRI Retirement Application Platform

A schema-driven platform for processing retirement application submissions across multiple insurance carriers. Built by Team 4 for the IRI Hackathon.

## What It Does

Insurance carriers each have unique application forms with different fields, validation rules, and submission requirements. This platform:

1. **Defines** each carrier's application as a JSON schema
2. **Renders** a dynamic wizard UI from that schema
3. **Validates** input on both client and server against the schema
4. **Submits** completed applications to the carrier

Adding a new carrier = adding one JSON schema file. No code changes needed.

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
python run.py
# API running at http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev
# UI running at http://localhost:5173
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

## Project Structure

```
backend/     Python Flask API server
frontend/    React + TypeScript UI (Vite)
docs/        Architecture and reference documentation
scripts/     Setup and utility scripts
infra/       Infrastructure definitions (DynamoDB)
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design overview
- [Data Model](docs/DATA_MODEL.md) — Carrier schema format specification
- [API Reference](docs/API.md) — Endpoint documentation
- [Setup Guide](docs/SETUP.md) — Local development setup
- [Carrier Onboarding](docs/CARRIER_ONBOARDING.md) — How to add a new carrier

## Tech Stack

- **Backend:** Python, Flask, boto3, jsonschema
- **Frontend:** React, TypeScript, Vite
- **Database:** AWS DynamoDB

## Team

Team 4 — IRI Hackathon

## License

See [LICENSE](LICENSE).
