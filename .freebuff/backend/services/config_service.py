"""Backend-configurable values: recommendation weights, partner weights, impact stats, disclaimers.

Stored as key/value JSON in the app_config table so administrators can tune the
platform without code changes.
"""

from sqlalchemy.orm import Session

from models.activity import AppConfig

RECOMMENDATION_WEIGHTS = {
    "income": 20,
    "category": 15,
    "activity": 20,
    "loan_amount": 20,
    "project_cost": 15,
    "education": 5,
    "location": 5,
}

PARTNER_WEIGHTS = {
    "distance": 40,
    "scheme_compatibility": 25,
    "fund_utilization": 15,
    "processing": 10,
    "active": 10,
}

IMPACT_STATS = {
    "languages": 8,
    "partners": "dynamic",
    "schemes": "dynamic",
    "recommendations": "dynamic",
    "ai_matching": "true",
}

DISCLAIMER = (
    "SakshamAI provides informational scheme matching and financial estimates based on configured "
    "scheme rules. Final eligibility, sanction, interest terms and loan approval are determined by "
    "the authorized implementing agency or Channel Partner according to applicable guidelines."
)

DEFAULTS = {
    "recommendation_weights": RECOMMENDATION_WEIGHTS,
    "partner_weights": PARTNER_WEIGHTS,
    "impact_stats": IMPACT_STATS,
    "disclaimer": DISCLAIMER,
}


def get_config(db: Session, key: str) -> dict:
    row = db.get(AppConfig, key)
    if row is not None:
        return row.value
    return DEFAULTS.get(key, {})


def set_config(db: Session, key: str, value: dict) -> dict:
    row = db.get(AppConfig, key)
    if row is None:
        row = AppConfig(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    return row.value


def seed_default_config(db: Session) -> None:
    for key, value in DEFAULTS.items():
        if db.get(AppConfig, key) is None:
            db.add(AppConfig(key=key, value=value))
    db.commit()