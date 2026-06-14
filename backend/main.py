# from RepoChat.worker.ingestion.ingest import ingest_repo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.repos import router as repo_router
from backend.routes.auth import router as auth_router


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

import os

frontend_urls = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_urls,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repo_router)
app.include_router(auth_router)

@app.get("/")
async def home():
    return {"message": "Backend running"}

