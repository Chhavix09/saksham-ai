"""AI Assistant API endpoints.

The assistant is available to guests and logged-in users alike; when a user is
authenticated, their own (and only their own) data can inform answers.
Credentials never leave the server.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.user import User
from schemas.assistant import ChatIn, ChatOut
from services import assistant_service
from services.assistant_service import AssistantError, assistant_status
from utils.security import get_optional_user, rate_limit

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/status")
def status():
    """Lets the frontend know whether a real AI provider is configured."""
    return assistant_status()


@router.post("/chat", response_model=ChatOut)
def chat(
    payload: ChatIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    rate_limit(
        request,
        requests=settings.ai_request_limit_per_minute,
        window=60,
    )
    history = [{"role": t.role, "content": t.content} for t in payload.history]
    try:
        return assistant_service.generate_reply(db, payload.message, history, user)
    except AssistantError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001 - never leak internals to the client
        raise HTTPException(
            status_code=502,
            detail="The assistant is temporarily unavailable. Please try again in a moment.",
        ) from None
