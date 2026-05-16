from worker.celery_app import celery
import time

@celery.task
def ingest_repo(repo_url: str):

    from worker.ingestion.ingest import ingest_repo as ingest_repo_func

    ingest_repo_func(repo_url)