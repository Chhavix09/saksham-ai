from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.activity import SavedScheme
from models.scheme import Scheme
from models.user import User
from schemas.auth import UserOut, UserUpdateIn
from schemas.scheme import SchemeOut
from utils.security import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(payload: UserUpdateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    if "mobile" in data and data["mobile"]:
        digits = "".join(ch for ch in data["mobile"] if ch.isdigit())
        if len(digits) < 10:
            raise HTTPException(status_code=422, detail="Please enter a valid mobile number.")
        clash = db.query(User).filter(User.mobile == digits, User.id != user.id).first()
        if clash:
            raise HTTPException(status_code=409, detail="This mobile number is already registered.")
        data["mobile"] = digits
    if "email" in data and data["email"]:
        clash = db.query(User).filter(User.email == data["email"].lower(), User.id != user.id).first()
        if clash:
            raise HTTPException(status_code=409, detail="This email is already registered.")
        data["email"] = data["email"].lower()
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/saved-schemes", response_model=list[SchemeOut])
def list_saved_schemes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    saved = db.query(SavedScheme).filter(SavedScheme.user_id == user.id).all()
    ids = [s.scheme_id for s in saved]
    schemes = db.query(Scheme).filter(Scheme.id.in_(ids)).all() if ids else []
    return schemes


@router.post("/me/saved-schemes/{scheme_id}", response_model=dict)
def save_scheme(scheme_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Scheme, scheme_id) is None:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    existing = db.query(SavedScheme).filter(SavedScheme.user_id == user.id, SavedScheme.scheme_id == scheme_id).first()
    if existing:
        return {"message": "Scheme already saved.", "saved": True}
    db.add(SavedScheme(user_id=user.id, scheme_id=scheme_id))
    db.commit()
    return {"message": "Scheme saved.", "saved": True}


@router.delete("/me/saved-schemes/{scheme_id}", response_model=dict)
def unsave_scheme(scheme_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(SavedScheme).filter(SavedScheme.user_id == user.id, SavedScheme.scheme_id == scheme_id).delete()
    db.commit()
    return {"message": "Scheme removed from saved list.", "saved": False}