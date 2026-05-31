from backend.database import SessionLocal
from backend.models import Repo
from retrieval.vector_store import deleteRepo


def delete_repo(repo_id: int):
    db = SessionLocal()
    try:
        deleteRepo(str(repo_id))
    except Exception:
        pass # pass when collection does not exist

        # remove from postgres too
        repo = db.query(Repo).filter(Repo.id == repo_id).first()
        if repo:
            db.delete(repo)
            db.commit()
    finally:
        db.close()