from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import engine, get_db
from models.activity import Application, AuditLog, ChatLog, Recommendation, SavedScheme
from models.scheme import Partner, Scheme
from models.user import USER_ROLES, User
from schemas.auth import UserOut
from schemas.partner import PartnerIn
from schemas.scheme import SchemeIn, SchemeOut
from services.config_service import get_config, set_config
from services.scheduler import scheduler
from utils.security import require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])

require_admin = require_roles("admin")


def _audit(db: Session, actor: User, action: str, entity_type: str = "", entity_id: str = "", details: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor.id, action=action, entity_type=entity_type, entity_id=str(entity_id), details=details or {}))
    db.commit()


# ------------------------------------------------------------------ analytics
@router.get("/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_users_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0
    total_schemes = db.query(func.count(Scheme.id)).scalar() or 0
    active_schemes = db.query(func.count(Scheme.id)).filter(Scheme.active.is_(True)).scalar() or 0
    total_recommendations = db.query(func.count(Recommendation.id)).scalar() or 0
    total_applications = db.query(func.count(Application.id)).scalar() or 0
    submitted = db.query(func.count(Application.id)).filter(
        Application.status.in_(["submitted", "under_review", "approved", "disbursed"])
    ).scalar() or 0
    approved = db.query(func.count(Application.id)).filter(
        Application.status.in_(["approved", "disbursed"])
    ).scalar() or 0
    conversion = round(submitted / total_applications * 100, 1) if total_applications else 0.0
    chats_week = db.query(func.count(ChatLog.id)).filter(ChatLog.created_at >= week_ago).scalar() or 0

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
        "active_users": active_users,
        "new_users_week": new_users_week,
        "total_schemes": total_schemes,
        "active_schemes": active_schemes,
        "total_recommendations": total_recommendations,
        "total_applications": total_applications,
        "applications_submitted": submitted,
        "applications_approved": approved,
        "conversion_rate": conversion,
        "ai_chats_week": chats_week,
        "top_schemes": top_schemes,
        "top_districts": top_districts,
        "partner_utilization": partner_utilization,
        "applications_by_status": applications_by_status,
    }


