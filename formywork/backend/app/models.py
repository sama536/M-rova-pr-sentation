"""Tables de la base SQLite."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    profile_type: Mapped[str] = mapped_column(String(30), default="debutant")
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_offer_source_ext"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(40), index=True)
    external_id: Mapped[str] = mapped_column(String(200))
    dedup_key: Mapped[str] = mapped_column(String(300), index=True)
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    contract_type: Mapped[str] = mapped_column(
        String(30), default="autre"
    )  # cdi, cdd, alternance, stage, interim, freelance, autre
    is_alternance: Mapped[bool] = mapped_column(Boolean, default=False)
    remote: Mapped[str] = mapped_column(String(20), default="inconnu")  # non, partiel, total, inconnu
    salary: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    apply_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    apply_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    also_on: Mapped[list[str]] = mapped_column(JSON, default=list)  # autres sources dédoublonnées
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expired: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    content_hash: Mapped[str] = mapped_column(String(64), default="")


class OfferSummary(Base):
    """Cache des résumés IA : clé = empreinte du contenu, pour ne jamais payer deux fois."""

    __tablename__ = "offer_summaries"

    content_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    summary: Mapped[list[str]] = mapped_column(JSON)
    keywords: Mapped[list[str]] = mapped_column(JSON)
    generated_by: Mapped[str] = mapped_column(String(60))  # nom du modèle ou "simple"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class UserOffer(Base):
    """État d'une offre pour une personne : favori, masquée, déjà ouverte."""

    __tablename__ = "user_offers"
    __table_args__ = (UniqueConstraint("user_id", "offer_id", name="uq_user_offer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"), index=True)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    params: Mapped[dict[str, Any]] = mapped_column(JSON)
    auto_refresh: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_scrape_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SearchResult(Base):
    """Offres trouvées par une recherche enregistrée."""

    __tablename__ = "search_results"
    __table_args__ = (UniqueConstraint("search_id", "offer_id", name="uq_search_offer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    search_id: Mapped[int] = mapped_column(ForeignKey("saved_searches.id", ondelete="CASCADE"), index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SourceStatus(Base):
    __tablename__ = "source_status"

    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_count: Mapped[int] = mapped_column(Integer, default=0)
    calls_today: Mapped[int] = mapped_column(Integer, default=0)
    calls_day: Mapped[str] = mapped_column(String(10), default="")
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class HttpCache(Base):
    """Petit cache HTTP pour le scraping (évite de recharger les mêmes pages)."""

    __tablename__ = "http_cache"

    url: Mapped[str] = mapped_column(String(1000), primary_key=True)
    body: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    data: Mapped[dict[str, Any]] = mapped_column(JSON)
    is_base: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("offers.id", ondelete="SET NULL"), nullable=True)
    adaptation: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)  # points à vérifier, scores, lettre…
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


APPLICATION_STATUSES = ["a_postuler", "postule", "relance", "entretien", "refus", "offre"]


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "offer_id", name="uq_application_offer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("offers.id", ondelete="SET NULL"), nullable=True)
    resume_id: Mapped[int | None] = mapped_column(ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="a_postuler", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    interview_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    events: Mapped[list[ApplicationEvent]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="ApplicationEvent.created_at"
    )


class ApplicationEvent(Base):
    """Historique : changement d'étape, e-mail envoyé, note…"""

    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))  # status, email_sent, email_simulated, site_opened, note
    message: Mapped[str] = mapped_column(Text)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    application: Mapped[Application] = relationship(back_populates="events")
