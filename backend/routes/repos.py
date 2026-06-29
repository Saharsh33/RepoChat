import json

from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.database import get_db
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from worker.task_runner import run_ingest, run_delete
from backend.database import SessionLocal
from backend.schemas import RepoCreate
from backend.services.repo_service import insert_repo
from backend.services.chat_service import chat_with_repo, chat_with_repo_stream
from backend.schemas import ChatRequest
from backend.models import Repo, Message, User
from backend.services.auth_service import require_auth


router = APIRouter(prefix="/api")




@router.post("/repos")
def create_repo(
    data: RepoCreate, 
    db: Session = Depends(get_db), 
    current_user: str = Depends(require_auth)
):
    # Fetch the actual user ID from the database using the username in the JWT
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Pass the user.id to the service
    repo = insert_repo(db, data.github_url, user.id)
    run_ingest(repo.id)

    return {
        "message": "Repository ingestion started",
        "repo_id": repo.id,
        "github_url": data.github_url
    }


@router.get("/repos")
def list_repos(
    db: Session = Depends(get_db), 
    current_user: str = Depends(require_auth)
):
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Filter by user.id
    repos = db.query(Repo).filter(Repo.user_id == user.id).order_by(Repo.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "repo_name": r.repo_name,
            "github_url": r.github_url,
            "status": r.status,
            "total_files": r.total_files,
            "total_chunks": r.total_chunks,
            "created_at": str(r.created_at) if r.created_at else None,
        }
        for r in repos
    ]


@router.delete("/repos/{repo_id}")
def remove_repo(
    repo_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_auth),
):
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Ensure the repo exists AND belongs to the current user
    repo = db.query(Repo).filter(Repo.id == repo_id, Repo.user_id == user.id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found or you do not have permission")

    run_delete(repo_id)
    return {"message": "Repository deletion started", "repo_id": repo_id}

@router.get("/repos/{repo_id}/status")
def get_repo_status(
    repo_id: int, 
    db: Session = Depends(get_db), 
    current_user: str = Depends(require_auth)
):
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Filter by user.id
    repo = db.query(Repo).filter(Repo.id == repo_id, Repo.user_id == user.id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
        
    return {
        "id": repo.id,
        "repo_name": repo.repo_name,
        "status": repo.status,
        "total_files": repo.total_files,
        "total_chunks": repo.total_chunks,
        "error_message": repo.error_message,
    }


@router.post("/chat")
def chat(data: ChatRequest, current_user: str = Depends(require_auth), db: Session = Depends(get_db)):

    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Verify ownership
    repo = db.query(Repo).filter(Repo.id == data.repo_id, Repo.user_id == user.id).first()
    if not repo:
        raise HTTPException(status_code=403, detail="Not authorized to access this repository")

    # Load recent chat history from DB for context
    recent_messages = (
        db.query(Message)
        .filter(Message.repo_id == data.repo_id)
        .order_by(Message.created_at.desc())
        .limit(6)
        .all()
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(recent_messages)
    ]

    response = chat_with_repo(
        repo_id=data.repo_id,
        query=data.query,
        history=history
    )

    return response


@router.get("/chat/stream")
def chat_stream(
    repo_id: int, 
    query: str, 
    current_user: str = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Verify ownership
    repo = db.query(Repo).filter(Repo.id == repo_id, Repo.user_id == user.id).first()
    if not repo:
        raise HTTPException(status_code=403, detail="Not authorized to access this repository")
    # 1. Load recent chat history for context
    recent_messages = (
        db.query(Message)
        .filter(Message.repo_id == repo_id)
        .order_by(Message.created_at.desc())
        .limit(6)
        .all()
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(recent_messages)
    ]

    # 2. Save the User's query immediately
    user_message = Message(repo_id=repo_id, role="user", content=query)
    db.add(user_message)
    db.commit()

    # 3. Create a wrapper generator to intercept the stream
    def stream_generator():
        full_response = ""
        
        # Loop through the events coming from your chat_service
        for event in chat_with_repo_stream(repo_id=repo_id, query=query, history=history):
            yield event # Send the chunk to the frontend immediately
            
            # Extract the actual text token to build the complete AI response
            if event.startswith("data: "):
                try:
                    data = json.loads(event[6:])
                    if data.get("type") == "token":
                        full_response += data["content"]
                except json.JSONDecodeError:
                    pass
        
        # 3. Stream has finished! Save the stitched AI response to the DB.
        db_stream = SessionLocal()
        try:
            ai_message = Message(repo_id=repo_id, role="assistant", content=full_response)
            db_stream.add(ai_message)
            db_stream.commit()
        finally:
            db_stream.close()

    # Return the wrapped generator instead of calling chat_with_repo_stream directly
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
@router.get("/repos/{repo_id}/messages")
def get_chat_history(
    repo_id: int, 
    skip: int = 0, 
    limit: int = 20, 
    current_user: str = Depends(require_auth),
    db: Session = Depends(get_db)
):
    # Fetch messages ordered by newest first for pagination
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Verify the user actually owns this repository before proceeding
    repo = db.query(Repo).filter(Repo.id == repo_id, Repo.user_id == user.id).first()
    if not repo:
        raise HTTPException(status_code=403, detail="Not authorized to access this repository")
    messages = (
        db.query(Message)
        .filter(Message.repo_id == repo_id)
        .order_by(desc(Message.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    # Reverse the list so the UI gets them in chronological order (top to bottom)
    return messages[::-1]