"""
Authentication endpoints for health worker login and session management.

POST /auth/login - Login with username/password
GET /auth/me - Get current logged-in user info

NOTE: This uses plain-text password storage for development only.
TODO: Before any real deployment, implement password hashing (passlib[bcrypt])
      and proper token-based sessions with expiry (JWT or similar).
"""

import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import User, AuthToken, get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: int
    username: str
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    """Dependency to extract and validate the current user from the Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )

    token = parts[1]

    # Look up user_id from database
    auth_token = db.query(AuthToken).filter(AuthToken.token == token).first()
    if auth_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Fetch user from database
    user = db.query(User).filter(User.id == auth_token.user_id).first()
    if not user:
        # Token references a deleted user - clean up the orphaned token
        db.delete(auth_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login with username and password.

    Returns a token that should be included in the Authorization header
    as "Bearer <token>" for subsequent requests.
    """
    # Find user by username
    user = db.query(User).filter(User.username == request.username).first()

    # Validate credentials (plain-text comparison for now — see TODO above)
    if not user or user.password != request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Generate and store session token in database
    token = secrets.token_urlsafe(32)
    auth_token = AuthToken(token=token, user_id=user.id)
    db.add(auth_token)
    db.commit()

    return LoginResponse(
        token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """
    Get the current logged-in user's information.

    Requires a valid token in the Authorization header.
    """
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
    )


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """
    Logout by invalidating the token.

    The token should be included in the Authorization header.
    """
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
            # Remove token from database
            db.query(AuthToken).filter(AuthToken.token == token).delete()
            db.commit()

    return {"status": "logged out"}
