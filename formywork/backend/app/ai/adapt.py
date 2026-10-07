"""Adaptation d'un CV à une offre et lettre de motivation.

Règle absolue : ne jamais inventer d'expérience, de diplôme, de compétence ou de chiffre.
Elle est garantie de deux façons :
1. l'IA ne peut modifier que l'accroche, l'intitulé, la formulation des missions existantes et l'ordre des
   compétences (les entreprises, postes, dates et diplômes sont recopiés tels quels) ;
2. un contrôle automatique après coup annule toute ligne contenant un chiffre absent du CV d'origine et
   retire toute compétence absente du CV d'origine, en le signalant dans les « points à vérifier ».
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..ats.keywords import extract_keywords
from ..ats.schema import ResumeData, resume_to_text
from ..config import get_settings
from ..models import Offer
from ..sources.base import simplify
from .client import ask_structured

PROFILE_LABELS = {
    "alternant": "alternant(e) ou étudiant(e)",
    "debutant": "débutant(e) ou en reconversion",
    "confirme": "professionnel(le) confirmé(e)",
    "senior": "senior de 50 ans et plus",
}

SYSTEM = """Tu es un conseiller emploi bienveillant et rigoureux. Tu adaptes des CV français à une offre.
RÈGLES ABSOLUES :
- N'invente JAMAIS d'expérience, de diplôme, de compétence, d'outil, de chiffre, de date ou de résultat.
- Tu peux seulement reformuler ce qui existe déjà, réordonner, et mettre en avant ce qui correspond à l'offre.
- Si l'offre demande quelque chose que le CV ne montre pas, ne l'ajoute pas : signale-le dans points_a_verifier.
- Français simple, phrases courtes, verbes d'action. Pas d'emoji, pas de mise en forme spéciale."""


class AdaptedExperience(BaseModel):
    index: int = Field(description="Position de l'expérience dans la liste d'origine (0 = première).")
    bullets: list[str] = Field(description="Missions reformulées, issues uniquement des missions d'origine.")


class AdaptedResume(BaseModel):
    headline: str
    summary: str = Field(description="Accroche de 2 à 4 phrases, sans rien inventer.")
    experiences: list[AdaptedExperience]
    skills: list[str] = Field(description="Compétences du CV d'origine, réordonnées selon l'offre.")
    changes: list[str] = Field(description="Liste courte des modifications faites.")
    points_a_verifier: list[str] = Field(
        description="Ce que la personne doit vérifier ou pourrait ajouter si c'est vrai."
    )


class LetterSchema(BaseModel):
    letter: str = Field(
        description="Lettre de motivation courte (150 à 230 mots), paragraphes séparés par une ligne vide."
    )
    email_message: str = Field(description="Message d'accompagnement de 3 à 5 phrases pour l'e-mail.")


_NUM = re.compile(r"\d+(?:[.,]\d+)?")


def _numbers(text: str) -> set[str]:
    return {n.replace(",", ".") for n in _NUM.findall(text)}


def guard(base: ResumeData, adapted: ResumeData) -> list[str]:
    """Contrôle anti-invention. Corrige `adapted` en place et renvoie les alertes."""
    alerts: list[str] = []
    original_text = resume_to_text(base)
    original_numbers = _numbers(original_text)
    original_blob = simplify(original_text)

    for i, exp in enumerate(adapted.experiences):
        src = base.experiences[i]
        # Les faits restent identiques à l'original
        exp.title, exp.company, exp.location = src.title, src.company, src.location
        exp.start, exp.end, exp.current = src.start, src.end, src.current
        safe: list[str] = []
        for bullet in exp.bullets:
            extra = _numbers(bullet) - original_numbers
            if extra:
                alerts.append(
                    f"Une ligne de « {src.title or 'expérience'} » contenait un chiffre absent de votre CV "
                    f"({', '.join(sorted(extra))}) : elle a été retirée."
                )
                continue
            safe.append(bullet)
        exp.bullets = safe or list(src.bullets)
    adapted.education = [e.model_copy() for e in base.education]
    adapted.certifications = list(base.certifications)
    adapted.languages = [lg.model_copy() for lg in base.languages]

    kept: list[str] = []
    for skill in adapted.skills:
        if simplify(skill) in original_blob:
            kept.append(skill)
        else:
            alerts.append(f"La compétence « {skill} » n'apparaît pas dans votre CV d'origine : elle a été retirée.")
    for skill in base.skills:  # aucune compétence d'origine n'est perdue
        if skill not in kept:
            kept.append(skill)
    adapted.skills = kept

    extra = _numbers(adapted.summary) - original_numbers
    if extra:
        alerts.append("L'accroche contenait un chiffre absent de votre CV : l'accroche d'origine a été conservée.")
        adapted.summary = base.summary
    return alerts


def _offer_text(offer: Offer) -> str:
    return f"{offer.title}\n{offer.company or ''}\n{offer.description}"


def simple_adaptation(base: ResumeData, offer: Offer) -> tuple[ResumeData, list[str], list[str]]:
    """Repli sans IA : réorganise sans réécrire."""
    keywords = extract_keywords(_offer_text(offer), limit=12)
    kw_simple = [simplify(k) for k in keywords]

    def relevance(text: str) -> int:
        s = simplify(text)
        return sum(1 for k in kw_simple if k and k in s)

    adapted = base.model_copy(deep=True)
    adapted.skills = sorted(base.skills, key=lambda s: -relevance(s))
    for exp in adapted.experiences:
        exp.bullets = sorted(exp.bullets, key=lambda b: -relevance(b))
    changes = [
        "Compétences réordonnées : celles demandées dans l'offre passent en premier.",
        "Missions réordonnées dans chaque expérience selon leur lien avec l'offre.",
    ]
    if offer.title and not base.contact.headline:
        adapted.contact.headline = offer.title.split("(")[0].strip()
        changes.append("Intitulé du CV aligné sur le poste visé.")
    blob = simplify(resume_to_text(base))
    missing = [k for k in keywords if simplify(k) not in blob]
    points = [
        f"L'offre mentionne « {k} » : si vous l'avez vraiment pratiqué, ajoutez-le avec vos mots." for k in missing[:5]
    ]
    points.append("Relisez l'accroche : elle peut citer le poste visé en une phrase.")
    return adapted, changes, points


async def adapt_resume(base: ResumeData, offer: Offer, profile_type: str) -> dict:
    settings = get_settings()
    result = None
    if settings.ai_enabled:
        exps = "\n".join(
            f"[{i}] {e.title} – {e.company} ({e.start} → {e.end or 'en cours'})\n"
            + "\n".join(f"  - {b}" for b in e.bullets)
            for i, e in enumerate(base.experiences)
        )
        prompt = f"""Profil de la personne : {PROFILE_LABELS.get(profile_type, profile_type)}.

