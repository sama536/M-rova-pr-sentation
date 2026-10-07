"""Comptes (3 personnes maximum), mots de passe hachés avec Argon2, session par cookie httpOnly."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db, utcnow
from .models import AuthSession, User

COOKIE = "fw_session"
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def open_session(db: Session, user: User, response: Response, request: Request) -> None:
    token = secrets.token_urlsafe(32)
    days = get_settings().session_days
    db.add(AuthSession(token_hash=_digest(token), user_id=user.id, expires_at=utcnow() + timedelta(days=days)))
    db.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=days * 86400,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )


def close_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        sess = db.get(AuthSession, _digest(token))
        if sess:
            db.delete(sess)
            db.commit()
    response.delete_cookie(COOKIE, path="/")


def user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    sess = db.get(AuthSession, _digest(token))
    if sess is None or sess.expires_at < utcnow():
        return None
    return db.get(User, sess.user_id)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = user_from_token(db, request.cookies.get(COOKIE))
    if user is None:
        raise HTTPException(status_code=401, detail="Veuillez vous connecter.")
    return user
