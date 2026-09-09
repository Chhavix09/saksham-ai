from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Many-to-many: partners support many schemes; schemes are supported by many partners
partner_schemes = Table(
    "partner_schemes",
    Base.metadata,
    Column("partner_id", ForeignKey("partners.id", ondelete="CASCADE"), primary_key=True),
    Column("scheme_id", ForeignKey("schemes.id", ondelete="CASCADE"), primary_key=True),
)


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scheme_name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True)  # micro_finance | term_loan | educational | other
    description: Mapped[str] = mapped_column(String(1000), default="")

    minimum_income: Mapped[int | None] = mapped_column(Integer, nullable=True)
    maximum_income: Mapped[int | None] = mapped_column(Integer, nullable=True)
    minimum_loan: Mapped[int] = mapped_column(Integer, default=0)
    maximum_loan: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Float, default=0.0)  # annual %
    margin_percentage: Mapped[float] = mapped_column(Float, default=0.0)  # applicant contribution % of project cost
    moratorium_months: Mapped[int] = mapped_column(Integer, default=0)
    maximum_tenure_months: Mapped[int] = mapped_column(Integer, default=60)

    eligible_purposes: Mapped[list] = mapped_column(JSON, default=list)
    eligible_education_types: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_rules: Mapped[dict] = mapped_column(JSON, default=dict)  # extra structured rules
    required_documents: Mapped[list] = mapped_column(JSON, default=list)

    fund_utilization: Mapped[float | None] = mapped_column(Float, nullable=True)  # overall fund utilization % (informational)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)  # demo data marker
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    partners: Mapped[list["Partner"]] = relationship(
        "Partner", secondary=partner_schemes, back_populates="supported_schemes"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Scheme {self.id} {self.scheme_name}>"


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    partner_type: Mapped[str] = mapped_column(String(30), index=True)  # SCA | PSB | RRB | NBFC-MFI
    address: Mapped[str] = mapped_column(String(500), default="")
    state: Mapped[str] = mapped_column(String(60), index=True)
    district: Mapped[str] = mapped_column(String(60), index=True)
    city: Mapped[str] = mapped_column(String(80), default="")
    pincode: Mapped[str] = mapped_column(String(10), default="")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    contact_person: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(160), default="")

    # Routing health indicators
    fund_utilization_percent: Mapped[float] = mapped_column(Float, default=0.0)
    processing_status: Mapped[str] = mapped_column(String(20), default="available")  # available | limited | paused
    npa_indicator: Mapped[str] = mapped_column(String(20), default="none")  # none | watch | high

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    supported_schemes: Mapped[list["Scheme"]] = relationship(
        "Scheme", secondary=partner_schemes, back_populates="partners"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Partner {self.id} {self.name}>"