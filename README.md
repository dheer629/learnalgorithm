# Algorithm Learn

Algorithm Learn is a full-stack learning app for browsing, searching, inspecting, and running Python algorithms.

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic
- Data: PostgreSQL, populated from `TheAlgorithms/Python`
- Execution: sandboxed Python execution through the configured Piston API

## Run With Docker

Start Docker Desktop, then run:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/api/health

After the stack is running, populate the algorithm database:

```bash
curl -X POST http://localhost:8000/api/admin/sync
```

The first sync clones `TheAlgorithms/Python`, so it can take a little while.

## Local Development

Install frontend dependencies from the repository root:

```bash
npm install
```

Install backend dependencies:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Run the frontend:

```bash
npm.cmd --workspace frontend run dev
```

Run the backend:

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

For local backend development without Docker, make sure PostgreSQL is running and `DATABASE_URL` points to it.

## Verification

Frontend production build:

```bash
npm.cmd --workspace frontend run build
```

Backend tests:

```bash
cd backend
..\.venv\Scripts\python.exe -m pytest
```

