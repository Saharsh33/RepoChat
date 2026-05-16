from fastapi import APIRouter
from worker.tasks import ingest_repo

router = APIRouter()

@router.get("/repos")
async def get_repos():

    return [
        {
            "id": 1,
            "name": "test-repo",
            "status": "indexing"
        }
    ]

@router.post("/repos")
async def add_repo():

    repo_id = 1

    ingest_repo.delay(
        "https://github.com/test/repo",
        repo_id
    )

    return {
        "message": "Indexing started"
    }