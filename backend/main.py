# from RepoChat.worker.ingestion.ingest import ingest_repo
from fastapi import FastAPI
from backend.routes.repos import router as repo_router



# repo_url = input("Enter GitHub Repo URL: ")
# ingest_repo(repo_url)
app = FastAPI()
app.include_router(repo_router)
@app.get("/")
async def home():
    return {"message": "Backend running"}

@app.get("/test")
async def run_task():

    test_task.delay()

    return {"message": "Task queued"}



