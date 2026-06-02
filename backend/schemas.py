from pydantic import BaseModel
from typing import List, Optional
class RepoCreate(BaseModel):
    github_url: str

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    repo_id: int
    query: str
    history: Optional[List[Message]] = []


class UserCreate(BaseModel):
    username: str
    password: str