from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.scheme import Partner
from schemas.partner import PartnerNearbyIn, PartnerOut, PartnerRecommendIn
from services.partner_router import recommend_partners

router = APIRouter(prefix="/api/partners", tags=["partners"])


def _payload(p: Partner) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "partner_type": p.partner_type,
        "address": p.address,
        "state": p.state,
        "district": p.district,
        "city": p.city,
        "pincode": p.pincode,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "contact_person": p.contact_person,
        "phone": p.phone,
        "email": p.email,
        "fund_utilization_percent": p.fund_utilization_percent,
        "processing_status": p.processing_status,
        "npa_indicator": p.npa_indicator,
        "is_active": p.is_active,
        "is_demo": p.is_demo,
        "supported_scheme_ids": [s.id for s in p.supported_schemes],
    }


@router.get("", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db)):
    return db.query(Partner).order_by(Partner.state, Partner.name).all()


@router.get("/nearby")
def nearby_partners(latitude: float | None = None, longitude: float | None = None,
                    radius_km: float = 50.0, scheme_id: int | None = None, db: Session = Depends(get_db)):
    if latitude is None or longitude is None:
        raise HTTPException(status_code=422, detail="Please share your location or enter latitude and longitude.")
    return recommend_partners(db, latitude=latitude, longitude=longitude,
                              scheme_id=scheme_id, radius_km=radius_km)


@router.post("/recommend")
def recommend(payload: PartnerRecommendIn, db: Session = Depends(get_db)):
    result = recommend_partners(
        db,
        latitude=payload.latitude,
        longitude=payload.longitude,
        scheme_id=payload.scheme_id,
        radius_km=payload.radius_km,
        state=payload.state,
        district=payload.district,
    )
    if not result["partners"] and not payload.latitude:
        # Fall back to state-based search so the user still sees options
        result = recommend_partners(db, scheme_id=payload.scheme_id, state=payload.state, district=payload.district, radius_km=payload.radius_km)
    return result


@router.get("/{partner_id}")
def get_partner(partner_id: int, db: Session = Depends(get_db)):
    partner = db.get(Partner, partner_id)
    if partner is None:
        raise HTTPException(status_code=404, detail="Channel Partner not found.")
    return _payload(partner)