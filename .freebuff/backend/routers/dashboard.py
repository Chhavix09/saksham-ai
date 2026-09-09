from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.activity import Application, Recommendation, SavedScheme
from models.scheme import Partner, Scheme
from models.user import User
from services.partner_router import recommend_partners
from utils.security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    latest_rec = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .order_by(Recommendation.created_at.desc())
        .first()
    )
    apps = db.query(Application).filter(Application.user_id == user.id).order_by(Application.created_at.desc()).all()
    saved = db.query(SavedScheme).filter(SavedScheme.user_id == user.id).all()
    saved_ids = [s.scheme_id for s in saved]
    saved_schemes = db.query(Scheme).filter(Scheme.id.in_(saved_ids)).all() if saved_ids else []

    recommendation = None
    if latest_rec:
        recommended = db.get(Scheme, latest_rec.recommended_scheme_id) if latest_rec.recommended_scheme_id else None
        recommendation = {
            "id": latest_rec.id,
            "scheme_name": recommended.scheme_name if recommended else None,
            "scheme_id": recommended.id if recommended else None,
            "eligibility_score": latest_rec.eligibility_score,
            "confidence_score": latest_rec.confidence_score,
            "match_breakdown": latest_rec.match_breakdown,
            "created_at": latest_rec.created_at.isoformat() if latest_rec.created_at else None,
        }

    # Recommended partner: use the user's location if known, else nearest to a known city
    nearest_partner = None
    if user.state and user.district:
        result = recommend_partners(db, scheme_id=recommendation["scheme_id"] if recommendation else None,
                                    state=user.state, district=user.district, radius_km=200)
        if result["partners"]:
            nearest_partner = result["partners"][0]

    application_payloads = []
    for app in apps:
        application_payloads.append(
            {
                "id": app.id,
                "scheme_name": app.scheme.scheme_name if app.scheme else "Scheme",
                "partner_name": app.partner.name if app.partner else None,
                "status": app.status,
                "created_at": app.created_at.isoformat() if app.created_at else "",
                "updated_at": app.updated_at.isoformat() if app.updated_at else "",
            }
        )

    return {
        "user": {
            "full_name": user.full_name,
            "role": user.role,
            "preferred_language": user.preferred_language,
        },
        "recommendation": recommendation,
        "applications": application_payloads,
        "saved_schemes": [
            {"id": s.id, "scheme_name": s.scheme_name, "category": s.category, "interest_rate": s.interest_rate,
             "maximum_loan": s.maximum_loan}
            for s in saved_schemes
        ],
        "nearest_partner": nearest_partner,
        "partner_total": db.query(Partner).filter(Partner.is_active.is_(True)).count(),
    }