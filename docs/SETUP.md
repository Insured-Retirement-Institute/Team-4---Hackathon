# Local Development Setup

## Prerequisites

- Python 3.11+
- Node.js 18+
- AWS CLI configured (or local DynamoDB for offline dev)
- AWS Bedrock access (for AI service)

## AI Service Setup

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # add AWS credentials
python run.py
```

The AI service starts at `http://localhost:8000`. Chat UI at `http://localhost:8000/`. Verify with:

```bash
curl http://localhost:8000/api/v1/health
```

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

### AI Service (`ai-service/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for Bedrock |
| `AWS_ACCESS_KEY_ID` | (empty) | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | (empty) | AWS credentials |
| `AWS_SESSION_TOKEN` | (empty) | For assumed roles |
| `BEDROCK_MODEL` | `anthropic.claude-3-sonnet-20240229-v1:0` | Claude model ID |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `LOG_LEVEL` | `info` | Logging level |

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
docker run -p 8000:8000 amazon/dynamodb-local
AWS_ENDPOINT_URL=http://localhost:8000 python scripts/create-dynamodb-tables.py
```

## Running Tests

```bash
# AI Service
cd ai-service && source venv/bin/activate && pytest

# Backend
cd backend && source venv/bin/activate && pytest

# Frontend
cd frontend && npm test
```
