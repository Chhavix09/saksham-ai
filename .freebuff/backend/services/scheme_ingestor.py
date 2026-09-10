"""Load canonical government scheme records from schemes.json."""

import json
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from models.scheme import Scheme

SCHEMES_PATH = Path(__file__).resolve().parent.parent / "schemes.json"
CORE_FIELDS = {
    "scheme_code", "name", "sponsoring_body", "target_categories", "min_income", "max_income",
    "min_project_cost", "max_project_cost", "loan_percentage", "interest_rate_min",
    "interest_rate_max", "tenure_years", "moratorium_months", "eligible_activities",
    "required_documents", "application_mode", "application_url",
}
FIELD_DEFAULTS = {
    "scheme_code": "",
    "name": "",
    "sponsoring_body": "",
    "target_categories": [],
    "min_income": 0.0,
    "max_income": 0.0,
    "min_project_cost": 0.0,
    "max_project_cost": 0.0,
    "loan_percentage": 100.0,
    "interest_rate_min": 0.0,
    "interest_rate_max": 0.0,
    "tenure_years": 0.0,
    "moratorium_months": 0,
    "eligible_activities": [],
    "required_documents": [],
    "application_mode": "",
    "application_url": "",
}


def _category(record: dict) -> str:
    activities = {str(value).upper() for value in record.get("eligible_activities", [])}
    if any("EDUCATION" in value or "COURSE" in value for value in activities):
        return "educational"
    if record.get("max_project_cost", 0) <= 500000:
        return "micro_finance"
    return "term_loan"


def _compatibility_values(record: dict) -> dict:
    activities = [str(value).lower() for value in record.get("eligible_activities", [])]
    purposes = set()
    if any("education" in value or "course" in value for value in activities):
        purposes.add("education")
    if any(value in {"agri_allied", "agri_based_micro_units"} or "agri" in value for value in activities):
        purposes.add("agriculture")
    if activities:
        purposes.update({"start_business", "small_enterprise"})
    loan_percentage = float(record.get("loan_percentage", 100.0))
    return {
        "scheme_name": record["name"],
        "category": _category(record),
        "description": f"{record['name']} by {record['sponsoring_body']}.",
        "minimum_income": int(record.get("min_income", 0)),
        "maximum_income": int(record.get("max_income", 0)),
        "minimum_loan": int(record.get("min_project_cost", 0) * loan_percentage / 100),
        "maximum_loan": int(record.get("max_project_cost", 0) * loan_percentage / 100),
        "interest_rate": float(record.get("interest_rate_min", 0.0)),
        "margin_percentage": max(0.0, 100.0 - loan_percentage),
        "maximum_tenure_months": int(float(record.get("tenure_years", 0.0)) * 12),
        "eligible_purposes": sorted(purposes),
        "eligible_education_types": [],
        "eligibility_rules": {},
        "fund_utilization": None,
        "is_demo": False,
        "active": True,
    }


