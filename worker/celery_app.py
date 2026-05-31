from celery import Celery
from celery.signals import worker_process_init

celery = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
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