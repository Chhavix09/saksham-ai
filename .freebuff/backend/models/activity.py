from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Snapshot of everything the engine received (also powers analytics, e.g. searched districts)
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    recommended_scheme_id: Mapped[int | None] = mapped_column(ForeignKey("schemes.id"), nullable=True)
    alternative_scheme_ids: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    match_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[list] = mapped_column(JSON, default=list)
    next_steps: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])


class SavedScheme(Base):
    __tablename__ = "saved_schemes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scheme_id: Mapped[int] = mapped_column(ForeignKey("schemes.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scheme_id: Mapped[int] = mapped_column(ForeignKey("schemes.id"), index=True)
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True)

    status: Mapped[str] = mapped_column(
        String(30),
        default="not_started",
        index=True,
    )  # not_started | recommendation_generated | documents_pending | submitted | under_review | approved | disbursed | rejected

    applicant_info: Mapped[dict] = mapped_column(JSON, default=dict)
    financial_info: Mapped[dict] = mapped_column(JSON, default=dict)
    documents: Mapped[list] = mapped_column(JSON, default=list)  # [{name, label, provided}]
    review_notes: Mapped[str] = mapped_column(String(1000), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    scheme = relationship("Scheme")
    partner = relationship("Partner")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Application {self.id} {self.status}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(60), default="")
    entity_id: Mapped[str] = mapped_column(String(40), default="")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AppConfig(Base):
    """Key-value app configuration (recommendation weights, impact stats, disclaimers...)."""

    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatLog(Base):
    """AI assistant usage metadata.

    Privacy by design: message CONTENT is never stored — only anonymized
    usage telemetry (provider, topic, latency, success, sizes) so admins can
    monitor AI health and volume without recording what users asked.
    """

    __tablename__ = "chat_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(20), default="fallback")
    topic: Mapped[str] = mapped_column(String(30), default="general", index=True)
    used_llm: Mapped[bool] = mapped_column(Boolean, default=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    message_chars: Mapped[int] = mapped_column(Integer, default=0)
    reply_chars: Mapped[int] = mapped_column(Integer, default=0)
    context_keys: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)