from pydantic import BaseModel, Field


class ApplicationIn(BaseModel):
    scheme_id: int
    partner_id: int | None = None
    applicant_info: dict = {}
    financial_info: dict = {}
    documents: list[dict] = []


class ApplicationStatusIn(BaseModel):
    status: str


class ApplicationOut(BaseModel):
    id: int
    user_id: int
    scheme_id: int
    partner_id: int | None
    status: str
    applicant_info: dict
    financial_info: dict
    documents: list[dict]
    review_notes: str
    scheme_name: str | None = None
    partner_name: str | None = None
    created_at: str
    updated_at: str