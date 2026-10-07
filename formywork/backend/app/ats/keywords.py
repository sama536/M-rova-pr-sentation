"""Extraction de mots-clés (compétences, outils, savoir-être) sans IA."""

from __future__ import annotations

import re
from collections import Counter

from ..sources.base import simplify

# Vocabulaire de compétences fréquentes dans les offres françaises (forme affichée).
SKILLS = [
    # Outils et bureautique
    "Excel",
    "Word",
    "PowerPoint",
    "Pack Office",
    "Microsoft 365",
    "Outlook",
    "Google Workspace",
    "Canva",
    "SAP",
    "Sage",
    "Cegid",
    "ACD",
    "ERP",
    "CRM",
    "Salesforce",
    "Photoshop",
    "Illustrator",
    "Figma",
    "WordPress",
    # Informatique
    "JavaScript",
    "TypeScript",
    "React",
    "Vue.js",
    "Angular",
    "Node.js",
    "PHP",
    "Symfony",
    "Laravel",
    "Python",
    "Java",
    "SQL",
    "Git",
    "Docker",
    "Linux",
    "Windows",
    "HTML",
    "CSS",
    "API",
    "Support",
    "Réseau",
    "Cybersécurité",
    # Métiers
    "Comptabilité",
    "Paie",
    "Fiscalité",
    "Révision",
    "Trésorerie",
    "Contrôle de gestion",
    "Facturation",
    "Devis",
    "Recrutement",
    "Ressources humaines",
    "Formation",
    "Pédagogie",
    "Gestion de projet",
    "Recette",
    "Planification",
    "Logistique",
    "Préparation de commandes",
    "CACES",
    "Vente",
    "Conseil client",
    "Relation client",
    "Négociation",
    "Prospection",
    "Marketing",
    "Communication",
    "Réseaux sociaux",
    "Rédaction",
    "Accueil",
    "Secrétariat",
    "Standard téléphonique",
    "Gestion administrative",
    "Archivage",
    "Achats",
    "Qualité",
    "Hygiène",
    "Sécurité",
    "Management",
    "Encadrement",
    "Budget",
    "Reporting",
    "Analyse de données",
    "Service public",
    "Santé",
    # Savoir-être
    "Rigueur",
    "Autonomie",
    "Organisation",
    "Polyvalence",
    "Esprit d'équipe",
    "Écoute",
    "Discrétion",
    "Adaptabilité",
    "Ponctualité",
    "Sens du service",
    "Pédagogie",
    "Patience",
    "Créativité",
    "Leadership",
]

_SKILL_INDEX = {simplify(s): s for s in SKILLS}
_STOP = set(
    simplify(
        "le la les un une des de du et ou en au aux pour par sur dans avec vous nous votre vos notre nos est sont "
        "etre avoir plus tres bien ce cette ces qui que quoi dont ses son sa leur leurs mission missions profil poste "
        "entreprise h f cdi cdd alternance experience annee annees ans jours jour semaine selon"
    ).split()
)


def find_skills(text: str) -> list[str]:
    """Compétences du vocabulaire présentes dans le texte, par ordre d'importance (fréquence)."""
    blob = f" {simplify(text)} "
    counts: Counter[str] = Counter()
    for key, label in _SKILL_INDEX.items():
        n = len(re.findall(rf"(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])", blob))
        if n:
            counts[label] += n
    return [label for label, _ in counts.most_common()]


def extract_keywords(text: str, limit: int = 12) -> list[str]:
    skills = find_skills(text)
    if len(skills) >= limit:
        return skills[:limit]
    # Complète avec les mots significatifs les plus fréquents.
    words = [w for w in simplify(text).split() if len(w) > 4 and w not in _STOP and not w.isdigit()]
    common = [w.capitalize() for w, _ in Counter(words).most_common(limit * 2)]
    have = {simplify(s) for s in skills}
    for word in common:
        if simplify(word) not in have and not any(simplify(word) in h for h in have):
            skills.append(word)
            have.add(simplify(word))
        if len(skills) >= limit:
            break
    return skills
