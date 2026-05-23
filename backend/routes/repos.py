from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from worker.tasks import ingest_repo
from backend.database import SessionLocal
from backend.schemas import RepoCreate
from backend.services.repo_service import insert_repo
from backend.services.chat_service import chat_with_repo
from backend.schemas import ChatRequest
router = APIRouter()


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

@router.post("/repos")
def create_repo(data: RepoCreate, db: Session = Depends(get_db)):

    repo = insert_repo(db, data.github_url)
    # trigger celery background task
    ingest_repo.delay(repo.id)

    return {
        "message": "Repository ingestion started",
        "repo_id": repo.id,
        "github_url": data.github_url
    }
@router.post("/chat")
def chat(data: ChatRequest):

    response = chat_with_repo(
        repo_id=data.repo_id,
        query=data.query,
        history=data.history
    )

    return response