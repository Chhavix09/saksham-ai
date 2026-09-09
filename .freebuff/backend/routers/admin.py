from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.activity import Application, AuditLog, Recommendation, SavedScheme
from models.scheme import Partner, Scheme
from models.user import User
from schemas.partner import PartnerIn
from schemas.scheme import SchemeIn, SchemeOut
from services.config_service import get_config, set_config
from utils.security import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _audit(db: Session, actor: User, action: str, entity_type: str = "", entity_id: str = "", details: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor.id, action=action, entity_type=entity_type, entity_id=str(entity_id), details=details or {}))
    db.commit()


# ------------------------------------------------------------------ analytics
@router.get("/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    total_users = db.query(func.count(User.id)).scalar() or 0
    total_recommendations = db.query(func.count(Recommendation.id)).scalar() or 0
    total_applications = db.query(func.count(Application.id)).scalar() or 0
    submitted = db.query(func.count(Application.id)).filter(
        Application.status.in_(["submitted", "under_review", "approved", "disbursed"])
    ).scalar() or 0
    conversion = round(submitted / total_applications * 100, 1) if total_applications else 0.0

    # Most recommended schemes
    rows = (
        db.query(Recommendation.recommended_scheme_id, func.count(Recommendation.id))
        .filter(Recommendation.recommended_scheme_id.isnot(None))
        .group_by(Recommendation.recommended_scheme_id)
        .order_by(func.count(Recommendation.id).desc())
        .limit(6)
        .all()
    )
    top_schemes = []
    for scheme_id, count in rows:
        scheme = db.get(Scheme, scheme_id)
        top_schemes.append({"scheme_name": scheme.scheme_name if scheme else f"Scheme #{scheme_id}", "count": count})

    # Most searched districts (from recommendation input snapshots)
    districts: dict[str, int] = {}
    for rec in db.query(Recommendation).all():
        loc = (rec.input_snapshot or {}).get("location") or {}
        district = loc.get("district")
        if district:
            districts[district] = districts.get(district, 0) + 1
    top_districts = [{"district": k, "count": v} for k, v in sorted(districts.items(), key=lambda x: -x[1])[:6]]

    # Partner utilization
    partners = db.query(Partner).order_by(Partner.fund_utilization_percent.desc()).all()
    partner_utilization = [
        {"name": p.name, "utilization": p.fund_utilization_percent, "status": p.processing_status} for p in partners
    ]

    status_rows = (
        db.query(Application.status, func.count(Application.id)).group_by(Application.status).all()
    )
    applications_by_status = {s: c for s, c in status_rows}

    return {
        "total_users": total_users,
        "total_recommendations": total_recommendations,
        "total_applications": total_applications,
        "applications_submitted": submitted,
        "conversion_rate": conversion,
        "top_schemes": top_schemes,
        "top_districts": top_districts,
        "partner_utilization": partner_utilization,
        "applications_by_status": applications_by_status,
    }


# ------------------------------------------------------------------- schemes
@router.post("/schemes", response_model=SchemeOut)
def create_scheme(payload: SchemeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    scheme = Scheme(**payload.model_dump(), is_demo=True)
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    _audit(db, user, "scheme.create", "scheme", scheme.id, {"name": scheme.scheme_name})
    return scheme


@router.put("/schemes/{scheme_id}", response_model=SchemeOut)
def update_scheme(scheme_id: int, payload: SchemeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    scheme = db.get(Scheme, scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    for key, value in payload.model_dump().items():
        setattr(scheme, key, value)
    db.commit()
    db.refresh(scheme)
    _audit(db, user, "scheme.update", "scheme", scheme.id, {"name": scheme.scheme_name})
    return scheme


@router.delete("/schemes/{scheme_id}")
def delete_scheme(scheme_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    scheme = db.get(Scheme, scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    db.delete(scheme)
    db.commit()
    _audit(db, user, "scheme.delete", "scheme", scheme_id, {"name": scheme.scheme_name})
    return {"message": "Scheme deleted."}


# ------------------------------------------------------------------ partners
@router.post("/partners")
def create_partner(payload: PartnerIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    data = payload.model_dump()
    ids = data.pop("supported_scheme_ids", [])
    partner = Partner(**data, is_demo=True)
    partner.supported_schemes = [s for s in db.query(Scheme).filter(Scheme.id.in_(ids)).all()] if ids else []
    db.add(partner)
    db.commit()
    db.refresh(partner)
    _audit(db, user, "partner.create", "partner", partner.id, {"name": partner.name})
    return partner


@router.put("/partners/{partner_id}")
def update_partner(partner_id: int, payload: PartnerIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    partner = db.get(Partner, partner_id)
    if partner is None:
        raise HTTPException(status_code=404, detail="Channel Partner not found.")
    data = payload.model_dump()
    ids = data.pop("supported_scheme_ids", None)
    for key, value in data.items():
        setattr(partner, key, value)
    if ids is not None:
        partner.supported_schemes = [s for s in db.query(Scheme).filter(Scheme.id.in_(ids)).all()] if ids else []
    db.commit()
    db.refresh(partner)
    _audit(db, user, "partner.update", "partner", partner.id, {"name": partner.name})
    return partner


@router.delete("/partners/{partner_id}")
def delete_partner(partner_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    partner = db.get(Partner, partner_id)
    if partner is None:
        raise HTTPException(status_code=404, detail="Channel Partner not found.")
    db.delete(partner)
    db.commit()
    _audit(db, user, "partner.delete", "partner", partner_id, {"name": partner.name})
    return {"message": "Channel Partner deleted."}


# -------------------------------------------------------------------- config
@router.get("/config")
def admin_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return {
        "recommendation_weights": get_config(db, "recommendation_weights"),
        "partner_weights": get_config(db, "partner_weights"),
        "impact_stats": get_config(db, "impact_stats"),
        "disclaimer": get_config(db, "disclaimer"),
    }


@router.put("/config")
def update_config(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    updated = {}
    for key in ("recommendation_weights", "partner_weights", "impact_stats", "disclaimer"):
        if key in payload and isinstance(payload[key], (dict, str)):
            value = payload[key] if isinstance(payload[key], dict) else {"text": payload[key]}
            updated[key] = set_config(db, key, value)
    _audit(db, user, "config.update", "config", "", {"keys": list(updated)})
    return updated


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "actor": db.get(User, log.actor_id).email if log.actor_id and db.get(User, log.actor_id) else "system",
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]