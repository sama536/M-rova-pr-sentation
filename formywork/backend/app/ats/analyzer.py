"""Diagnostic ATS : chaque point est expliqué, chiffré et accompagné d'une correction concrète.

Règle : les conseils ne proposent jamais d'inventer. Pour les chiffres, on demande d'en ajouter
« seulement s'ils sont vrais ».
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from ..sources.base import simplify
from .keywords import extract_keywords, find_skills
from .schema import ResumeData, resume_to_text

CATEGORIES = {
    "structure": ("Structure et coordonnées", 25),
    "contenu": ("Contenu", 25),
    "forme": ("Mise en forme", 20),
    "mots_cles": ("Mots-clés", 30),
}

ACTION_VERBS = set(
    simplify(
        "accueillir accompagner administrer analyser animer assurer conseiller concevoir contrôler coordonner "
        "créer développer diriger encadrer établir former gérer mettre organiser participer piloter planifier "
        "préparer réaliser recruter rédiger répondre superviser suivre traiter vendre optimiser négocier "
        "installer maintenir livrer conduire assister effectuer garantir mener négocier prospecter réduire "
        "améliorer lancer déployer tenir saisir classer informer orienter"
    ).split()
)
_DATE_RE = re.compile(r"^(0[1-9]|1[0-2])/(19|20)\d{2}$|^(19|20)\d{2}$")
_EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
_PHONE_RE = re.compile(r"^\+?[\d\s.()-]{9,20}$")
_NUMBER_RE = re.compile(r"\d")
_PERSONAL_RE = re.compile(
    r"(né|née)\s+le|\bâge\b|\bans\b\s*$|situation familiale|mari[ée]|célibataire|nationalit|numéro de sécurité",
    re.I,
)


def _starts_with_verb(line: str) -> bool:
    words = simplify(line).split()
    if not words:
        return False
    first = words[0]
    # Verbe d'action connu, infinitif (Gérer, Accueillir) ou participe passé (Géré, Accueilli).
    return (
        first in ACTION_VERBS
        or (len(first) > 3 and first.endswith(("er", "ir", "e", "i")) and first[:-1] + "er" in ACTION_VERBS)
        or first.endswith(("er", "ir"))
    )


@dataclass
class Check:
    id: str
    category: str
    status: str  # ok, warning, error, info
    title: str
    detail: str
    fix: str | None
    points: float
    max_points: float


@dataclass
class Report:
    score: int
    categories: list[dict]
    checks: list[Check]
    keywords_matched: list[str] = field(default_factory=list)
    keywords_missing: list[str] = field(default_factory=list)
    profile_tips: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        d = asdict(self)
        d["checks"] = [asdict(c) for c in self.checks]
        return d


class _Builder:
    def __init__(self) -> None:
        self.checks: list[Check] = []

    def add(self, id_, cat, ok, max_pts, title, detail_ok, detail_ko, fix, *, partial=None, severity="error"):
        if partial is not None:
            pts = max_pts * max(0.0, min(1.0, partial))
            status = "ok" if partial >= 0.999 else ("warning" if partial >= 0.5 else severity)
            self.checks.append(
                Check(
                    id_,
                    cat,
                    status,
                    title,
                    detail_ok if status == "ok" else detail_ko,
                    None if status == "ok" else fix,
                    round(pts, 1),
                    max_pts,
                )
            )
        else:
            self.checks.append(
                Check(
                    id_,
                    cat,
                    "ok" if ok else severity,
                    title,
                    detail_ok if ok else detail_ko,
                    None if ok else fix,
                    max_pts if ok else 0,
                    max_pts,
                )
            )


def analyze(data: ResumeData, offer_text: str | None = None, profile_type: str = "debutant") -> Report:
    b = _Builder()
    c = data.contact

    # ---- Structure
    b.add(
        "nom",
        "structure",
        bool(c.full_name.strip()),
        3,
        "Nom et prénom",
        "Votre nom est bien en haut du CV.",
        "Le nom n'est pas renseigné.",
        "Écrivez votre prénom et votre nom tout en haut, en texte simple.",
    )
    b.add(
        "email",
        "structure",
        bool(_EMAIL_RE.match(c.email.strip())),
        4,
        "Adresse e-mail",
        "Adresse e-mail valide.",
        "L'adresse e-mail est absente ou mal écrite.",
        "Ajoutez une adresse e-mail sérieuse, par exemple prenom.nom@gmail.com.",
    )
    b.add(
        "telephone",
        "structure",
        bool(_PHONE_RE.match(c.phone.strip())),
        3,
        "Téléphone",
        "Numéro de téléphone présent.",
        "Le numéro de téléphone manque.",
        "Ajoutez un numéro où l'on peut vous joindre, par exemple 06 12 34 56 78.",
    )
    b.add(
        "ville",
        "structure",
        bool(c.city.strip()),
        2,
        "Ville",
        "Ville indiquée (utile pour les recherches par lieu).",
        "La ville n'est pas indiquée.",
        "Indiquez seulement votre ville (pas besoin de l'adresse complète).",
        severity="warning",
    )
    b.add(
        "section_experience",
        "structure",
        bool(data.experiences),
        5,
        "Section Expérience",
        "La section Expérience professionnelle est présente.",
        "Aucune expérience n'est renseignée.",
        "Ajoutez vos expériences, y compris stages, missions, bénévolat ou emplois d'été.",
    )
    b.add(
        "section_formation",
        "structure",
        bool(data.education),
        4,
        "Section Formation",
        "La section Formation est présente.",
        "Aucune formation n'est renseignée.",
        "Ajoutez votre diplôme le plus élevé ou votre formation en cours.",
    )
    b.add(
        "section_competences",
        "structure",
        len(data.skills) >= 3,
        4,
        "Section Compétences",
        f"{len(data.skills)} compétences listées.",
        "Moins de 3 compétences listées.",
        "Listez 6 à 12 compétences que vous maîtrisez vraiment (outils, savoir-faire).",
        severity="warning" if data.skills else "error",
    )

    # ---- Contenu
    summary_len = len(data.summary.strip())
    b.add(
        "accroche",
        "contenu",
        150 <= summary_len <= 700,
        5,
        "Phrase d'accroche",
        "L'accroche a une bonne longueur.",
        "L'accroche est absente."
        if summary_len == 0
        else ("L'accroche est trop courte." if summary_len < 150 else "L'accroche est trop longue."),
        "Écrivez 2 à 4 phrases : qui vous êtes, ce que vous savez faire, le poste visé.",
        severity="warning" if summary_len else "error",
    )
    exps = data.experiences
    if exps:
        dated = sum(1 for e in exps if e.start and (e.end or e.current))
        b.add(
            "dates",
            "contenu",
            False,
            5,
            "Dates des expériences",
            "Toutes les expériences sont datées.",
            f"{len(exps) - dated} expérience(s) sans dates complètes.",
            "Indiquez un début et une fin (ou « en cours ») pour chaque expérience.",
            partial=dated / len(exps),
        )
        with_bullets = sum(1 for e in exps if len([x for x in e.bullets if x.strip()]) >= 2)
        b.add(
            "puces",
            "contenu",
            False,
            5,
            "Détail des missions",
            "Chaque expérience a au moins 2 missions.",
            f"{len(exps) - with_bullets} expérience(s) avec moins de 2 missions décrites.",
            "Ajoutez 2 à 5 lignes par expérience, en commençant par un verbe (Gérer, Accueillir…).",
            partial=with_bullets / len(exps),
        )
        bullets = [x for e in exps for x in e.bullets if x.strip()]
        if bullets:
            verbs = sum(1 for x in bullets if _starts_with_verb(x))
            b.add(
                "verbes",
                "contenu",
                False,
                4,
                "Verbes d'action",
                "Vos missions commencent par des verbes d'action.",
                "Plusieurs missions ne commencent pas par un verbe.",
                "Commencez chaque ligne par un verbe : « Accueillir », « Préparer », « Gérer »…",
                partial=verbs / len(bullets),
                severity="warning",
            )
            numbered = sum(1 for x in bullets if _NUMBER_RE.search(x))
            b.add(
                "chiffres",
                "contenu",
                False,
                3,
                "Résultats chiffrés",
                "Certaines missions sont illustrées par des chiffres.",
                "Aucune mission n'est chiffrée.",
                "Si vous avez des chiffres réels (nombre de clients, d'élèves, budget…), ajoutez-les. "
                "N'inventez jamais un chiffre.",
                partial=min(1.0, numbered / max(1, len(bullets) / 3)),
                severity="info",
            )
        else:
            b.add(
                "verbes",
                "contenu",
                False,
                4,
                "Verbes d'action",
                "",
                "Aucune mission décrite.",
                "Décrivez vos missions en commençant par un verbe.",
            )
            b.add(
                "chiffres",
                "contenu",
                False,
                3,
                "Résultats chiffrés",
                "",
                "Aucune mission décrite.",
                "Décrivez vos missions ; ajoutez des chiffres seulement s'ils sont vrais.",
                severity="info",
            )
    else:
        for id_, pts, title in (
            ("dates", 5, "Dates des expériences"),
            ("puces", 5, "Détail des missions"),
            ("verbes", 4, "Verbes d'action"),
            ("chiffres", 3, "Résultats chiffrés"),
        ):
            b.add(
                id_,
                "contenu",
                False,
                pts,
                title,
                "",
                "Pas encore d'expérience renseignée.",
                "Ajoutez une expérience pour pouvoir l'évaluer.",
                severity="warning",
            )
    words = len(resume_to_text(data).split())
    b.add(
        "longueur",
        "contenu",
        200 <= words <= 900,
        3,
        "Longueur du CV",
        f"Environ {words} mots : longueur adaptée.",
        f"Environ {words} mots : " + ("CV trop court." if words < 200 else "CV trop long (plus de 2 pages)."),
        "Visez 1 page (débutant) à 2 pages (expérimenté) : environ 250 à 800 mots.",
        severity="warning",
    )

    # ---- Mise en forme
    flags = data.import_flags or {}
    b.add(
        "texte_lisible",
        "forme",
        not flags.get("image_only"),
        6,
        "Texte lisible par un logiciel",
        "Le texte du CV est lisible par un ATS.",
        "Votre PDF semble être une image (scan) : un logiciel ATS ne peut pas le lire.",
        "Utilisez l'export PDF de FormyWork : il produit du vrai texte.",
    )
    b.add(
        "colonnes",
        "forme",
        not (flags.get("tables") or flags.get("columns")),
        5,
        "Une seule colonne, sans tableau",
        "Mise en page simple en une colonne (exports FormyWork).",
        "Le fichier d'origine contient des tableaux ou des colonnes, souvent mal lus par les ATS.",
        "Exportez le CV depuis FormyWork (modèle sobre une colonne).",
        severity="warning",
    )
    all_dates = [d for e in exps for d in (e.start, e.end) if d] + [
        d for ed in data.education for d in (ed.start, ed.end) if d
    ]
    good = sum(1 for d in all_dates if _DATE_RE.match(d.strip()))
    b.add(
        "format_dates",
        "forme",
        False,
        4,
        "Format des dates",
        "Dates au format MM/AAAA ou AAAA.",
        "Certaines dates ne suivent pas un format simple.",
        "Écrivez les dates ainsi : 09/2021 ou 2021.",
        partial=(good / len(all_dates)) if all_dates else 1.0,
        severity="warning",
    )
    personal = _PERSONAL_RE.search(f"{data.summary}\n{c.headline}\n" + "\n".join(data.interests))
    b.add(
        "infos_perso",
        "forme",
        personal is None,
        3,
        "Informations personnelles",
        "Pas d'informations personnelles inutiles.",
        "Le CV mentionne l'âge, la date de naissance ou la situation familiale.",
        "Retirez ces informations : elles ne sont pas obligatoires et n'aident pas les ATS.",
        severity="warning",
    )
    long_lines = sum(1 for e in exps for x in e.bullets if len(x) > 220)
    b.add(
        "lignes_longues",
        "forme",
        long_lines == 0,
        2,
        "Lignes courtes",
        "Les missions sont concises.",
        f"{long_lines} ligne(s) de mission trop longue(s).",
        "Coupez les phrases de plus de 2 lignes.",
        severity="warning",
    )

    # ---- Mots-clés
    text = resume_to_text(data)
    matched: list[str] = []
    missing: list[str] = []
    if offer_text:
        wanted = extract_keywords(offer_text, limit=12)
        blob = simplify(text)
        for kw in wanted:
            (matched if simplify(kw) in blob else missing).append(kw)
        ratio = len(matched) / len(wanted) if wanted else 1.0
        b.add(
            "mots_cles_offre",
            "mots_cles",
            False,
            30,
            "Mots-clés de l'offre",
            f"{len(matched)} mots-clés de l'offre sur {len(wanted)} sont présents.",
            f"Seulement {len(matched)} mots-clés de l'offre sur {len(wanted)} sont présents.",
            "Si vous avez réellement ces compétences, ajoutez ces mots tels quels : " + ", ".join(missing[:6]) + ".",
            partial=min(1.0, ratio / 0.7),
            severity="warning",
        )
    else:
        found = find_skills(text)
        b.add(
            "mots_cles_generaux",
            "mots_cles",
            False,
            30,
            "Mots-clés métier",
            f"{len(found)} compétences reconnues par les ATS.",
            f"Seulement {len(found)} compétences reconnues : les ATS risquent de passer à côté de votre profil.",
            "Nommez précisément vos outils et savoir-faire (ex. « Excel », « Accueil », « Facturation »). "
            "Comparez ensuite votre CV à une offre pour un score plus précis.",
            partial=min(1.0, len(found) / 8),
            severity="warning",
        )
        matched = found

    categories = []
    for key, (label, max_pts) in CATEGORIES.items():
        pts = sum(ch.points for ch in b.checks if ch.category == key)
        possible = sum(ch.max_points for ch in b.checks if ch.category == key)
        scaled = pts / possible * max_pts if possible else max_pts
        categories.append({"id": key, "label": label, "score": round(scaled), "max": max_pts})
    score = round(sum(cat["score"] for cat in categories))
    return Report(
        score=min(100, score),
        categories=categories,
        checks=b.checks,
        keywords_matched=matched,
        keywords_missing=missing,
        profile_tips=profile_tips(profile_type, data),
    )


def profile_tips(profile_type: str, data: ResumeData) -> list[str]:
    tips = {
        "alternant": [
            "Placez la formation en cours en premier et indiquez le rythme d'alternance (ex. 3 j / 2 j).",
            "Mettez en avant stages, projets d'école, jobs d'été et bénévolat.",
            "Précisez la date de début souhaitée du contrat.",
        ],
        "debutant": [
            "Valorisez les compétences transférables de vos expériences passées.",
            "Mentionnez les formations suivies récemment, même courtes (certificats, MOOC).",
            "Une accroche claire sur le métier visé compte beaucoup.",
        ],
        "confirme": [
            "Détaillez surtout les 10 dernières années, résumez le reste.",
            "Illustrez vos missions par des résultats réels (chiffres vrais uniquement).",
        ],
        "senior": [
            "Concentrez le détail sur les 15 dernières années ; regroupez le début de carrière en une ligne.",
            "N'indiquez ni âge ni date de naissance : ce n'est pas obligatoire.",
            "Mettez en avant les outils numériques maîtrisés et les formations récentes.",
            "Soulignez la transmission, l'encadrement et la fiabilité : ce sont de vrais atouts.",
        ],
    }
    out = list(tips.get(profile_type, tips["debutant"]))
    if profile_type == "senior" and len(data.experiences) > 6:
        out.insert(0, f"Vous avez {len(data.experiences)} expériences : regroupez les plus anciennes.")
    return out
