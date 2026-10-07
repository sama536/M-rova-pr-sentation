from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import close_session, current_user, hash_password, open_session, verify_password
from ..config import get_settings
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, UserOut, UserUpdate

router = APIRouter(prefix="/api", tags=["comptes"])
DEMO_EMAIL = "demo@formywork.fr"
DEMO_PASSWORD = "demo1234"


def _real_users(db: Session) -> int:
    """Le compte de démonstration ne compte pas dans la limite des 3 comptes."""
    return db.scalar(select(func.count(User.id)).where(User.email != DEMO_EMAIL)) or 0


@router.get("/auth/status")
def auth_status(db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    count = _real_users(db)
    demo_exists = db.scalar(select(User.id).where(User.email == DEMO_EMAIL)) is not None
    return {
        "users": count,
        "max_users": s.max_users,
        "can_register": count < s.max_users,
        "demo_mode": s.demo_mode,
        "demo_login": {"email": DEMO_EMAIL, "password": DEMO_PASSWORD} if s.demo_mode and demo_exists else None,
    }


@router.post("/auth/register", response_model=UserOut)
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    s = get_settings()
    if _real_users(db) >= s.max_users:
        raise HTTPException(403, f"Le nombre maximum de comptes ({s.max_users}) est atteint.")
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Un compte existe déjà avec cette adresse.")
    user = User(email=email, display_name=payload.display_name.strip(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    open_session(db, user, response, request)
    return user


@router.post("/auth/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(user.password_hash, payload.password):
        raise HTTPException(401, "Adresse e-mail ou mot de passe incorrect.")
    open_session(db, user, response, request)
    return user


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    close_session(db, request, response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    if payload.profile_type is not None:
        user.profile_type = payload.profile_type
    if payload.onboarded is not None:
        user.onboarded = payload.onboarded
    if payload.preferences is not None:
        user.preferences = {**(user.preferences or {}), **payload.preferences}
    db.add(user)
    db.commit()
    return user
