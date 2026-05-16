from git import Repo
import os
import shutil


def clone_repo(repo_url: str):

    repo_name = repo_url.split("/")[-1].replace(".git", "")

    clone_path = f"./repos/{repo_name}"

    # delete old repo if exists
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path)

    Repo.clone_from(repo_url, clone_path)

    print(f"Repo cloned at: {clone_path}")

    return clone_path