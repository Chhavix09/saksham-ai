"""Layer 1 & 2 of the AI architecture: hard eligibility rules + compatibility scoring.

Each scheme is scored across six explainable factors. A factor can be:
  matched=True   -> fully satisfied
  partial=True   -> near-miss (softly penalized, still eligible)
  matched=False  -> hard rule failure (scheme cannot be recommended)

Weights are configurable from the backend (stored in the app_config table).
"""

from dataclasses import dataclass, field

DEFAULT_WEIGHTS = {
    "income": 25,
    "purpose": 25,
    "loan_amount": 20,
    "project_cost": 15,
    "education": 10,
    "location": 5,
}

# Ideal project_cost / max_loan windows per category: (lo, hi) -> full score
PROJECT_WINDOWS = {
    "micro_finance": [(0.0, 1.5), (1.5, 3.0)],
    "term_loan": [(0.1, 1.0), (0.05, 0.1), (1.0, 1.5)],
    "educational": [(0.0, 1.0), (1.0, 2.0)],
    "other": [(0.0, 1.0), (1.0, 2.0)],
}


@dataclass
class FactorResult:
    score: float = 0.0
    matched: bool = False
    partial: bool = False


@dataclass
class SchemeResult:
    scheme: dict
    factors: dict = field(default_factory=dict)
    eligibility_score: float = 0.0
    confidence: float = 0.0
    eligible: bool = False
    failed_factors: list = field(default_factory=list)
    notes: list = field(default_factory=list)


def score_income(scheme: dict, income: int) -> FactorResult:
    lo = scheme.get("minimum_income") or 0
    hi = scheme.get("maximum_income")
    if income < lo:
        return FactorResult(score=0, matched=False)
    if hi is not None:
        if income <= hi:
            return FactorResult(score=100, matched=True)
        if income <= hi * 1.15:  # slight tolerance, flagged as near-miss
            return FactorResult(score=55, matched=False, partial=True)
        return FactorResult(score=0, matched=False)
    return FactorResult(score=100, matched=True)


def score_purpose(scheme: dict, purpose: str, education_type: str | None) -> FactorResult:
    purposes = scheme.get("eligible_purposes") or []
    if purpose == "education":
        types = scheme.get("eligible_education_types") or []
        if scheme.get("category") != "educational" or "education" not in purposes:
            return FactorResult(score=0, matched=False)
        if not education_type:
            return FactorResult(score=75, matched=True, partial=True)
        if education_type in types:
            return FactorResult(score=100, matched=True)
        return FactorResult(score=0, matched=False)
    if purpose in purposes:
        return FactorResult(score=100, matched=True)
    return FactorResult(score=0, matched=False)


def estimate_loan_need(required_loan, own_contribution, project_cost, max_loan: int) -> int:
    if required_loan is not None:
        return max(0, required_loan)
    if own_contribution is not None and project_cost > 0:
        return max(0, project_cost - own_contribution)
    if project_cost > 0:
        return min(project_cost, max_loan)
    return 0


def score_loan_amount(scheme: dict, need: int) -> FactorResult:
    max_loan = scheme.get("maximum_loan") or 0
    min_loan = scheme.get("minimum_loan") or 0
    if need <= 0:
        return FactorResult(score=70, matched=True, partial=True)
    if need <= max_loan:
        if need >= min_loan:
            return FactorResult(score=100, matched=True)
        return FactorResult(score=65, matched=True, partial=True)
    if need <= max_loan * 1.2:
        return FactorResult(score=55, matched=False, partial=True)
    return FactorResult(score=0, matched=False)


def score_project_cost(scheme: dict, project_cost: int) -> FactorResult:
    max_loan = scheme.get("maximum_loan") or 1
    if project_cost <= 0:
        return FactorResult(score=60, matched=True, partial=True)
    ratio = project_cost / max_loan
    windows = PROJECT_WINDOWS.get(scheme.get("category", "other"), PROJECT_WINDOWS["other"])
    full_lo, full_hi = windows[0]
    if full_lo <= ratio <= full_hi:
        return FactorResult(score=100, matched=True)
    for lo, hi in windows[1:]:
        if lo <= ratio <= hi:
            return FactorResult(score=60, matched=True, partial=True)
    return FactorResult(score=35, matched=False, partial=True)


