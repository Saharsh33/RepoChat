from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from worker.tasks import ingest_repo
from backend.database import SessionLocal
from backend.schemas import RepoCreate
from backend.services.repo_service import insert_repo
from backend.services.chat_service import chat_with_repo, chat_with_repo_stream
from backend.schemas import ChatRequest
from backend.models import Repo
from backend.services.auth_service import require_api_key

router = APIRouter()


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

@router.post("/repos")
def create_repo(data: RepoCreate, db: Session = Depends(get_db), _key=Depends(require_api_key)):

    repo = insert_repo(db, data.github_url)
    # trigger celery background task
    ingest_repo.delay(repo.id)

    return {
        "message": "Repository ingestion started",
        "repo_id": repo.id,
        "github_url": data.github_url
    }


@router.get("/repos")
def list_repos(db: Session = Depends(get_db), _key=Depends(require_api_key)):
    repos = db.query(Repo).order_by(Repo.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "repo_name": r.repo_name,
            "github_url": r.github_url,
            "status": r.status,
            "total_files": r.total_files,
            "total_chunks": r.total_chunks,
            "created_at": str(r.created_at) if r.created_at else None,
        }
        for r in repos
    ]


@router.get("/repos/{repo_id}/status")
def get_repo_status(repo_id: int, db: Session = Depends(get_db), _key=Depends(require_api_key)):
    repo = db.query(Repo).filter(Repo.id == repo_id).first()
    if not repo:
        return {"error": "Repo not found"}, 404
    return {
        "id": repo.id,
        "repo_name": repo.repo_name,
        "status": repo.status,
        "total_files": repo.total_files,
        "total_chunks": repo.total_chunks,
        "error_message": repo.error_message,
    }


@router.post("/chat")
def chat(data: ChatRequest, _key=Depends(require_api_key)):

    response = chat_with_repo(
        repo_id=data.repo_id,
        query=data.query,
        history=data.history
    )

    return response


@router.get("/chat/stream")
def chat_stream(
    repo_id: int = Query(...),
    query: str = Query(...),
    _key=Depends(require_api_key),
):
    """SSE endpoint — streams Groq tokens in real-time."""
    return StreamingResponse(
        chat_with_repo_stream(repo_id=repo_id, query=query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )