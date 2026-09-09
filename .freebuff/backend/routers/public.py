from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.activity import Recommendation
from models.scheme import Partner, Scheme
from services.config_service import get_config
from services.emi_calculator import DISCLAIMER

router = APIRouter(prefix="/api", tags=["public"])

LANGUAGES = ["en", "hi", "gu", "mr", "bn", "ta", "te", "kn"]


@router.get("/health")
def health():
    return {"status": "ok", "service": "SakshamAI API"}


@router.get("/public/stats")
def public_stats(db: Session = Depends(get_db)):
    """Homepage impact-section values, served from the backend so they stay configurable."""
    stats = get_config(db, "impact_stats")
    dynamic = {
        "partners": db.query(Partner).filter(Partner.is_active.is_(True)).count(),
        "schemes": db.query(Scheme).filter(Scheme.active.is_(True)).count(),
        "recommendations": db.query(Recommendation).count(),
    }
    return {"stats": {**stats, **dynamic}, "languages": LANGUAGES}


@router.get("/public/config")
def public_config(db: Session = Depends(get_db)):
    """Expose recommendation weights and disclaimers so the UI can display them transparently."""
    return {
        "recommendation_weights": get_config(db, "recommendation_weights"),
        "partner_weights": get_config(db, "partner_weights"),
        "disclaimer": get_config(db, "disclaimer") or DISCLAIMER,
        "languages": LANGUAGES,
        "app_name": "SakshamAI",
        "tagline": "Find the Right Scheme. Start the Right Journey.",
    }