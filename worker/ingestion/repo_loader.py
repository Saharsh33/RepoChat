import os
import shutil


import subprocess

def clone_repo(repo_url: str):

    repo_name = repo_url.split("/")[-1].replace(".git", "")

    clone_path = f"./repos/{repo_name}"

    # delete old repo if exists
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path)

    token = os.getenv("GITHUB_TOKEN")
    if token and repo_url.startswith("https://github.com/"):
        repo_url = repo_url.replace("https://github.com/", f"https://{token}@github.com/")

    timeout = int(os.getenv("GIT_CLONE_TIMEOUT", "300"))

    print(f"Cloning repo into {clone_path}...")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, clone_path],
            check=True,
            timeout=timeout,
            capture_output=True
        )
    except subprocess.TimeoutExpired:
        raise Exception("Repository clone timed out. The repository might be too large.")
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to clone repository: {e.stderr.decode('utf-8')}")

    print(f"Repo cloned at: {clone_path}")

    return clone_path