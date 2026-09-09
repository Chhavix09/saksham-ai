from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.scheme import Scheme
from schemas.calculator import EMIBreakdown, EMICalculationIn, SchemeCalculationIn
from services.emi_calculator import calculate_for_scheme, emi_breakdown

router = APIRouter(prefix="/api/calculator", tags=["calculator"])


@router.post("/emi", response_model=EMIBreakdown)
def calculate_emi(payload: EMICalculationIn):
    try:
        return emi_breakdown(
            project_cost=payload.project_cost,
            loan_amount=payload.loan_amount,
            interest_rate=payload.interest_rate,
            tenure_months=payload.tenure_months,
            moratorium_months=payload.moratorium_months,
            own_contribution=payload.own_contribution,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/scheme", response_model=EMIBreakdown)
def calculate_for_scheme_endpoint(payload: SchemeCalculationIn, db: Session = Depends(get_db)):
    scheme = db.get(Scheme, payload.scheme_id)
    if scheme is None or not scheme.active:
        raise HTTPException(status_code=404, detail="Scheme not found.")
    return calculate_for_scheme(scheme, payload.project_cost, payload.own_contribution, payload.tenure_months)