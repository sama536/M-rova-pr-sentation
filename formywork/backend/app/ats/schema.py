"""Structure d'un CV (une colonne, sections standard reconnues par les logiciels ATS)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Contact(BaseModel):
    full_name: str = ""
    headline: str = ""  # intitulé visé, ex. « Assistante RH »
    email: str = ""
    phone: str = ""
    city: str = ""
    links: list[str] = Field(default_factory=list)


class Experience(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    start: str = ""  # format conseillé : MM/AAAA
    end: str = ""
    current: bool = False
    bullets: list[str] = Field(default_factory=list)


class Education(BaseModel):
    degree: str = ""
    school: str = ""
    location: str = ""
    start: str = ""
    end: str = ""
    details: str = ""


class Language(BaseModel):
    name: str = ""
    level: str = ""


class ResumeData(BaseModel):
    contact: Contact = Field(default_factory=Contact)
    summary: str = ""
    experiences: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    # Informations issues de l'import (mise en forme d'origine), non modifiables par l'utilisateur
    import_flags: dict = Field(default_factory=dict)


def resume_to_text(data: ResumeData) -> str:
    c = data.contact
    parts = [c.full_name, c.headline, c.email, c.phone, c.city, *c.links, data.summary]
    for e in data.experiences:
        parts += [e.title, e.company, e.location, e.start, e.end, *e.bullets]
    for ed in data.education:
        parts += [ed.degree, ed.school, ed.location, ed.details]
    parts += data.skills + [f"{lang.name} {lang.level}" for lang in data.languages]
    parts += data.certifications + data.interests
    return "\n".join(p for p in parts if p)
