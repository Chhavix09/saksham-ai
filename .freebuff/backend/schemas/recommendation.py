from pydantic import BaseModel, Field

from schemas.common import LocationIn, ORMModel

PURPOSE_CHOICES = (
    "start_business",
    "expand_business",
    "agriculture",
    "small_enterprise",
    "vehicle_equipment",
    "education",
    "other",
)

EDUCATION_TYPE_CHOICES = (
    "undergraduate",
    "postgraduate",
    "professional",
    "vocational",
    "engineering",
    "medical",
    "other",
)


class RecommendationIn(BaseModel):
    income: int = Field(default=0, ge=0)
    project_cost: int = Field(default=0, ge=0)
    purpose: str = "business"
    activity: str | None = None
    required_loan: int | None = Field(default=None, ge=0)
    own_contribution: int | None = Field(default=None, ge=0)
    education_status: str | None = None
    education_type: str | None = None
    course: str | None = None
    age: int | None = Field(default=None, ge=15, le=100)
    location: LocationIn | None = None
    category: str | None = None
    occupation: str | None = None


class ExplanationItem(BaseModel):
    factor: str
    label: str
    text: str
    matched: bool
    partial: bool = False
    score: float


class MatchBreakdown(BaseModel):
    income: float = 0
    purpose: float = 0
    loan_amount: float = 0
    project_cost: float = 0
    education: float = 0
    location: float = 0


class RecommendationOut(BaseModel):
    id: int
    recommended_scheme: dict | None = None
    alternative_schemes: list[dict] = []
    eligibility_score: float
    confidence_score: float
    match_breakdown: dict
    explanation: list[dict]
    next_steps: list[str]
    created_at: str | None = None
    is_demo_note: bool = True


class SaveRecommendationIn(BaseModel):
    recommendation_id: int


class SavedSchemeIn(BaseModel):
    scheme_id: int