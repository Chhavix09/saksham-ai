from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.activity import Recommendation
from models.user import User
from schemas.recommendation import RecommendationIn, RecommendationOut
from services.recommendation_engine import generate_recommendation
from utils.security import get_current_user, get_optional_user

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def _to_out(rec: Recommendation) -> dict:
    from services.recommendation_engine import _scheme_dict
    from models.scheme import Scheme

    recommended = None
    alternatives = []
    if rec.recommended_scheme_id:
        scheme = _get_scheme(rec.recommended_scheme_id)
        if scheme:
            recommended = {**_scheme_dict(scheme), "eligibility_score": rec.eligibility_score,
                           "confidence_score": rec.confidence_score, "match_breakdown": rec.match_breakdown}
    for sid in rec.alternative_scheme_ids or []:
        scheme = _get_scheme(sid)
        if scheme:
            alternatives.append(_scheme_dict(scheme))
    return {
        "id": rec.id,
        "recommended_scheme": recommended,
        "alternative_schemes": alternatives,
        "eligibility_score": rec.eligibility_score,
        "confidence_score": rec.confidence_score,
        "match_breakdown": rec.match_breakdown,
        "explanation": rec.explanation,
        "next_steps": rec.next_steps,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "is_demo_note": True,
    }


def _get_scheme(scheme_id: int):
    from database import SessionLocal
    from models.scheme import Scheme

    with SessionLocal() as db:
        return db.get(Scheme, scheme_id)


@router.post("", response_model=RecommendationOut)
def create_recommendation(payload: RecommendationIn, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    profile = payload.model_dump()
    if user is not None:
        profile.setdefault("age", user.age)
        profile.setdefault("income", user.annual_income or profile.get("income", 0))
    result = generate_recommendation(db, profile, user_id=user.id if user else None)
    return result


@router.get("/{rec_id}", response_model=RecommendationOut)
def get_recommendation(rec_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(Recommendation, rec_id)
    if rec is None or (rec.user_id and rec.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    return _to_out(rec)


@router.get("/me/latest")
def latest_recommendation(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .order_by(Recommendation.created_at.desc())
        .first()
    )
    if rec is None:
        return None
    return _to_out(rec)