from fastapi import APIRouter
from pydantic import BaseModel
from worker.tasks import ingest_repo

router = APIRouter()
class RepoCreateRequest(BaseModel):
    github_url: str

@router.post("/repos")
def create_repo(data: RepoCreateRequest):

    # trigger celery background task
    task = ingest_repo.delay(data.github_url)

    return {
        "message": "Repository ingestion started",
        "task_id": task.id,
        "github_url": data.github_url
    }