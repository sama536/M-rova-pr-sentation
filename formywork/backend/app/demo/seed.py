"""Données du mode démo : un compte, un CV d'exemple, des recherches et des candidatures."""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..api.routes_auth import DEMO_EMAIL, DEMO_PASSWORD
from ..auth import hash_password
from ..db import utcnow
from ..models import Application, ApplicationEvent, Offer, Resume, SavedSearch, SearchResult, User
from ..services.aggregator import upsert_offer
from ..sources import demo_source

log = logging.getLogger("formywork.demo")

DEMO_RESUME = {
    "contact": {
        "full_name": "Dominique Laurent",
        "headline": "Assistante de gestion et comptabilité",
        "email": "dominique.laurent@example.org",
        "phone": "06 12 34 56 78",
        "city": "Lyon",
        "links": [],
    },
    "summary": (
        "Assistante de gestion avec une longue expérience en PME, je prends en charge la facturation, le suivi "
        "des règlements et l'accueil. Organisée et fiable, je me forme régulièrement aux outils numériques "
        "et je souhaite mettre mon expérience au service d'une équipe administrative ou comptable."
    ),
    "experiences": [
        {
            "title": "Assistante de gestion",
            "company": "Imprimerie Dufour",
            "location": "Lyon",
            "start": "03/2009",
            "end": "06/2025",
            "current": False,
            "bullets": [
                "Établir les devis et les factures pour environ 300 clients professionnels",
                "Suivre les règlements et relancer les impayés",
                "Préparer les éléments de paie pour 18 salariés avec le cabinet comptable",
                "Accueillir les clients et gérer le standard téléphonique",
            ],
        },
        {
            "title": "Secrétaire comptable",
            "company": "Garage Martin & Fils",
            "location": "Villeurbanne",
            "start": "09/1998",
            "end": "02/2009",
            "current": False,
            "bullets": [
                "Saisir les écritures comptables courantes",
                "Classer et archiver les pièces justificatives",
            ],
        },
    ],
    "education": [
        {
            "degree": "Formation « Excel perfectionnement »",
            "school": "GRETA Lyon Métropole",
            "location": "Lyon",
            "start": "",
            "end": "2025",
            "details": "Tableaux croisés dynamiques, fonctions de recherche.",
        },
        {
            "degree": "BTS Comptabilité et gestion",
            "school": "Lycée La Martinière",
            "location": "Lyon",
            "start": "",
            "end": "1998",
            "details": "",
        },
    ],
    "skills": ["Facturation", "Devis", "Excel", "Sage", "Accueil", "Organisation", "Rigueur", "Polyvalence"],
    "languages": [{"name": "Anglais", "level": "notions"}],
    "certifications": [],
    "interests": ["Bénévolat dans une association de quartier (trésorière)"],
    "import_flags": {},
}


def seed_demo(db: Session) -> None:
    """Crée les données de démonstration si elles n'existent pas encore (appel idempotent)."""
    if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
        return
    log.info("Création des données de démonstration")
    user = User(
        email=DEMO_EMAIL,
        display_name="Dominique",
        password_hash=hash_password(DEMO_PASSWORD),
        profile_type="senior",
        onboarded=True,
        preferences={"theme": "light", "text_size": "normal"},
    )
    db.add(user)
    db.flush()

    offers: dict[str, Offer] = {}
    for normalized in demo_source.all_offers():
        offer, _ = upsert_offer(db, normalized)
        # Les offres anciennes ont été « vues » à leur date de publication (pas de badge Nouveau).
        offer.first_seen_at = normalized.published_at or utcnow()
        offers[normalized.external_id] = offer
    db.flush()

    resume = Resume(user_id=user.id, name="Mon CV principal", data=DEMO_RESUME, is_base=True)
    db.add(resume)

    s1 = SavedSearch(
        user_id=user.id,
        name="Gestion et comptabilité – Lyon",
        params={
            "query": "comptable gestion facturation",
            "location": "Lyon",
            "radius_km": 20,
            "contract": "",
            "max_days": 0,
            "remote": "",
        },
        last_run_at=utcnow(),
    )
    s2 = SavedSearch(
        user_id=user.id,
        name="Alternance – Lyon",
        params={
            "query": "",
            "location": "Lyon",
            "radius_km": 20,
            "contract": "alternance",
            "max_days": 0,
            "remote": "",
        },
        last_run_at=utcnow(),
    )
    db.add_all([s1, s2])
    db.flush()
    for oid in ("demo-001", "demo-003", "demo-010", "demo-006"):
        db.add(SearchResult(search_id=s1.id, offer_id=offers[oid].id))
    for oid in ("demo-001", "demo-002", "demo-007", "demo-009"):
        db.add(SearchResult(search_id=s2.id, offer_id=offers[oid].id))

    now = utcnow()
    samples = [
        ("demo-010", "a_postuler", "Petite entreprise, appeler pour se présenter avant d'envoyer.", None, None, None),
        (
            "demo-003",
            "postule",
            "Envoyé par e-mail avec le CV adapté.",
            now - timedelta(days=8),
            now - timedelta(hours=3),
            None,
        ),
        (
            "demo-006",
            "relance",
            "Relance faite par téléphone le 2/10.",
            now - timedelta(days=15),
            now + timedelta(days=3),
            None,
        ),
        (
            "demo-004",
            "entretien",
            "Entretien avec la directrice pédagogique. Préparer un exemple de séance Excel.",
            now - timedelta(days=12),
            None,
            now + timedelta(days=2, hours=3),
        ),
        ("demo-008", "refus", "Réponse reçue : poste pourvu en interne.", now - timedelta(days=30), None, None),
    ]
    for pos, (oid, status, note, applied, follow, interview) in enumerate(samples):
        offer = offers[oid]
        app = Application(
            user_id=user.id,
            offer_id=offer.id,
            title=offer.title,
            company=offer.company,
            status=status,
            notes=note,
            applied_at=applied,
            follow_up_at=follow,
            interview_at=interview,
            position=pos,
        )
        db.add(app)
        db.flush()
        db.add(ApplicationEvent(application_id=app.id, kind="status", message="Candidature ajoutée (exemple de démo)"))
    db.commit()
