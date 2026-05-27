# RepoChat

> **Talk to your codebase** — an AI-powered RAG chatbot that ingests GitHub repositories and lets you ask questions about the code in natural language.

![Architecture](https://img.shields.io/badge/stack-FastAPI%20%7C%20Groq%20%7C%20ChromaDB%20%7C%20Vite-818cf8?style=flat-square)

---

## Features

- 🔍 **Hybrid RAG retrieval** — Semantic (sentence-transformers) + BM25 keyword search via ChromaDB
- ⚡ **Real-time streaming** — SSE (Server-Sent Events) streams Groq LLM tokens to the browser in real time
- 📦 **One-click ingestion** — Paste a GitHub URL, the repo is cloned, chunked, embedded & indexed in the background (Celery)
- 🎨 **Clean dark UI** — Vite-powered frontend with markdown rendering, code highlighting, and source citations
- 🔐 **API key auth** — Optional `X-API-Key` header guard (disabled when `REPOCHAT_API_KEY` is not set)

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Frontend   │────▶│   FastAPI     │────▶│  Groq AI  │
│  (Vite/JS)   │ SSE │   Backend     │     │ LLaMA 3.3 │
│  port 3000   │◀────│   port 8000   │     └──────────┘
└─────────────┘     └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ PostgreSQL│ │ ChromaDB │ │  Redis   │
        │  metadata │ │ vectors  │ │  broker  │
        └──────────┘ └──────────┘ └──────────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │  Celery   │
                                 │  Worker   │
                                 └──────────┘
```

---

## Tech Stack

| Layer        | Technology                        |
| ------------ | --------------------------------- |
| **Frontend** | Vite, Vanilla JS, marked, hljs    |
| **Backend**  | FastAPI, Uvicorn, SQLAlchemy       |
| **LLM**      | Groq Cloud (LLaMA 3.3 70B)        |
| **Embeddings** | sentence-transformers (MiniLM)  |
| **Vector DB** | ChromaDB (persistent)            |
| **Search**   | Hybrid — cosine similarity + BM25 |
| **Queue**    | Celery + Redis                     |
| **Database** | PostgreSQL 15                      |
| **Deploy**   | Docker Compose                     |

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running**
- A [Groq API key](https://console.groq.com/keys)

### 1. Clone & configure

```bash
git clone https://github.com/your-user/RepoChat.git
cd RepoChat
cp .env.example .env
```

Edit `.env` and add your Groq key:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Optional: enable API key auth for all endpoints
REPOCHAT_API_KEY=my-secret-key
```

### 2. Build & run

```bash
docker compose up --build
```

This starts 5 containers:
| Container  | Port  | Description              |
| ---------- | ----- | ------------------------ |
| `frontend` | 3000  | Vite-built SPA (nginx)   |
| `backend`  | 8000  | FastAPI + Uvicorn         |
| `worker`   | —     | Celery ingestion worker   |
| `postgres` | 5432  | Metadata & messages       |
| `redis`    | 6379  | Celery message broker     |

### 3. Open the app

Navigate to **http://localhost:3000**

### 4. Use it

1. Paste a GitHub repo URL in the sidebar → click **Ingest**
2. Wait for the status dot to turn **green** (ready)
3. Start chatting! Tokens stream in real time via SSE.

---

## Local Development (without Docker)

### Backend

```bash
# Create a virtual environment
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL & Redis (via Docker or local)
# Set env vars:
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb
export GROQ_API_KEY=gsk_xxx

# Run the API
uvicorn backend.main:app --reload --port 8000

# Run the Celery worker (separate terminal)
celery -A worker.tasks worker --loglevel=info --concurrency=1
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # → http://localhost:3000
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically.

---

## API Endpoints

| Method | Path                     | Description                         |
| ------ | ------------------------ | ----------------------------------- |
| POST   | `/repos`                 | Ingest a GitHub repository          |
| GET    | `/repos`                 | List all repositories               |
| GET    | `/repos/{id}/status`     | Get ingestion status for a repo     |
| POST   | `/chat`                  | Send a chat query (non-streaming)   |
| GET    | `/chat/stream`           | SSE streaming chat (`repo_id`, `query`) |

### Authentication

When `REPOCHAT_API_KEY` is set, all endpoints require the header:

```
X-API-Key: your-key-here
```

When it's **not set**, auth is disabled (open access for local dev).

---

## Project Structure

```
RepoChat/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLAlchemy engine & session
│   ├── models.py            # Repo, Chunk, Message models
│   ├── schemas.py           # Pydantic request schemas
│   ├── routes/
│   │   └── repos.py         # All API endpoints
│   └── services/
│       ├── auth_service.py   # API key auth guard
│       ├── chat_service.py   # RAG chat + SSE streaming
│       └── repo_service.py   # Repo CRUD
├── frontend/                 # Vite vanilla JS app
│   ├── src/
│   │   ├── main.js           # Entry point (renders DOM)
│   │   ├── app.js            # App logic & event handlers
│   │   ├── api.js            # Centralized API client
│   │   └── style.css         # Dark theme styles
│   ├── vite.config.js        # Dev proxy + build config
│   ├── Dockerfile            # Multi-stage nginx build
│   └── nginx.conf            # Reverse proxy for /api
├── llm/
│   ├── groq_client.py        # Groq API (streaming + non-streaming)
│   └── prompts.py            # System prompt
├── retrieval/
│   ├── vector_store.py       # ChromaDB + BM25 hybrid retrieval
│   └── schema.py             # Chunk/retrieval schemas
├── worker/
│   ├── celery_app.py         # Celery config
│   ├── tasks.py              # Background ingestion task
│   ├── embeddings/           # Embedding model loader
│   └── ingestion/            # Repo clone, parse, chunk
├── docker-compose.yml
├── Dockerfile                # Backend image
├── requirements.txt
└── .env.example
```

---

## License

MIT