def score_education(scheme: dict, purpose: str, education_type: str | None) -> FactorResult:
    if purpose != "education":
        # Education-specific compatibility is not applicable -> neutral full score
        return FactorResult(score=100, matched=True)
    types = scheme.get("eligible_education_types") or []
    if scheme.get("category") != "educational":
        return FactorResult(score=0, matched=False)
    if not education_type:
        return FactorResult(score=75, matched=True, partial=True)
    if education_type in types:
        return FactorResult(score=100, matched=True)
    return FactorResult(score=0, matched=False)


def score_location(partner_count: int, has_location: bool) -> FactorResult:
    if not has_location:
        return FactorResult(score=70, matched=True, partial=True)
    if partner_count > 0:
        return FactorResult(score=100, matched=True)
    return FactorResult(score=0, matched=False)


def evaluate_scheme(scheme: dict, profile: dict, partner_count: int) -> SchemeResult:
    """Evaluate one scheme against a user profile. Returns factor scores and eligibility."""
    income = profile.get("income", 0)
    purpose = profile.get("purpose", "other")
    project_cost = profile.get("project_cost", 0)
    education_type = profile.get("education_type")
    required_loan = profile.get("required_loan")
    own_contribution = profile.get("own_contribution")
    has_location = bool(profile.get("state"))

    need = estimate_loan_need(required_loan, own_contribution, project_cost, scheme.get("maximum_loan") or 0)

    factors = {
        "income": score_income(scheme, income),
        "purpose": score_purpose(scheme, purpose, education_type),
        "loan_amount": score_loan_amount(scheme, need),
        "project_cost": score_project_cost(scheme, project_cost),
        "education": score_education(scheme, purpose, education_type),
        "location": score_location(partner_count, has_location),
    }

    weights = profile.get("weights", DEFAULT_WEIGHTS)
    total_weight = sum(weights.get(k, 0) for k in factors)
    if total_weight <= 0:
        total_weight = sum(DEFAULT_WEIGHTS.values())

    weighted = sum(factors[k].score * weights.get(k, 0) for k in factors) / total_weight

    hard_fail = any(
        not f.matched and not f.partial for k, f in factors.items()
        if k in ("income", "purpose", "loan_amount", "education", "location")
    )
    # project_cost is a soft factor: an odd-sized project never hard-excludes a scheme,
    # but a zero project cost with no loan need should not be recommended.
    eligible = not hard_fail
    if eligible and project_cost <= 0 and income <= 0 and purpose not in ("education",):
        eligible = False  # nothing meaningful to match on

    partial_count = sum(1 for f in factors.values() if f.partial)
    confidence = weighted * (1 - 0.12 * partial_count / max(len(factors), 1))
    confidence = max(0.0, min(100.0, confidence))

    failed_factors = [
        {"factor": k, "label": k.replace("_", " ").title()}
        for k, f in factors.items() if not f.matched and not f.partial
    ]
    notes = []
    if factors["loan_amount"].partial and need > (scheme.get("maximum_loan") or 0):
        notes.append("Consider reducing the loan amount to fit within the scheme's maximum.")
    if factors["income"].partial:
        notes.append("Your income is close to the scheme's limit — please verify with the Channel Partner.")

    result = SchemeResult(
        scheme=scheme,
        factors={k: {"score": f.score, "matched": f.matched, "partial": f.partial} for k, f in factors.items()},
        eligibility_score=round(weighted, 1),
        confidence=round(confidence, 1),
        eligible=eligible,
        failed_factors=failed_factors,
        notes=notes,
    )
    result.need = need  # type: ignore[attr-defined]
    return result