OFFRE :
{_offer_text(offer)[:6000]}

CV D'ORIGINE
Intitulé : {base.contact.headline}
Accroche : {base.summary}
Expériences :
{exps}
Formation : {"; ".join(f"{e.degree} – {e.school} ({e.end})" for e in base.education)}
Compétences : {", ".join(base.skills)}

Adapte ce CV à l'offre en respectant strictement les règles. Garde une entrée par expérience (même index)."""
        result = await ask_structured(
            model=settings.ai_model_cv, system=SYSTEM, prompt=prompt, schema=AdaptedResume, max_tokens=6000
        )

    if result is None:
        adapted, changes, points = simple_adaptation(base, offer)
        by = "simple"
    else:
        adapted = base.model_copy(deep=True)
        adapted.contact.headline = result.headline.strip() or base.contact.headline
        adapted.summary = result.summary.strip() or base.summary
        for item in result.experiences:
            if 0 <= item.index < len(adapted.experiences) and item.bullets:
                adapted.experiences[item.index].bullets = [b.strip() for b in item.bullets if b.strip()]
        adapted.skills = [s.strip() for s in result.skills if s.strip()]
        changes, points, by = result.changes, result.points_a_verifier, settings.ai_model_cv

    alerts = guard(base, adapted)
    return {"data": adapted, "changes": changes, "points": alerts + points, "generated_by": by}


