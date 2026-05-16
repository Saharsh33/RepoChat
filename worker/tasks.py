from worker.celery_app import celery
import time

@celery.task
def ingest_repo(url, repo_id):

    repo.status = "indexing"

    try:

        time.sleep(10)

        repo.status = "complete"

    except Exception:

        repo.status = "failed"