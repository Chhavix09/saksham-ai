from pydantic import BaseModel, Field


class EMICalculationIn(BaseModel):
    project_cost: int = Field(default=0, ge=0)
    loan_amount: int = Field(gt=0)
    interest_rate: float = Field(ge=0, le=30)
    tenure_months: int = Field(ge=1, le=360)
    moratorium_months: int = Field(default=0, ge=0, le=120)
    own_contribution: int = Field(default=0, ge=0)


class SchemeCalculationIn(BaseModel):
    scheme_id: int
    project_cost: int = Field(gt=0)
    own_contribution: int | None = Field(default=None, ge=0)
    tenure_months: int | None = Field(default=None, ge=1, le=360)


class EMIBreakdown(BaseModel):
    project_cost: int
    own_contribution: int
    loan_amount: int
    interest_rate: float
    tenure_months: int
    moratorium_months: int
    emi: float
    total_interest: float
    total_repayment: float
    principal: float
    interest: float
    monthly_interest_rate: float
    interest_during_moratorium: float
    effective_principal: float
    disclaimer: str
    scheme_id: int | None = None
    scheme_name: str | None = None
    limit_message: str | None = None
    is_estimate: bool = True