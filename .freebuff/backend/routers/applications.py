from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.activity import Application
from models.scheme import Partner, Scheme
from models.user import User
from schemas.application import ApplicationIn, ApplicationOut, ApplicationStatusIn
from utils.security import get_current_user

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _out(app: Application) -> ApplicationOut:
    return ApplicationOut(
        id=app.id,
        user_id=app.user_id,
        scheme_id=app.scheme_id,
        partner_id=app.partner_id,
        status=app.status,
        applicant_info=app.applicant_info,
        financial_info=app.financial_info,
        documents=app.documents,
        review_notes=app.review_notes,
        scheme_name=app.scheme.scheme_name if app.scheme else None,
        partner_name=app.partner.name if app.partner else None,
        created_at=app.created_at.isoformat() if app.created_at else "",
        updated_at=app.updated_at.isoformat() if app.updated_at else "",
    )


@router.post("", response_model=ApplicationOut)
def create_application(payload: ApplicationIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Scheme, payload.scheme_id) is None:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    if payload.partner_id and db.get(Partner, payload.partner_id) is None:
        raise HTTPException(status_code=404, detail="Channel Partner not found.")
    app = Application(
        user_id=user.id,
        scheme_id=payload.scheme_id,
        partner_id=payload.partner_id,
        status="documents_pending" if payload.documents else "not_started",
        applicant_info=payload.applicant_info,
        financial_info=payload.financial_info,
        documents=payload.documents,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _out(app)


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Application).filter(Application.user_id == user.id).order_by(Application.created_at.desc())
    if user.role == "admin":
        q = db.query(Application).order_by(Application.created_at.desc())
    return [_out(a) for a in q.all()]


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(app_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = db.get(Application, app_id)
    if app is None or (app.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Application not found.")
    return _out(app)


@router.patch("/{app_id}/status", response_model=ApplicationOut)
def update_status(app_id: int, payload: ApplicationStatusIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = db.get(Application, app_id)
    if app is None or (app.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Application not found.")
    allowed = {
        "not_started", "recommendation_generated", "documents_pending", "submitted",
        "under_review", "approved", "disbursed", "rejected",
    }
    if payload.status not in allowed:
        raise HTTPException(status_code=422, detail="Please choose a valid application status.")
    app.status = payload.status
    db.commit()
    db.refresh(app)
    return _out(app)