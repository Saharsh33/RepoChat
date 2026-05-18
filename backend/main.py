# from RepoChat.worker.ingestion.ingest import ingest_repo
from fastapi import FastAPI
from backend.routes.repos import router as repo_router



from contextlib import asynccontextmanager
from backend.database import engine
from backend.models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run on startup
    Base.metadata.create_all(bind=engine)
    yield
    # Anything after yield runs on shutdown

app = FastAPI(lifespan=lifespan)
app.include_router(repo_router)
@app.get("/")
async def home():
    return {"message": "Backend running"}

@app.get("/test")
async def run_task():

    test_task.delay()

    return {"message": "Task queued"}



