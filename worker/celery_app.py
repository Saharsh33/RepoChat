import os

from celery import Celery
from celery.signals import worker_process_init

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

celery = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@worker_process_init.connect
def _init_chroma_client(**_kwargs):
    from retrieval.chroma_client import reset_client
    reset_client()