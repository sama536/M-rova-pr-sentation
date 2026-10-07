"""Schémas de l'API REST (validation des entrées et sorties)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .ats.schema import ResumeData

ProfileType = Literal["alternant", "debutant", "confirme", "senior"]
ContractType = Literal["", "cdi", "cdd", "alternance", "stage", "interim", "freelance"]
StatusType = Literal["a_postuler", "postule", "relance", "entretien", "refus", "offre"]


class RegisterIn(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str
    profile_type: str
    onboarded: bool
    preferences: dict


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=80)
    profile_type: ProfileType | None = None
    onboarded: bool | None = None
    preferences: dict | None = None

    @field_validator("preferences")
    @classmethod
    def small_prefs(cls, v):
        if v is not None and len(str(v)) > 4000:
            raise ValueError("Préférences trop volumineuses")
        return v


class SearchIn(BaseModel):
    query: str = Field("", max_length=120)
    location: str = Field("", max_length=120)
    radius_km: int = Field(20, ge=0, le=200)
    contract: ContractType = ""
    max_days: int = Field(0, ge=0, le=60)
    remote: Literal["", "partiel", "total"] = ""


class SavedSearchIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    params: SearchIn
    auto_refresh: bool = True


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    params: dict
    auto_refresh: bool
    last_run_at: datetime | None
    new_count: int = 0


class SourceReportOut(BaseModel):
    name: str
    label: str
    ok: bool
    count: int
    error: str | None
    skipped: bool = False


class OfferOut(BaseModel):
    id: int
    source: str
    source_label: str
    also_on: list[str]
    title: str
    company: str | None
    location: str | None
    contract_type: str
    is_alternance: bool
    remote: str
    salary: str | None
    url: str | None
    apply_email: str | None
    apply_url: str | None
    published_at: datetime | None
    first_seen_at: datetime
    expired: bool
    is_new: bool
    favorite: bool
    hidden: bool
    summary: list[str] | None = None
    keywords: list[str] | None = None
    summary_by: str | None = None
    application_status: str | None = None


class OfferDetail(OfferOut):
    description: str


class SearchOut(BaseModel):
    offers: list[OfferOut]
    sources: list[SourceReportOut]
    location_found: bool | None = None


class OfferStateIn(BaseModel):
    favorite: bool | None = None
    hidden: bool | None = None


class ResumeIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    data: ResumeData


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    data: ResumeData
    is_base: bool
    parent_id: int | None
    offer_id: int | None
    adaptation: dict | None
    created_at: datetime
    updated_at: datetime
    score: int | None = None
    offer_title: str | None = None


class AnalyzeIn(BaseModel):
    data: ResumeData
    offer_id: int | None = None


class AdaptIn(BaseModel):
    offer_id: int
    with_letter: bool = True


class ApplicationIn(BaseModel):
    offer_id: int | None = None
    title: str = Field("", max_length=300)
    company: str | None = Field(None, max_length=200)
    status: StatusType = "a_postuler"
    notes: str = Field("", max_length=10000)


class ApplicationUpdate(BaseModel):
    status: StatusType | None = None
    notes: str | None = Field(None, max_length=10000)
    follow_up_at: datetime | None = None
    interview_at: datetime | None = None
    position: int | None = None
    resume_id: int | None = None
    clear_follow_up: bool = False


class ApplicationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    message: str
    created_at: datetime


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    offer_id: int | None
    resume_id: int | None
    resume_name: str | None = None
    title: str
    company: str | None
    status: str
    notes: str
    cover_letter: str | None
    applied_at: datetime | None
    follow_up_at: datetime | None
    interview_at: datetime | None
    position: int
    created_at: datetime
    updated_at: datetime
    offer_url: str | None = None
    events: list[ApplicationEventOut] = []


class ApplyPrepareIn(BaseModel):
    offer_id: int
    resume_id: int | None = None


class ApplySendIn(BaseModel):
    offer_id: int
    resume_id: int
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=20000)
    letter: str = Field("", max_length=20000)
    attach_letter: bool = True
    confirm: bool = False
    fingerprint: str = Field(min_length=10, max_length=128)
    allow_duplicate: bool = False


class ApplyMarkIn(BaseModel):
    offer_id: int
    resume_id: int | None = None
    letter: str = Field("", max_length=20000)
    allow_duplicate: bool = False
