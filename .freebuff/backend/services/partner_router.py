"""Smart Channel Partner router.

Ranks partners by a configurable blend of:
  distance, scheme compatibility, active status, fund availability,
  processing eligibility and NPA / risk indicators.

Hard filters (never recommended): inactive partners, partners with
processing_status == "paused", partners that do not support the selected
scheme (when a scheme is specified).
"""

import math

from sqlalchemy.orm import Session

from models.scheme import Partner, Scheme
from services.config_service import get_config

DEFAULT_WEIGHTS = {
    "distance": 40,
    "scheme_compatibility": 25,
    "fund_utilization": 15,
    "processing": 10,
    "active": 10,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _partner_payload(partner: Partner) -> dict:
    return {
        "id": partner.id,
        "name": partner.name,
        "partner_type": partner.partner_type,
        "address": partner.address,
        "state": partner.state,
        "district": partner.district,
        "city": partner.city,
        "pincode": partner.pincode,
        "latitude": partner.latitude,
        "longitude": partner.longitude,
        "contact_person": partner.contact_person,
        "phone": partner.phone,
        "email": partner.email,
        "fund_utilization_percent": partner.fund_utilization_percent,
        "processing_status": partner.processing_status,
        "npa_indicator": partner.npa_indicator,
        "is_active": partner.is_active,
        "is_demo": partner.is_demo,
        "supported_scheme_ids": [s.id for s in partner.supported_schemes],
    }


def recommend_partners(
    db: Session,
    latitude: float | None = None,
    longitude: float | None = None,
    scheme_id: int | None = None,
    radius_km: float = 50.0,
    state: str | None = None,
    district: str | None = None,
    partner_type: str | None = None,
) -> dict:
    weights = get_config(db, "partner_weights") or DEFAULT_WEIGHTS

    partners = db.query(Partner).filter(Partner.is_active.is_(True)).all()
    if partner_type:
        partners = [p for p in partners if p.partner_type == partner_type]
    # Without coordinates, prefer partners in the user's district, then state.
    if latitude is None and district:
        in_district = [p for p in partners if p.district == district]
        if in_district:
            partners = in_district

    ranked, excluded = [], []
    for p in partners:
        reason = None
        if scheme_id:
            supported = {s.id for s in p.supported_schemes}
            if scheme_id not in supported:
                reason = "This partner does not currently support the selected scheme."
        if p.processing_status == "paused":
            reason = reason or "This partner is currently not accepting new applications."
        if not p.is_active:
            reason = reason or "This partner is inactive."

        d = None
        if latitude is not None and longitude is not None:
            d = haversine_km(latitude, longitude, p.latitude, p.longitude)
            if d > radius_km:
                reason = reason or f"Located {d:.1f} km away — beyond the {radius_km:g} km search radius."

        if state and p.state != state:
            reason = reason or "Located in a different state than your search area."

        if reason:
            if d is not None and (d <= radius_km):
                excluded.append({**_partner_payload(p), "excluded_reason": reason, "distance_km": round(d, 1)})
            continue

        if d is None:
            d = 0.0
        dist_score = max(0.0, 100.0 * (1 - d / radius_km)) if radius_km else 100.0
        scheme_score = 100.0 if (not scheme_id or scheme_id in {s.id for s in p.supported_schemes}) else 0.0
        fund_score = max(0.0, 100.0 - p.fund_utilization_percent)
        proc_score = {"available": 100.0, "limited": 60.0, "paused": 0.0}.get(p.processing_status, 50.0)
        active_score = 100.0
        npa_factor = {"none": 1.0, "watch": 0.92, "high": 0.8}.get(p.npa_indicator, 1.0)

        total_w = sum(weights.get(k, 0) for k in ("distance", "scheme_compatibility", "fund_utilization", "processing", "active")) or 100
        score = (
            dist_score * weights.get("distance", 0)
            + scheme_score * weights.get("scheme_compatibility", 0)
            + fund_score * weights.get("fund_utilization", 0)
            + proc_score * weights.get("processing", 0)
            + active_score * weights.get("active", 0)
        ) / total_w
        score *= npa_factor

        ranked.append(
            {
                **_partner_payload(p),
                "distance_km": round(d, 2),
                "recommendation_score": round(score, 1),
                "breakdown": {
                    "distance": round(dist_score, 1),
                    "scheme_compatibility": round(scheme_score, 1),
                    "fund_utilization": round(fund_score, 1),
                    "processing": round(proc_score, 1),
                    "active": round(active_score, 1),
                },
                "scheme_supported": bool(not scheme_id or scheme_id in {s.id for s in p.supported_schemes}),
                "fund_health": "Healthy" if p.fund_utilization_percent < 70 else ("Moderate" if p.fund_utilization_percent < 90 else "Stretched"),
                "processing_label": {"available": "Available", "limited": "Limited", "paused": "Unavailable"}.get(p.processing_status, p.processing_status),
            }
        )

    ranked.sort(key=lambda x: x["recommendation_score"], reverse=True)
    return {
        "partners": ranked,
        "excluded": excluded,
        "weights": weights,
        "search": {
            "latitude": latitude,
            "longitude": longitude,
            "scheme_id": scheme_id,
            "radius_km": radius_km,
            "state": state,
            "district": district,
        },
    }