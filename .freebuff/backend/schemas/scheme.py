from datetime import datetime

from pydantic import BaseModel, Field

from schemas.common import ORMModel


class SchemeIn(BaseModel):
    scheme_name: str = Field(min_length=2, max_length=160)
    category: str = "other"
    description: str = ""
    minimum_income: int | None = None
    maximum_income: int | None = None
    minimum_loan: int = 0
    maximum_loan: int = Field(gt=0)
    interest_rate: float = Field(ge=0, le=30)
    margin_percentage: float = Field(ge=0, le=100)
    moratorium_months: int = Field(ge=0, le=120)
    maximum_tenure_months: int = Field(ge=1, le=360)
    eligible_purposes: list[str] = []
    eligible_education_types: list[str] = []
    eligibility_rules: dict = {}
    required_documents: list[str] = []
    fund_utilization: float | None = None
    active: bool = True


class SchemeOut(ORMModel):
    id: int
    scheme_name: str
    category: str
    description: str
    minimum_income: int | None
    maximum_income: int | None
    minimum_loan: int
    maximum_loan: int
    interest_rate: float
    margin_percentage: float
    moratorium_months: int
    maximum_tenure_months: int
    eligible_purposes: list
    eligible_education_types: list
    eligibility_rules: dict
    required_documents: list
    fund_utilization: float | None
    is_demo: bool
    active: bool
    created_at: datetime
    updated_at: datetime