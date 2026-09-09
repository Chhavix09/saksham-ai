"""Recommendation engine orchestrator.

Flow:
  User Profile
      -> Eligibility Rules (hard)
      -> Compatible Schemes
      -> Scoring + ML boost
      -> Ranking
      -> Explainable Recommendation
"""

import logging

from sqlalchemy.orm import Session

from models.activity import Recommendation
from models.scheme import Partner, Scheme
from services import explanation_service
from services.config_service import get_config
from services.eligibility_engine import DEFAULT_WEIGHTS, evaluate_scheme
from services.ml_ranker import MLRanker

logger = logging.getLogger("sakshamai.engine")

PURPOSE_LABELS = {
    "start_business": "Starting a business",
    "expand_business": "Expanding a business",
    "agriculture": "Agriculture / allied activity",
    "small_enterprise": "Small enterprise",
    "vehicle_equipment": "Vehicle / equipment",
    "education": "Education",
    "other": "Other need",
}


def _scheme_dict(scheme: Scheme) -> dict:
    return {
        "id": scheme.id,
        "scheme_name": scheme.scheme_name,
        "category": scheme.category,
        "description": scheme.description,
        "minimum_income": scheme.minimum_income,
        "maximum_income": scheme.maximum_income,
        "minimum_loan": scheme.minimum_loan,
        "maximum_loan": scheme.maximum_loan,
        "interest_rate": scheme.interest_rate,
        "margin_percentage": scheme.margin_percentage,
        "moratorium_months": scheme.moratorium_months,
        "maximum_tenure_months": scheme.maximum_tenure_months,
        "eligible_purposes": scheme.eligible_purposes or [],
        "eligible_education_types": scheme.eligible_education_types or [],
        "required_documents": scheme.required_documents or [],
        "fund_utilization": scheme.fund_utilization,
        "is_demo": scheme.is_demo,
    }


def _partner_count_for_scheme(db: Session, scheme: Scheme, state: str | None, district: str | None) -> int:
    """Count active partners supporting the scheme in the user's area."""
    q = db.query(Partner).filter(Partner.is_active.is_(True), Partner.processing_status != "paused")
    q = q.filter(Partner.supported_schemes.any(Scheme.id == scheme.id))
    if state:
        q = q.filter(Partner.state == state)
        if district:
            q = q.filter(Partner.district == district)
    return q.count()


