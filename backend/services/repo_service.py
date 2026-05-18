from backend.models import Repo

def insert_repo(db, github_url):
    repo_name = github_url.rstrip("/").split("/")[-1]
    repo = Repo(
        github_url=github_url,
        repo_name=repo_name,
        status="pending"
    )

    db.add(repo)
    db.commit()
    db.refresh(repo)

    return repo