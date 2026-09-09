"""Generates plain-language explanations for recommendation decisions.

The platform never shows "You are eligible" without explaining why.
"""

INR = "₹"


def fmt_inr(value: int | float) -> str:
    return f"{INR}{value:,.0f}"


def _income_explanation(scheme: dict, income: int, score: float, matched: bool, partial: bool) -> dict:
    if not matched and not partial:
        if scheme.get("maximum_income") and income > scheme["maximum_income"]:
            text = f"Your annual family income of {fmt_inr(income)} is above this scheme's income limit of {fmt_inr(scheme['maximum_income'])}."
        else:
            text = f"Your annual family income of {fmt_inr(income)} does not meet this scheme's income criteria."
    elif partial:
        text = f"Your annual family income of {fmt_inr(income)} is close to this scheme's income limit of {fmt_inr(scheme.get('maximum_income') or 0)}."
    else:
        text = f"Your annual family income of {fmt_inr(income)} falls within the scheme's configured eligibility range."
    return {"factor": "income", "label": "Income Match", "text": text, "matched": matched, "partial": partial, "score": round(score, 1)}


def _purpose_explanation(scheme: dict, purpose: str, score: float, matched: bool, partial: bool) -> dict:
    if matched:
        text = f"Your purpose ({purpose.replace('_', ' ').title()}) matches this scheme's eligible purposes."
    elif partial:
        text = "Your purpose partially matches this scheme's focus area."
    else:
        text = f"Your purpose ({purpose.replace('_', ' ').title()}) is not covered by this scheme."
    return {"factor": "purpose", "label": "Purpose Match", "text": text, "matched": matched, "partial": partial, "score": round(score, 1)}


def _loan_explanation(scheme: dict, need: int, score: float, matched: bool, partial: bool) -> dict:
    if not matched and not partial:
        text = (
            f"Your estimated financing need of {fmt_inr(need)} exceeds the configured maximum of "
            f"{fmt_inr(scheme['maximum_loan'])} for this scheme."
        )
    elif partial and need > scheme["maximum_loan"]:
        text = (
            f"Your estimated financing need of {fmt_inr(need)} is slightly above this scheme's maximum of "
            f"{fmt_inr(scheme['maximum_loan'])}."
        )
    elif partial:
        text = f"Your estimated financing need of {fmt_inr(need)} is below this scheme's typical minimum of {fmt_inr(scheme.get('minimum_loan') or 0)}."
    else:
        text = f"Your estimated financing need of {fmt_inr(need)} falls within the scheme's configured loan limit."
    return {"factor": "loan_amount", "label": "Loan Amount Match", "text": text, "matched": matched, "partial": partial, "score": round(score, 1)}


def _project_explanation(scheme: dict, project_cost: int, score: float, matched: bool, partial: bool) -> dict:
    if matched:
        text = f"Your estimated project cost of {fmt_inr(project_cost)} fits this scheme's typical project size."
    elif partial:
        text = f"Your project cost of {fmt_inr(project_cost)} is larger than the typical range for this scheme."
    else:
        text = f"Your project cost of {fmt_inr(project_cost)} is outside the suitable range for this scheme."
    return {"factor": "project_cost", "label": "Project Cost Match", "text": text, "matched": matched, "partial": partial, "score": round(score, 1)}


def _education_explanation(scheme: dict, purpose: str, education_type: str | None, score: float, matched: bool, partial: bool) -> dict:
    if purpose == "education":
        if matched:
            text = f"Your education type ({education_type or 'course'} ) is eligible for education financing under this scheme."
        elif partial:
            text = "Please confirm your course type to verify education eligibility."
        else:
            text = "Your education type is not covered by this scheme's education categories."
    else:
        text = "This scheme does not require education-specific eligibility."
        matched, partial = True, False
    return {"factor": "education", "label": "Education Compatibility", "text": text, "matched": matched, "partial": partial, "score": round(score, 1)}


def _location_explanation(scheme: dict, state: str | None, partner_count: int, score: float, matched: bool) -> dict:
    if not state:
        text = "Share your location to check Channel Partner availability near you."
        matched = True  # neutral, not a failure
    elif partner_count > 0:
        text = f"Channel Partners supporting this scheme are available in {state}."
    else:
        text = f"No active Channel Partner supporting this scheme was found in {state} yet."
    return {"factor": "location", "label": "Location Match", "text": text, "matched": matched, "partial": False, "score": round(score, 1)}


def build_explanation(
    scheme: dict,
    factors: dict,
    need: int,
    project_cost: int,
    income: int,
    purpose: str,
    education_type: str | None,
    state: str | None,
    partner_count: int,
) -> list[dict]:
    return [
        _income_explanation(scheme, income, factors["income"]["score"], factors["income"]["matched"], factors["income"]["partial"]),
        _purpose_explanation(scheme, purpose, factors["purpose"]["score"], factors["purpose"]["matched"], factors["purpose"]["partial"]),
        _loan_explanation(scheme, need, factors["loan_amount"]["score"], factors["loan_amount"]["matched"], factors["loan_amount"]["partial"]),
        _project_explanation(scheme, project_cost, factors["project_cost"]["score"], factors["project_cost"]["matched"], factors["project_cost"]["partial"]),
        _education_explanation(scheme, purpose, education_type, factors["education"]["score"], factors["education"]["matched"], factors["education"]["partial"]),
        _location_explanation(scheme, state, partner_count, factors["location"]["score"], factors["location"]["matched"]),
    ]


def build_next_steps(recommended_scheme: dict | None, has_partners: bool = True) -> list[str]:
    if recommended_scheme is None:
        return [
            "Review the alternative schemes below and check which requirements you can meet.",
            "Use the EMI calculator to plan your project finances.",
            "You can still contact a Channel Partner for guidance on your case.",
        ]
    steps = [
        "Review your recommended scheme and its required documents.",
        "Calculate your EMI estimate to plan your repayment.",
        "Find a Channel Partner near you who can process your application.",
        "Start your application with the recommended Channel Partner.",
    ]
    if not has_partners:
        steps = [
            "Your recommended scheme has no active Channel Partner in your area yet.",
            "Contact the nearest State Channelizing Agency for guidance.",
        ]
    return steps