"""
Task runner — dispatches background tasks via Celery or in-process threads.

When REDIS_URL is set (Docker / local dev):
    → Uses Celery for distributed task processing

When REDIS_URL is absent (Render free tier):
    → Runs tasks in background threads within the FastAPI process

Switch is automatic — no code changes needed.
"""

import os
import threading


def _use_celery() -> bool:
    """Return True if Celery/Redis infrastructure is available."""
    return bool(os.environ.get("REDIS_URL"))


def run_ingest(repo_id: int):
    """Kick off repo ingestion in the background."""
    if _use_celery():
        from worker.tasks import ingest_repo
        ingest_repo.delay(repo_id)
    else:
        from worker.ingestion.ingest import ingest_repo as ingest_repo_func
        thread = threading.Thread(
            target=ingest_repo_func,
            args=(repo_id,),
            daemon=True,
        )
        thread.start()


def run_delete(repo_id: int):
    """Kick off repo deletion in the background."""
    if _use_celery():
        from worker.tasks import delete_repo
        delete_repo.delay(repo_id)
    else:
        from worker.deletion.delete import delete_repo as delete_repo_func
        thread = threading.Thread(
            target=delete_repo_func,
            args=(repo_id,),
            daemon=True,
        )
        thread.start()
