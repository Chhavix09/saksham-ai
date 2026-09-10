"""Financial calculator service.

Uses the standard reducing-balance EMI formula. During the moratorium period,
simple interest accrues and is added to the principal before EMI begins.
All figures are estimates.
"""

import math

DISCLAIMER = (
    "Scheme Up provides informational scheme matching and financial estimates based on "
    "configured scheme rules. Final eligibility, sanction, interest terms and loan approval "
    "are determined by the authorized implementing agency or Channel Partner according to "
    "applicable guidelines."
)


def emi_breakdown(
    project_cost: int,
    loan_amount: int,
    interest_rate: float,
    tenure_months: int,
    moratorium_months: int = 0,
    own_contribution: int = 0,
    scheme_id: int | None = None,
    scheme_name: str | None = None,
    limit_message: str | None = None,
) -> dict:
    if loan_amount <= 0 or tenure_months <= 0:
        raise ValueError("Loan amount and tenure must be greater than zero.")

    monthly_rate = interest_rate / 100 / 12
    # Simple interest accrued during the moratorium period
    interest_during_moratorium = loan_amount * monthly_rate * moratorium_months
    effective_principal = loan_amount + interest_during_moratorium

    if monthly_rate == 0:
        emi = effective_principal / tenure_months
    else:
        factor = (1 + monthly_rate) ** tenure_months
        emi = effective_principal * monthly_rate * factor / (factor - 1)

    total_repayment = emi * tenure_months
    total_interest = total_repayment - loan_amount
    principal_share = loan_amount
    interest_share = total_interest

    return {
        "project_cost": project_cost,
        "own_contribution": own_contribution,
        "loan_amount": loan_amount,
        "interest_rate": interest_rate,
        "tenure_months": tenure_months,
        "moratorium_months": moratorium_months,
        "emi": round(emi, 2),
        "total_interest": round(total_interest, 2),
        "total_repayment": round(total_repayment, 2),
        "principal": round(principal_share, 2),
        "interest": round(interest_share, 2),
        "monthly_interest_rate": round(monthly_rate * 100, 4),
        "interest_during_moratorium": round(interest_during_moratorium, 2),
        "effective_principal": round(effective_principal, 2),
        "disclaimer": DISCLAIMER,
        "scheme_id": scheme_id,
        "scheme_name": scheme_name,
        "limit_message": limit_message,
        "is_estimate": True,
    }


def calculate_for_scheme(
    scheme: object,
    project_cost: int,
    own_contribution: int | None,
    tenure_months: int | None,
) -> dict:
    """Apply a scheme's configured rates to a project. Returns breakdown or a friendly limit message."""
    max_loan = scheme.maximum_loan
    margin_pct = scheme.margin_percentage

    suggested_contribution = round(project_cost * margin_pct / 100)
    contribution = own_contribution if own_contribution is not None else suggested_contribution
    if contribution > project_cost:
        contribution = project_cost

    loan_amount = project_cost - contribution
    limit_message = None

    if loan_amount > max_loan:
        # Recalculate at the scheme maximum so the user still sees an estimate,
        # but clearly surface the limit warning.
        loan_amount = max_loan
        contribution = project_cost - loan_amount
        if contribution < 0:
            contribution = 0
        limit_message = (
            "Your requested amount exceeds the configured maximum for this scheme. "
            "Consider reducing the loan amount or reviewing alternative schemes."
        )

    if loan_amount <= 0:
        loan_amount = min(project_cost, max_loan)
        contribution = project_cost - loan_amount
        if contribution < 0:
            contribution = 0

    if loan_amount < scheme.minimum_loan and project_cost > 0:
        limit_message = (
            f"The estimated loan amount is below this scheme's typical minimum of "
            f"₹{scheme.minimum_loan:,.0f}. You may still apply, or consider a scheme matching your needs better."
        )

    tenure = tenure_months or scheme.maximum_tenure_months or 60

    return emi_breakdown(
        project_cost=project_cost,
        loan_amount=loan_amount,
        interest_rate=scheme.interest_rate,
        tenure_months=tenure,
        moratorium_months=scheme.moratorium_months,
        own_contribution=contribution,
        scheme_id=scheme.id,
        scheme_name=scheme.scheme_name,
        limit_message=limit_message,
    )