def template_letter(base: ResumeData, offer: Offer, profile_type: str) -> tuple[str, str]:
    """Lettre simple à partir des faits réels du CV (aucune invention)."""
    name = base.contact.full_name or "[Votre nom]"
    company = offer.company or "votre entreprise"
    skills = ", ".join(base.skills[:3]) if base.skills else "[vos points forts]"
    last = base.experiences[0] if base.experiences else None
    if profile_type == "alternant":
        intro = (
            f"Actuellement en formation, je souhaite rejoindre {company} en alternance pour le poste de {offer.title}."
        )
    elif profile_type == "senior":
        intro = f"Fort(e) d'un parcours professionnel solide, je vous propose ma candidature au poste de {offer.title}."
    else:
        intro = f"Je vous propose ma candidature au poste de {offer.title} au sein de {company}."
    exp_line = (
        f"Mon expérience de {last.title} chez {last.company} m'a permis de développer des compétences en {skills}."
        if last and last.title and last.company
        else f"Je mettrai à votre service mes compétences en {skills}."
    )
    letter = (
        f"Madame, Monsieur,\n\n{intro}\n\n{exp_line} Ce poste correspond à ce que je sais faire et à ce que je "
        f"souhaite développer.\n\n[Ajoutez ici une phrase personnelle : pourquoi cette entreprise vous intéresse.]\n\n"
        f"Je serais heureux(se) d'échanger avec vous lors d'un entretien.\n\nJe vous prie d'agréer, Madame, Monsieur, "
        f"mes salutations distinguées.\n\n{name}"
    )
    message = (
        f"Bonjour,\n\nVeuillez trouver ci-joint ma candidature (CV et lettre de motivation) pour le poste de "
        f"{offer.title}.\n\nJe reste à votre disposition pour tout complément.\n\nBien cordialement,\n{name}"
    )
    return letter, message


async def write_letter(base: ResumeData, offer: Offer, profile_type: str) -> dict:
    settings = get_settings()
    result = None
    if settings.ai_enabled:
        prompt = f"""Profil : {PROFILE_LABELS.get(profile_type, profile_type)}.
OFFRE :
{_offer_text(offer)[:5000]}

CV :
{resume_to_text(base)[:6000]}

Écris une lettre de motivation courte et un message d'accompagnement pour l'e-mail.
N'utilise que des faits présents dans le CV. Signe avec le nom : {base.contact.full_name or "[Votre nom]"}.
Si une information utile manque, écris [à compléter] plutôt que d'inventer."""
        result = await ask_structured(
            model=settings.ai_model_cv, system=SYSTEM, prompt=prompt, schema=LetterSchema, max_tokens=2000
        )
    if result is None:
        letter, message = template_letter(base, offer, profile_type)
        return {"letter": letter, "email_message": message, "generated_by": "simple"}
    return {"letter": result.letter, "email_message": result.email_message, "generated_by": settings.ai_model_cv}


def standard_answers(base: ResumeData, offer: Offer, profile_type: str) -> list[dict]:
    """Réponses types à copier dans les formulaires des sites (à relire et compléter)."""
    skills = ", ".join(base.skills[:4]) or "[vos compétences]"
    return [
        {
            "question": "Pourquoi ce poste vous intéresse-t-il ?",
            "answer": f"Le poste de {offer.title} correspond à mes compétences en {skills}. "
            f"[Ajoutez une raison personnelle liée à {offer.company or 'l’entreprise'}.]",
        },
        {
            "question": "Quelle est votre disponibilité ?",
            "answer": "Je suis disponible à partir du [date]."
            + (
                " Mon rythme d'alternance est de [X jours entreprise / Y jours école]."
                if profile_type == "alternant"
                else ""
            ),
        },
        {
            "question": "Quelles sont vos prétentions salariales ?",
            "answer": (
                "Je suis la grille légale de rémunération des alternants."
                if profile_type == "alternant"
                else f"Je souhaite une rémunération en accord avec l'annonce{f' ({offer.salary})' if offer.salary else ''} "
                "et mon expérience. [Indiquez une fourchette si on vous la demande.]"
            ),
        },
        {
            "question": "Présentez-vous en quelques lignes",
            "answer": base.summary or "[Copiez ici l'accroche de votre CV.]",
        },
    ]
