from worker.celery_app import celery
from worker.ingestion.ingest import ingest_repo as ingest_repo_func
from worker.deletion.delete import delete_repo as delete_repo_func
@celery.task
def ingest_repo(repo_id: int):
    ingest_repo_func(repo_id)

@celery.task
def delete_repo(repo_id: int):
    delete_repo_func(repo_id)