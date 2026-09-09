from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.scheme import Scheme
from schemas.scheme import SchemeOut

router = APIRouter(prefix="/api/schemes", tags=["schemes"])


@router.get("", response_model=list[SchemeOut])
def list_schemes(db: Session = Depends(get_db)):
    return db.query(Scheme).filter(Scheme.active.is_(True)).order_by(Scheme.id).all()


@router.get("/{scheme_id}", response_model=SchemeOut)
def get_scheme(scheme_id: int, db: Session = Depends(get_db)):
    scheme = db.get(Scheme, scheme_id)
    if scheme is None or not scheme.active:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    return scheme