def generate_recommendation(
    db: Session,
    profile: dict,
    user_id: int | None = None,
    save: bool = True,
) -> Recommendation:
    """Run the full pipeline and persist a Recommendation row."""
    profile = {**profile}
    weights = get_config(db, "recommendation_weights") or DEFAULT_WEIGHTS
    profile["weights"] = weights

    purpose = profile.get("purpose", "other")
    state = (profile.get("location") or {}).get("state") if isinstance(profile.get("location"), dict) else None
    district = (profile.get("location") or {}).get("district") if isinstance(profile.get("location"), dict) else None
    if isinstance(profile.get("location"), dict):
        state = profile["location"].get("state") or state
        district = profile["location"].get("district") or district

    # ---- Layer 1 & 2: evaluate every active scheme -------------------------
    schemes = db.query(Scheme).filter(Scheme.active.is_(True)).all()
    results = []
    for scheme in schemes:
        partner_count = _partner_count_for_scheme(db, scheme, state, district)
        res = evaluate_scheme(_scheme_dict(scheme), profile, partner_count)
        res.scheme_obj = scheme  # type: ignore[attr-defined]
        res.partner_count = partner_count  # type: ignore[attr-defined]
        results.append(res)

    # ---- Layer 3: optional ML boost ----------------------------------------
    ml_boosts: dict[int, float] = {}
    history = db.query(Recommendation).order_by(Recommendation.created_at.desc()).limit(60).all()
    if history:
        try:
            ranker = MLRanker()
            ml_boosts = ranker.rank(history, [r.scheme for r in results], profile)
        except Exception as exc:  # pragma: no cover
            logger.warning("ML ranker unavailable: %s", exc)

    # ---- Layer 3 cont: rank -------------------------------------------------
    for res in results:
        boost = ml_boosts.get(res.scheme["id"], 0.0) * 8.0  # small nudge, max +8 pts
        res.final_score = min(100.0, res.eligibility_score + boost)  # type: ignore[attr-defined]

    ranked = sorted(results, key=lambda r: r.final_score, reverse=True)  # type: ignore[attr-defined]

    eligible = [r for r in ranked if r.eligible and r.final_score >= 50]  # type: ignore[attr-defined]
    recommended = eligible[0] if eligible else None
    alternatives = eligible[1:4] if eligible else []
    if recommended is None:
        # Show near-misses so the user learns why nothing matched
        alternatives = [r for r in ranked if not r.eligible][:3] or ranked[:3]

    # ---- Layer 4: explainability -------------------------------------------
    explanation: list = []
    next_steps: list = []
    recommended_payload: dict | None = None
    alternative_payloads: list[dict] = []

    if recommended is not None:
        need = getattr(recommended, "need", 0)
        explanation = explanation_service.build_explanation(
            recommended.scheme,
            recommended.factors,
            need,
            profile.get("project_cost", 0),
            profile.get("income", 0),
            purpose,
            profile.get("education_type"),
            state,
            recommended.partner_count,  # type: ignore[attr-defined]
        )
        next_steps = explanation_service.build_next_steps(
            recommended.scheme, has_partners=recommended.partner_count > 0  # type: ignore[attr-defined]
        )
        recommended_payload = {
            **recommended.scheme,
            "eligibility_score": round(recommended.final_score, 1),  # type: ignore[attr-defined]
            "confidence_score": recommended.confidence,
            "match_breakdown": recommended.factors,
        }

    for alt in alternatives:
        if alt is recommended:
            continue
        alt_need = getattr(alt, "need", 0)
        alt_explanation = explanation_service.build_explanation(
            alt.scheme,
            alt.factors,
            alt_need,
            profile.get("project_cost", 0),
            profile.get("income", 0),
            purpose,
            profile.get("education_type"),
            state,
            alt.partner_count,  # type: ignore[attr-defined]
        )
        alternative_payloads.append(
            {
                **alt.scheme,
                "eligibility_score": round(alt.final_score, 1),  # type: ignore[attr-defined]
                "confidence_score": alt.confidence,
                "match_breakdown": alt.factors,
                "explanation": alt_explanation,
                "failed_factors": alt.failed_factors,
                "notes": alt.notes,
            }
        )

    if recommended is None:
        next_steps = explanation_service.build_next_steps(None)

    rec = Recommendation(
        user_id=user_id,
        input_snapshot={
            **profile,
            "_schemes": [r.scheme for r in ranked[:5]],
            "recommended_scheme_id": recommended.scheme["id"] if recommended else None,
            "alternative_scheme_ids": [a.scheme["id"] for a in alternatives],
        },
        recommended_scheme_id=recommended.scheme["id"] if recommended else None,
        alternative_scheme_ids=[a.scheme["id"] for a in alternatives],
        eligibility_score=round(recommended.final_score, 1) if recommended else 0.0,  # type: ignore[attr-defined]
        confidence_score=recommended.confidence if recommended else 0.0,
        match_breakdown=recommended.factors if recommended else {},
        explanation=explanation,
        next_steps=next_steps,
    )
    if save:
        db.add(rec)
        db.commit()
        db.refresh(rec)

    return {
        "id": rec.id,
        "recommended_scheme": recommended_payload,
        "alternative_schemes": alternative_payloads,
        "eligibility_score": rec.eligibility_score,
        "confidence_score": rec.confidence_score,
        "match_breakdown": rec.match_breakdown,
        "explanation": rec.explanation,
        "next_steps": rec.next_steps,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "is_demo_note": True,
    }