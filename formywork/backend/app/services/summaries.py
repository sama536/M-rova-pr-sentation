"""Résumé de chaque offre (3-4 lignes + 3 mots-clés), mis en cache en base par empreinte du contenu."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai.client import ask_structured
from ..ats.keywords import extract_keywords
from ..config import get_settings
from ..models import Offer, OfferSummary

SYSTEM = (
    "Tu résumes des offres d'emploi en français simple pour des personnes peu à l'aise avec le jargon, "
    "dont des seniors et des alternants. Tu n'inventes rien : si une information manque, dis « non précisé »."
)


class SummarySchema(BaseModel):
    mission: str = Field(description="Une phrase : ce que la personne fera.")
    profil: str = Field(description="Une phrase : le profil recherché.")
    conditions: str = Field(description="Une phrase : contrat, salaire, horaires, télétravail si indiqués.")
    attention: str = Field(
        description="Une phrase : point d'attention utile (contrainte, avantage, mode de candidature)."
    )
    keywords: list[str] = Field(description="Exactement 3 mots-clés courts (compétences ou outils).")


def store_demo_summary(db: Session, content_hash: str, lines: list[str], keywords: list[str]) -> None:
    if db.get(OfferSummary, content_hash) is None:
        db.add(
            OfferSummary(content_hash=content_hash, summary=lines, keywords=keywords[:3], generated_by="exemple-demo")
        )


def simple_summary(offer: Offer) -> tuple[list[str], list[str]]:
    """Repli sans IA : on extrait les phrases les plus parlantes de l'annonce."""
    text = offer.description or ""
    sentences = [s.strip(" •-\t") for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(s.strip()) > 25]

    def pick(*words: str) -> str | None:
        for s in sentences:
            low = s.lower()
            if any(w in low for w in words):
                return s if len(s) <= 180 else s[:177].rsplit(" ", 1)[0] + "…"
        return None

    lines: list[str] = []
    mission = pick("mission", "vous serez", "vous ferez", "vos tâches", "rôle", "chargé") or (
        sentences[0][:180] if sentences else None
    )
    if mission:
        lines.append(f"Mission : {mission}")
    profil = pick("profil", "expérience", "formation", "vous êtes", "diplôme", "maîtrise")
    if profil:
        lines.append(f"Profil : {profil}")
    cond = [p for p in (offer.contract_type.upper() if offer.contract_type != "autre" else None, offer.salary) if p]
    if offer.remote == "partiel":
        cond.append("télétravail partiel")
    elif offer.remote == "total":
        cond.append("100 % télétravail")
    if cond:
        lines.append("Conditions : " + ", ".join(cond) + ".")
    if offer.apply_email:
        lines.append("À noter : candidature par e-mail possible.")
    if not lines:
        lines = ["Résumé indisponible : ouvrez l'annonce complète."]
    return lines[:4], extract_keywords(f"{offer.title}\n{text}", limit=3)


async def get_summary(db: Session, offer: Offer, *, allow_ai: bool = True) -> OfferSummary:
    settings = get_settings()
    cached = db.get(OfferSummary, offer.content_hash) if offer.content_hash else None
    # Un résumé « simple » est remplacé dès que l'IA est disponible ; un résumé IA n'est jamais refait.
    if cached and (cached.generated_by != "simple" or not (allow_ai and settings.ai_enabled)):
        return cached

    result = None
    if allow_ai and settings.ai_enabled:
        prompt = (
            f"Titre : {offer.title}\nEntreprise : {offer.company or 'non précisé'}\n"
            f"Lieu : {offer.location or 'non précisé'}\nContrat : {offer.contract_type}\n"
            f"Salaire : {offer.salary or 'non précisé'}\n\nAnnonce :\n{offer.description[:8000]}"
        )
        result = await ask_structured(
            model=settings.ai_model_summary, system=SYSTEM, prompt=prompt, schema=SummarySchema, max_tokens=800
        )
    if result is not None:
        lines = [
            f"Mission : {result.mission}",
            f"Profil : {result.profil}",
            f"Conditions : {result.conditions}",
            f"À noter : {result.attention}",
        ]
        keywords, by = result.keywords[:3], settings.ai_model_summary
    else:
        lines, keywords = simple_summary(offer)
        by = "simple"

    if cached is None:
        cached = OfferSummary(content_hash=offer.content_hash, summary=lines, keywords=keywords, generated_by=by)
        db.add(cached)
    else:
        cached.summary, cached.keywords, cached.generated_by = lines, keywords, by
    db.commit()
    return cached
