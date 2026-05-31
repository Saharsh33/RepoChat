import chromadb

VECTOR_DB_PATH = "/app/vector_db"

_client = None


def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=VECTOR_DB_PATH)
    return _client


def reset_client():
    """Drop cached client so forked Celery workers get a fresh connection."""
    global _client
    _client = None
