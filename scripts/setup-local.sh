#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== IRI Retirement Application Platform — Local Setup ==="

# Backend setup
echo ""
echo "--- Backend ---"
cd "$REPO_ROOT/backend"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "Installing Python dependencies..."
pip install -r requirements.txt --quiet

if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
fi

# Frontend setup
echo ""
echo "--- Frontend ---"
cd "$REPO_ROOT/frontend"

if [ -f "package.json" ]; then
    echo "Installing Node dependencies..."
    npm install --silent
    if [ ! -f ".env" ]; then
        echo "Creating .env from template..."
        cp .env.example .env 2>/dev/null || true
    fi
else
    echo "No package.json found, skipping frontend setup."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start backend:  cd backend && python run.py"
echo "Start frontend: cd frontend && npm run dev"
