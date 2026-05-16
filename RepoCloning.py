from git import Repo
import os
import tempfile

def load_repository(source: str):
    """
    Accepts either:
    - GitHub repo URL
    - Local folder path

    Returns local path to repository.
    """

    # Check if input is a GitHub URL
    if source.startswith("http://") or source.startswith("https://"):
        temp_dir = tempfile.mkdtemp()

        print(f"Cloning repo into: {temp_dir}")

        Repo.clone_from(source, temp_dir)

        return temp_dir

    # Check if local path exists
    elif os.path.exists(source):
        print(f"Using local repository: {source}")

        repo = Repo(source)

        # Optional: pull latest changes
        origin = repo.remotes.origin
        origin.pull()

        return source

    else:
        raise ValueError("Invalid GitHub URL or local path")


# Example usage

repo_source = input("Enter GitHub URL or local repo path: ")

repo_path = load_repository(repo_source)

print("Repository ready at:", repo_path)