# -------------------------------------------------------------- applications
@router.get("/applications")
def list_applications(
    status: str = "",
    search: str = "",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Paginated application list across all users (admin only)."""
    limit = max(1, min(limit, 100))
    q = db.query(Application)
    if status:
        q = q.filter(Application.status == status)
    if search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.join(User, Application.user_id == User.id).filter(
            (func.lower(User.full_name).like(term))
            | (func.lower(User.email).like(term))
            | (func.lower(Scheme.scheme_name).like(term))
        )
    total = q.count()
    apps = (
        q.order_by(Application.updated_at.desc())
        .offset(max(0, offset))
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "applications": [
            {
                "id": a.id,
                "scheme_name": a.scheme.scheme_name if a.scheme else None,
                "partner_name": a.partner.name if a.partner else None,
                "applicant": a.user.full_name if a.user else "Unknown",
                "email": a.user.email if a.user else None,
                "status": a.status,
                "loan_amount": (a.financial_info or {}).get("loan_amount"),
                "documents_provided": sum(1 for d in (a.documents or []) if d.get("provided")),
                "documents_total": len(a.documents or []),
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in apps
        ],
    }


@router.patch("/applications/{app_id}/status")
def set_application_status(
    app_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Move an application through its workflow (admin only, audited)."""
    status = payload.get("status")
    allowed = {"not_started", "recommendation_generated", "documents_pending", "submitted", "under_review", "approved", "disbursed", "rejected"}
    if status not in allowed:
        raise HTTPException(status_code=422, detail="Please provide a valid application status.")
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    old_status = app.status
    if status != old_status:
        app.status = status
        db.commit()
        db.refresh(app)
        _audit(db, admin, "application.status", "application", app.id, {"from": old_status, "to": status})
    return {"id": app.id, "status": app.status, "message": "Application status updated."}


# ------------------------------------------------------------------- schemes
@router.post("/schemes", response_model=SchemeOut)
def create_scheme(payload: SchemeIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    scheme = Scheme(**payload.model_dump(), is_demo=True)
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    _audit(db, user, "scheme.create", "scheme", scheme.id, {"name": scheme.scheme_name})
    return scheme


@router.put("/schemes/{scheme_id}", response_model=SchemeOut)
def update_scheme(scheme_id: int, payload: SchemeIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
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
def delete_scheme(scheme_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    scheme = db.get(Scheme, scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    db.delete(scheme)
    db.commit()
    _audit(db, user, "scheme.delete", "scheme", scheme_id, {"name": scheme.scheme_name})
    return {"message": "Scheme deleted."}


@router.post("/scrape-schemes")
async def trigger_scheme_scraper(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        result = await scheduler.execute_sync()
        _audit(db, user, "schemes.scraped", "scheduler", "", result)
        return {
            "message": "Government scheme scrape and database sync completed.",
            "result": result,
            "scheduler_status": scheduler.get_status(),
        }
    except Exception as exc:  # pragma: no cover - defensive admin endpoint guard
        raise HTTPException(status_code=500, detail=f"Scheme scraping failed: {exc}")


@router.get("/scraper-status")
def get_scraper_status(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    status = scheduler.get_status()
    total_schemes = db.query(func.count(Scheme.id)).scalar() or 0
    active_schemes = db.query(func.count(Scheme.id)).filter(Scheme.active.is_(True)).scalar() or 0
    portal_counts = (
        db.query(Scheme.sponsoring_body, func.count(Scheme.id))
        .filter(Scheme.active.is_(True))
        .group_by(Scheme.sponsoring_body)
        .order_by(func.count(Scheme.id).desc())
        .limit(12)
        .all()
    )

    return {
        "scheduler": status,
        "database_stats": {
            "total_schemes": total_schemes,
            "active_schemes": active_schemes,
            "top_sponsoring_bodies": [{"name": body, "count": cnt} for body, cnt in portal_counts],
        },
    }


# ------------------------------------------------------------------ partners
@router.post("/partners")
def create_partner(payload: PartnerIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
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
def update_partner(partner_id: int, payload: PartnerIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
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
def delete_partner(partner_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    partner = db.get(Partner, partner_id)
    if partner is None:
        raise HTTPException(status_code=404, detail="Channel Partner not found.")
    db.delete(partner)
    db.commit()
    _audit(db, user, "partner.delete", "partner", partner_id, {"name": partner.name})
    return {"message": "Channel Partner deleted."}


# -------------------------------------------------------------------- config
@router.get("/config")
def admin_config(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return {
        "recommendation_weights": get_config(db, "recommendation_weights"),
        "partner_weights": get_config(db, "partner_weights"),
        "impact_stats": get_config(db, "impact_stats"),
        "disclaimer": get_config(db, "disclaimer"),
    }


@router.put("/config")
def update_config(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    updated = {}
    for key in ("recommendation_weights", "partner_weights", "impact_stats", "disclaimer"):
        if key in payload and isinstance(payload[key], (dict, str)):
            value = payload[key] if isinstance(payload[key], dict) else {"text": payload[key]}
            updated[key] = set_config(db, key, value)
    _audit(db, user, "config.update", "config", "", {"keys": list(updated)})
    return updated


@router.get("/audit-logs")
def audit_logs(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Recent administrative activity, newest first (admin only)."""
    limit = max(1, min(limit, 200))
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(max(0, offset))
        .limit(limit)
        .all()
    )
    out = []
    for log in logs:
        actor = db.get(User, log.actor_id) if log.actor_id else None
        entity_label = ""
        if log.entity_type == "scheme" and log.entity_id:
            scheme = db.get(Scheme, int(log.entity_id)) if log.entity_id.isdigit() else None
            entity_label = scheme.scheme_name if scheme else ""
        elif log.entity_type == "partner" and log.entity_id:
            partner = db.get(Partner, int(log.entity_id)) if log.entity_id.isdigit() else None
            entity_label = partner.name if partner else ""
        elif log.entity_type == "user" and log.entity_id:
            target = db.get(User, int(log.entity_id)) if log.entity_id.isdigit() else None
            entity_label = target.email if target else ""
        out.append(
            {
                "id": log.id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "entity_label": entity_label,
                "details": log.details,
                "actor": actor.email if actor else "system",
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
        )
    return out


# ------------------------------------------------------------- user management
@router.get("/users")
def list_users(
    search: str = "",
    role: str = "",
    active: str = "",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Paginated user list with search and filters (admin only)."""
    limit = max(1, min(limit, 100))
    q = db.query(User)
    if search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            (func.lower(User.full_name).like(term))
            | (func.lower(User.email).like(term))
            | (User.mobile.like(term))
        )
    if role:
        q = q.filter(User.role == role)
    if active in ("true", "false"):
        q = q.filter(User.is_active.is_(active == "true"))
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(max(0, offset)).limit(limit).all()
    return {
        "total": total,
        "users": [
            {
                **UserOut.model_validate(u).model_dump(),
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "recommendations": db.query(func.count(Recommendation.id)).filter(Recommendation.user_id == u.id).scalar() or 0,
                "applications": db.query(func.count(Application.id)).filter(Application.user_id == u.id).scalar() or 0,
                "chat_messages": db.query(func.count(ChatLog.id)).filter(ChatLog.user_id == u.id).scalar() or 0,
            }
            for u in users
        ],
    }


@router.patch("/users/{user_id}/status")
def set_user_status(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Activate/deactivate an account (admin only, with guardrails)."""
    is_active = payload.get("is_active")
    if not isinstance(is_active, bool):
        raise HTTPException(status_code=422, detail="Please provide is_active as true or false.")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id:
        raise HTTPException(status_code=422, detail="You cannot change the status of your own account.")
    if not is_active and target.role == "admin":
        remaining = db.query(func.count(User.id)).filter(User.role == "admin", User.is_active.is_(True), User.id != target.id).scalar() or 0
        if remaining == 0:
            raise HTTPException(status_code=422, detail="The last active admin account cannot be deactivated.")
    target.is_active = is_active
    db.commit()
    _audit(db, admin, "user.status", "user", target.id, {"is_active": is_active, "email": target.email})
    return {"id": target.id, "is_active": target.is_active, "message": f"Account {'activated' if is_active else 'deactivated'}."}


@router.patch("/users/{user_id}/role")
def set_user_role(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Change a user's role (admin only, with guardrails)."""
    role = payload.get("role")
    if role not in USER_ROLES:
        raise HTTPException(status_code=422, detail="Please provide a valid role.")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id:
        raise HTTPException(status_code=422, detail="You cannot change the role of your own account.")
    if target.role == "admin" and role != "admin":
        remaining = (
            db.query(func.count(User.id))
            .filter(User.role == "admin", User.is_active.is_(True), User.id != target.id)
            .scalar()
            or 0
        )
        if remaining == 0:
            raise HTTPException(status_code=422, detail="The last active admin account cannot be changed.")
    old_role = target.role
    if role != old_role:
        target.role = role
        db.commit()
        _audit(db, admin, "user.role", "user", target.id, {"from": old_role, "to": role, "email": target.email})
    return {"id": target.id, "role": target.role, "message": f"Role updated to {role}."}


# ----------------------------------------------------------------- system overview
@router.get("/system")
def system_overview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """System health + AI usage from real data (no message content is stored)."""
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    new_users_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0
    new_users_month = db.query(func.count(User.id)).filter(User.created_at >= month_ago).scalar() or 0

    # 8-week registration trend (real signups)
    growth = []
    for weeks_back in range(7, -1, -1):
        start = now - timedelta(weeks=weeks_back + 1)
        end = now - timedelta(weeks=weeks_back)
        count = db.query(func.count(User.id)).filter(User.created_at >= start, User.created_at < end).scalar() or 0
        growth.append({"week": f"W-{weeks_back}" if weeks_back else "Now", "count": count})

    # Chatbot / AI usage telemetry (metadata only)
    chats_total = db.query(func.count(ChatLog.id)).scalar() or 0
    chats_today = db.query(func.count(ChatLog.id)).filter(ChatLog.created_at >= day_ago).scalar() or 0
    chats_week = db.query(func.count(ChatLog.id)).filter(ChatLog.created_at >= week_ago).scalar() or 0
    llm_chats = db.query(func.count(ChatLog.id)).filter(ChatLog.used_llm.is_(True)).scalar() or 0
    failed_chats = db.query(func.count(ChatLog.id)).filter(ChatLog.success.is_(False)).scalar() or 0
    avg_latency = db.query(func.avg(ChatLog.latency_ms)).filter(ChatLog.used_llm.is_(True)).scalar()
    provider_rows = db.query(ChatLog.provider, func.count(ChatLog.id)).group_by(ChatLog.provider).all()
    topic_rows = (
        db.query(ChatLog.topic, func.count(ChatLog.id))
        .group_by(ChatLog.topic)
        .order_by(func.count(ChatLog.id).desc())
        .limit(6)
        .all()
    )

    recent_regs = db.query(User).order_by(User.created_at.desc()).limit(6).all()

    # Database health: table row counts + round-trip latency probe
    tables = {}
    for model, name in ((User, "users"), (Scheme, "schemes"), (Partner, "partners"),
                        (Application, "applications"), (Recommendation, "recommendations"),
                        (ChatLog, "chat_logs")):
        try:
            tables[name] = db.query(func.count(model.id)).scalar() or 0
        except Exception:  # noqa: BLE001
            tables[name] = None
    db_latency_ms = None
    try:
        t0 = datetime.utcnow()
        db.execute(func.count(User.id).select())
        db_latency_ms = int((datetime.utcnow() - t0).total_seconds() * 1000)
    except Exception:  # noqa: BLE001
        pass

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admins,
            "new_week": new_users_week,
            "new_month": new_users_month,
            "growth": growth,
        },
        "ai": {
            "total_chats": chats_total,
            "chats_today": chats_today,
            "chats_week": chats_week,
            "llm_chats": llm_chats,
            "fallback_chats": max(0, chats_total - llm_chats),
            "failed_chats": failed_chats,
            "avg_latency_ms": round(avg_latency) if avg_latency is not None else None,
            "by_provider": [{"provider": p or "unknown", "count": c} for p, c in provider_rows],
            "by_topic": [{"topic": t or "general", "count": c} for t, c in topic_rows],
        },
        "recent_registrations": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in recent_regs
        ],
        "database": {
            "dialect": engine.dialect.name,
            "latency_ms": db_latency_ms,
            "tables": tables,
        },
    }