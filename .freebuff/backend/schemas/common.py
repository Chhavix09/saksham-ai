from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LocationIn(BaseModel):
    state: str
    district: str | None = None
    city: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class Message(BaseModel):
    message: str


class Timestamped(ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime | None = None