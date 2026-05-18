from worker.celery_app import celery
import time
from worker.ingestion.ingest import ingest_repo as ingest_repo_func

@celery.task
def ingest_repo(repo_id: int):
    ingest_repo_func(repo_id)