def _ensure_columns(db: Session) -> None:
    """Add canonical columns to an existing SQLite demo database."""
    inspector = inspect(db.bind)
    existing = {column["name"] for column in inspector.get_columns("schemes")}
    definitions = {
        "scheme_code": "VARCHAR(100)", "name": "VARCHAR(200)", "sponsoring_body": "VARCHAR(200)",
        "target_categories": "JSON", "min_income": "FLOAT", "max_income": "FLOAT",
        "min_project_cost": "FLOAT", "max_project_cost": "FLOAT", "loan_percentage": "FLOAT",
        "interest_rate_min": "FLOAT", "interest_rate_max": "FLOAT", "tenure_years": "FLOAT",
        "eligible_activities": "JSON", "application_mode": "VARCHAR(80)",
        "application_url": "VARCHAR(500)", "extra_attributes": "JSON",
    }
    for column, definition in definitions.items():
        if column not in existing:
            db.execute(text(f"ALTER TABLE schemes ADD COLUMN {column} {definition}"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_schemes_scheme_code ON schemes (scheme_code)"))
    db.commit()


def _backfill_legacy_rows(db: Session) -> None:
    """Populate canonical columns for pre-existing demo rows that predate them.

    Legacy demo schemes are kept (never deleted) but marked inactive once the
    canonical catalogue is loaded. Their NULL canonical columns are derived from
    the legacy display fields so API serialization never crashes.
    """
    legacy = db.query(Scheme).filter(Scheme.scheme_code.is_(None)).all()
    for scheme in legacy:
        changed = False
        if not scheme.name:
            scheme.name = scheme.scheme_name or "Untitled Scheme"
            changed = True
        if not scheme.sponsoring_body:
            scheme.sponsoring_body = "Demo catalogue"
            changed = True
        if scheme.target_categories is None:
            scheme.target_categories = []
            changed = True
        if scheme.min_income is None:
            scheme.min_income = float(scheme.minimum_income or 0)
            changed = True
        if scheme.max_income is None:
            scheme.max_income = float(scheme.maximum_income or 0)
            changed = True
        if scheme.min_project_cost is None:
            scheme.min_project_cost = float(scheme.minimum_loan or 0)
            changed = True
        if scheme.max_project_cost is None:
            margin = scheme.margin_percentage or 0
            base = float(scheme.maximum_loan or 0)
            scheme.max_project_cost = round(base * 100.0 / (100.0 - margin), 2) if margin < 100 else base
            changed = True
        if scheme.loan_percentage is None:
            scheme.loan_percentage = max(0.0, 100.0 - (scheme.margin_percentage or 0))
            changed = True
        if scheme.interest_rate_min is None:
            scheme.interest_rate_min = scheme.interest_rate or 0.0
            changed = True
        if scheme.interest_rate_max is None:
            scheme.interest_rate_max = scheme.interest_rate or 0.0
            changed = True
        if scheme.tenure_years is None:
            scheme.tenure_years = round((scheme.maximum_tenure_months or 0) / 12.0, 2)
            changed = True
        if scheme.eligible_activities is None:
            scheme.eligible_activities = [str(p).upper() for p in (scheme.eligible_purposes or [])]
            changed = True
        if scheme.required_documents is None:
            scheme.required_documents = []
            changed = True
        if scheme.application_mode is None:
            scheme.application_mode = ""
            changed = True
        if scheme.application_url is None:
            scheme.application_url = ""
            changed = True
        if scheme.extra_attributes is None:
            scheme.extra_attributes = {}
            changed = True
        if changed:
            scheme.active = False
            db.add(scheme)
    if legacy:
        db.commit()


def load_schemes_from_json(db: Session) -> list[Scheme]:
    _ensure_columns(db)
    records = json.loads(SCHEMES_PATH.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("schemes.json must contain a list of scheme objects")

    _backfill_legacy_rows(db)
    db.query(Scheme).filter(Scheme.scheme_code.is_(None)).update({Scheme.active: False}, synchronize_session=False)
    loaded = []
    for record in records:
        if not record.get("scheme_code") or not record.get("name"):
            raise ValueError("Every scheme must include scheme_code and name")
        scheme = db.query(Scheme).filter(Scheme.scheme_code == record["scheme_code"]).first()
        if scheme is None:
            scheme = Scheme(scheme_name=record["name"])
            db.add(scheme)
        normalized = {field: record.get(field, default) for field, default in FIELD_DEFAULTS.items()}
        if "max_project_cost" not in record:
            normalized["max_project_cost"] = max(
                float(record.get("max_project_cost_manufacturing", 0)),
                float(record.get("max_project_cost_services", 0)),
            )
        for field in CORE_FIELDS:
            setattr(scheme, field, normalized[field])
        for field, value in _compatibility_values(normalized).items():
            setattr(scheme, field, value)
        scheme.extra_attributes = {key: value for key, value in record.items() if key not in CORE_FIELDS}
        loaded.append(scheme)
    db.commit()
    return loaded