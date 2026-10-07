from __future__ import annotations

from .adzuna import AdzunaSource
from .demo import DemoSource
from .france_travail import FranceTravailSource
from .jooble import JoobleSource
from .labonnealternance import LaBonneAlternanceSource
from .scraping import HelloworkSource

demo_source = DemoSource()

ALL_SOURCES = [
    FranceTravailSource(),
    AdzunaSource(),
    JoobleSource(),
    LaBonneAlternanceSource(),
    HelloworkSource(),
    demo_source,
]

# Plafonds quotidiens prudents (bien en dessous des quotas annoncés par chaque service).
DAILY_LIMITS = {
    "france_travail": 800,
    "adzuna": 200,  # quota Adzuna par défaut : 250/jour
    "jooble": 20,  # clé gratuite : quota total limité
    "la_bonne_alternance": 1000,
    "hellowork": 30,
    "demo": 100000,
}


def get_source(name: str):
    return next((s for s in ALL_SOURCES if s.name == name), None)
