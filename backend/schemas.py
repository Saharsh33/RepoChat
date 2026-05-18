from pydantic import BaseModel

class RepoCreate(BaseModel):
    github_url: str