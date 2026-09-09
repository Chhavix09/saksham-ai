import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.auth import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, TokenOut, UserOut
from utils.security import (
    create_access_token,
    get_current_user,
    hash_password,
    rate_limit,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Demo-mode password reset tokens (never valid in production)
_reset_tokens: dict[str, dict] = {}


def _issue_token(user: User, remember_me: bool) -> TokenOut:
    token = create_access_token(user.id, user.role, remember_me=remember_me)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(request)
    existing = db.query(User).filter(or_(User.email == payload.email.lower(), User.mobile == payload.mobile)).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email or mobile number already exists. Please log in.")
    user = User(
        full_name=payload.full_name.strip(),
        mobile=payload.mobile,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.user_type,
        preferred_language=payload.preferred_language or "en",
        state=payload.state,
        district=payload.district,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token(user, remember_me=False)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(request)
    identifier = payload.identifier.strip().lower()
    user = db.query(User).filter(or_(User.email == identifier, User.mobile == identifier)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect mobile/email or password. Please try again.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated. Please contact support.")
    return _issue_token(user, remember_me=payload.remember_me)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, requests=10)
    identifier = payload.identifier.strip().lower()
    user = db.query(User).filter(or_(User.email == identifier, User.mobile == identifier)).first()
    if user is None:
        # Do not reveal whether the account exists
        return {"message": "If an account exists, a password reset link has been sent.", "demo_token": None}
    token = secrets.token_urlsafe(24)
    _reset_tokens[token] = {"user_id": user.id, "expires": time.monotonic() + 1800}
    # In a real deployment an email/SMS provider sends this link. In demo mode we
    # return it so the flow can be demonstrated end-to-end.
    return {
        "message": "A password reset link has been sent. (Demo mode: the reset token is returned for demonstration.)",
        "demo_token": token,
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    entry = _reset_tokens.pop(payload.token, None)
    if entry is None or time.monotonic() > entry["expires"]:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")
    user = db.get(User, entry["user_id"])
    if user is None:
        raise HTTPException(status_code=400, detail="Account not found.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Your password has been updated. You can now log in."}


@router.post("/logout")
def logout():
    # JWT is stateless; the client discards the token.
    return {"message": "Logged out."}