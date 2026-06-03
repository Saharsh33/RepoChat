import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import UserCreate
from backend.services.auth_service import (
    create_access_token,
    get_password_hash,
    verify_password,
    require_auth,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# 1. LOCAL REGISTRATION
@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pw = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    
    token = create_access_token(data={"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
def me(current_user: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Validate JWT and confirm the user still exists (e.g. after a DB reset)."""
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"username": user.username, "email": user.email}


# 2. LOCAL LOGIN
@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# 3. GOOGLE LOGIN INIT
@router.get("/google/login")
def google_login():
    url = f"https://accounts.google.com/o/oauth2/auth?response_type=code&client_id={GOOGLE_CLIENT_ID}&redirect_uri={GOOGLE_REDIRECT_URI}&scope=openid%20profile%20email&access_type=offline"
    return RedirectResponse(url)

# 4. GOOGLE CALLBACK
@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        # Get access token from Google
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        access_token = token_res.json().get("access_token")
        
        # Fetch user info
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_info = user_res.json()
    
    email = user_info.get("email")
    google_id = user_info.get("id")
    base_username = email.split("@")[0]
    
    # Find or Create User
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
    if not user:
        username = base_username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1
            
        user = User(username=username, email=email, google_id=google_id)
        db.add(user)
        db.commit()
    
    jwt_token = create_access_token(data={"sub": user.username})
    
    # Redirect back to the frontend, embedding the JWT token in the URL hash
    return RedirectResponse(f"{FRONTEND_URL}/#token={jwt_token}")