# Local Development Setup

## Prerequisites

- Python 3.11+
- Node.js 18+
- AWS CLI configured (or local DynamoDB for offline dev)

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

The API starts at `http://localhost:5000`. Verify with:

```bash
curl http://localhost:5000/api/v1/health
```

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The UI starts at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Flask environment |
| `FLASK_DEBUG` | `1` | Enable debug mode |
| `AWS_REGION` | `us-east-1` | AWS region for DynamoDB |
| `AWS_ENDPOINT_URL` | (empty) | Set to `http://localhost:8000` for local DynamoDB |
| `DYNAMODB_SCHEMAS_TABLE` | `CarrierSchemas` | Schemas table name |
| `DYNAMODB_APPLICATIONS_TABLE` | `Applications` | Applications table name |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:5000/api/v1` | Backend API URL |

## DynamoDB Setup

### Option A: AWS (Free Tier)

DynamoDB free tier includes 25GB storage and 25 RCU/WCU. Just configure AWS credentials and run:

```bash
python scripts/create-dynamodb-tables.py
```

### Option B: Local DynamoDB

```bash
# Using Docker
docker run -p 8000:8000 amazon/dynamodb-local

# Set in backend/.env
AWS_ENDPOINT_URL=http://localhost:8000

# Create tables
python scripts/create-dynamodb-tables.py --endpoint http://localhost:8000
```

## Running Tests

```bash
# Backend
cd backend
python -m pytest

# Frontend
cd frontend
npm test
```

## One-Command Setup

```bash
bash scripts/setup-local.sh
```

This script installs dependencies for both backend and frontend and creates DynamoDB tables.
