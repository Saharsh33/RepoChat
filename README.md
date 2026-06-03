# RepoChat

> **Talk to your codebase** — an AI-powered RAG chatbot that ingests GitHub repositories and lets you ask questions about the code in natural language.

![Architecture](https://img.shields.io/badge/stack-FastAPI%20%7C%20Groq%20%7C%20ChromaDB%20%7C%20Vite-818cf8?style=flat-square)

---

## Features

- **Hybrid RAG retrieval** — Semantic search (sentence-transformers) combined with BM25 keyword search and filename matching via ChromaDB
- **Intelligent query routing** — Rewrites follow-up questions using chat history and routes queries to overview, architecture, implementation, or casual handling
- **Adaptive retrieval** — Diverse multi-file retrieval for high-level questions; targeted retrieval for implementation queries; no retrieval for casual messages
- **Real-time streaming** — SSE (Server-Sent Events) streams Groq LLM tokens to the browser in real time
- **Tree-sitter chunking** — Parses Python, JavaScript, TypeScript, Go, Rust, Java, C, and C++ into function/class-level chunks; markdown and plain-text files are chunked separately
- **Background ingestion** — Paste a GitHub URL; the repo is cloned, chunked, embedded, and indexed asynchronously via Celery
- **Repository deletion** — Remove repos from the sidebar context menu; vectors and database records are cleaned up in the background
- **Persistent chat history** — Messages are stored in PostgreSQL, loaded on repo selection, and paginated with "Load Older Messages"
- **Source citations** — Retrieved code chunks are shown with the response; click to open a syntax-highlighted preview or jump to the file on GitHub
- **User accounts** — Register and log in with username/password, or sign in with Google OAuth
- **Per-user isolation** — Each user sees and manages only their own repositories
- **JWT authentication** — Bearer token auth on all repo and chat endpoints; sessions are validated on load
- **Responsive UI** — Dark-themed Vite frontend with markdown rendering, code highlighting, toast notifications, and a mobile sidebar

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
        │ users,    │ │ vectors  │ │  broker  │
        │ repos,    │ │ per repo │ │          │
        │ messages  │ └──────────┘ └──────────┘
        └──────────┘                        │
                                            ▼
                                      ┌──────────┐
                                      │  Celery   │
                                      │  Worker   │
                                      │ ingest /  │
                                      │  delete   │
                                      └──────────┘
```

---

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| **Frontend**   | Vite, Vanilla JS, marked, highlight.js          |
| **Backend**    | FastAPI, Uvicorn, SQLAlchemy, PyJWT, bcrypt     |
| **LLM**        | Groq Cloud (LLaMA 3.3 70B Versatile)            |
| **Embeddings** | sentence-transformers (all-MiniLM-L6-v2)        |
| **Vector DB**  | ChromaDB (persistent, one collection per repo)  |
| **Search**     | Hybrid — cosine similarity + BM25 + filename    |
| **Parsing**    | tree-sitter, tree-sitter-languages, GitPython   |
| **Queue**      | Celery + Redis                                  |
| **Database**   | PostgreSQL 15                                   |
| **Auth**       | JWT (local) + Google OAuth 2.0 (optional)       |
| **Deploy**     | Docker Compose                                  |

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Groq API key](https://console.groq.com/keys)

### 1. Clone and configure

```bash
git clone https://github.com/your-user/RepoChat.git
cd RepoChat
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

JWT_SECRET_KEY=your-super-secret-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Optional: Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

Google OAuth is optional. Username/password registration works without it.

### 2. Build and run

```bash
docker compose up --build
```

This starts 5 containers:

| Container  | Port  | Description                        |
| ---------- | ----- | ---------------------------------- |
| `frontend` | 3000  | Vite-built SPA (nginx)             |
| `backend`  | 8000  | FastAPI + Uvicorn                  |
| `worker`   | —     | Celery ingestion and deletion worker |
| `postgres` | 5432  | Users, repos, chunks, and messages |
| `redis`    | 6379  | Celery message broker              |

First startup may take several minutes while the worker downloads the embedding model.

### 3. Open the app

Navigate to **http://localhost:3000**

### 4. Use it

1. Create an account or sign in with Google
2. Paste a GitHub repo URL in the sidebar and click **Ingest**
3. Wait for the status dot to turn green (ready)
4. Ask questions about the code; responses stream in real time with source citations
5. Right-click a repo in the sidebar to delete it

---

## Local Development (without Docker)

### Backend

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb
export REDIS_URL=redis://localhost:6379/0
export GROQ_API_KEY=gsk_xxx
export JWT_SECRET_KEY=your-secret-key
export FRONTEND_URL=http://localhost:3000

uvicorn backend.main:app --reload --port 8000

# Separate terminal — Celery worker
celery -A worker.tasks worker --loglevel=info --concurrency=1
```

PostgreSQL and Redis must be running (via Docker or locally).

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically.

For production builds, set `VITE_API_BASE` to the backend URL if the frontend is served separately.

---

## API Endpoints

All repo and chat endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

### Authentication

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| POST   | `/api/auth/register`          | Create account (username + password)     |
| POST   | `/api/auth/token`             | Log in (OAuth2 password form)            |
| GET    | `/api/auth/me`                | Validate session and return current user |
| GET    | `/api/auth/google/login`      | Redirect to Google OAuth consent screen  |
| GET    | `/api/auth/google/callback`   | Google OAuth callback (redirects to frontend with JWT) |

### Repositories

| Method | Path                      | Description                              |
| ------ | ------------------------- | ---------------------------------------- |
| POST   | `/repos`                  | Start ingesting a GitHub repository      |
| GET    | `/repos`                  | List current user's repositories         |
| GET    | `/repos/{id}/status`      | Get ingestion status for a repo          |
| DELETE | `/repos/{id}`             | Start background deletion of a repo      |
| GET    | `/repos/{id}/messages`    | Paginated chat history (`skip`, `limit`) |

### Chat

| Method | Path             | Description                                        |
| ------ | ---------------- | -------------------------------------------------- |
| POST   | `/chat`          | Send a chat query (non-streaming, with sources)    |
| GET    | `/chat/stream`   | SSE streaming chat (`repo_id`, `query` query params) |

The frontend calls these through an `/api` prefix. In Docker and Vite dev mode, nginx/Vite rewrites `/api/repos` to `/repos` while keeping `/api/auth/*` unchanged.

---

## Environment Variables

| Variable                          | Required | Description                                      |
| --------------------------------- | -------- | ------------------------------------------------ |
| `GROQ_API_KEY`                    | Yes      | Groq Cloud API key for LLM calls                 |
| `DATABASE_URL`                    | Yes      | PostgreSQL connection string                     |
| `JWT_SECRET_KEY`                  | Yes      | Secret used to sign JWT access tokens            |
| `JWT_ALGORITHM`                   | No       | JWT algorithm (default: `HS256`)                 |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No       | Token lifetime in minutes (default: `60`)        |
| `GOOGLE_CLIENT_ID`                | No       | Google OAuth client ID                           |
| `GOOGLE_CLIENT_SECRET`            | No       | Google OAuth client secret                       |
| `GOOGLE_REDIRECT_URI`             | No       | OAuth callback URL (must match Google Console)   |
| `FRONTEND_URL`                    | No       | Frontend origin for OAuth redirect after login   |
| `VITE_API_BASE`                   | No       | Backend URL for production frontend builds       |

---

## Project Structure

```
RepoChat/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── database.py             # SQLAlchemy engine and session
│   ├── models.py               # User, Repo, Chunk, Message models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── routes/
│   │   ├── auth.py             # Registration, login, Google OAuth
│   │   └── repos.py            # Repo CRUD, chat, message history
│   └── services/
│       ├── auth_service.py     # JWT creation and validation
│       ├── chat_service.py     # RAG chat and SSE streaming
│       └── repo_service.py     # Repo insertion
├── frontend/
│   ├── src/
│   │   ├── main.js             # App shell and DOM layout
│   │   ├── app.js              # Auth, chat, repo management logic
│   │   ├── api.js              # Centralized API client
│   │   └── style.css           # Dark theme styles
│   ├── index.html              # Login modal and app mount point
│   ├── vite.config.js          # Dev proxy and build config
│   ├── Dockerfile              # Multi-stage nginx build
│   └── nginx.conf              # Reverse proxy for /api
├── llm/
│   ├── groq_client.py          # Groq API (streaming and non-streaming)
│   ├── prompts.py              # System prompts per query type
│   └── query_pipeline.py       # Query rewrite and intent routing
├── retrieval/
│   ├── chroma_client.py        # ChromaDB client (persistent)
│   ├── vector_store.py         # Hybrid retrieval, storage, deletion
│   └── schema.py               # Chunk and retrieval schemas
├── worker/
│   ├── celery_app.py           # Celery configuration
│   ├── tasks.py                  # ingest_repo and delete_repo tasks
│   ├── deletion/
│   │   └── delete.py           # Remove ChromaDB collection and DB row
│   ├── embeddings/
│   │   └── embedder.py         # sentence-transformers loader
│   └── ingestion/
│       ├── ingest.py           # Full ingestion pipeline
│       ├── repo_loader.py      # Git clone
│       ├── file_walker.py      # File discovery with skip rules
│       └── chunker.py          # tree-sitter and markdown chunking
├── docker-compose.yml
├── Dockerfile                  # Backend and worker image
├── requirements.txt
└── .env.example
```

---

## License

MIT
