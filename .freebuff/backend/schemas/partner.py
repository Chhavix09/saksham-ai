from pydantic import BaseModel, Field

from schemas.common import ORMModel


class PartnerOut(ORMModel):
    id: int
    name: str
    partner_type: str
    address: str
    state: str
    district: str
    city: str
    pincode: str
    latitude: float
    longitude: float
    contact_person: str
    phone: str
    email: str
    fund_utilization_percent: float
    processing_status: str
    npa_indicator: str
    is_active: bool
    is_demo: bool
    supported_scheme_ids: list[int] = []


class PartnerNearbyIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(default=50, gt=0, le=500)
    scheme_id: int | None = None
    partner_type: str | None = None


class PartnerRecommendIn(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    scheme_id: int | None = None
    radius_km: float = Field(default=50, gt=0, le=500)
    state: str | None = None
    district: str | None = None


class PartnerIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    partner_type: str
    address: str = ""
    state: str
    district: str
    city: str = ""
    pincode: str = ""
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    fund_utilization_percent: float = Field(default=0, ge=0, le=100)
    processing_status: str = "available"
    npa_indicator: str = "none"
    is_active: bool = True
    supported_scheme_ids: list[int] = []