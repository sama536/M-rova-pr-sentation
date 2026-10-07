"""Source « Démo » : offres d'exemple réalistes, aucune clé nécessaire."""

from __future__ import annotations

from datetime import timedelta

import httpx

from ..config import get_settings
from ..db import utcnow
from ..demo.offers import DEMO_INCOMING, DEMO_OFFERS
from .base import NormalizedOffer, SearchParams, simplify

# Villes proches pour que « Lyon, 20 km » trouve Villeurbanne, Bron, etc.
_NEAR = {
    "lyon": ["lyon", "villeurbanne", "vaulx", "bron", "saint fons", "corbas", "venissieux"],
    "paris": ["paris", "boulogne", "montreuil", "saint denis"],
}


def demo_to_offer(raw: dict, *, days_ago: int | None = None) -> NormalizedOffer:
    days = raw.get("days_ago", 0) if days_ago is None else days_ago
    offer = NormalizedOffer(
        source="demo",
        external_id=raw["id"],
        title=raw["title"],
        description=raw["description"],
        company=raw["company"],
        location=raw["location"],
        postal_code=raw.get("postal_code"),
        latitude=raw.get("lat"),
        longitude=raw.get("lon"),
        contract_type=raw["contract"],
        is_alternance=raw["contract"] == "alternance",
        remote=raw.get("remote", "inconnu"),
        salary=raw.get("salary"),
        url=f"https://example.org/offres/{raw['id']}",
        apply_email=raw.get("apply_email"),
        published_at=utcnow() - timedelta(days=days, hours=2),
    )
    offer.extra["demo_summary"] = raw.get("summary")
    offer.extra["demo_keywords"] = raw.get("keywords")
    return offer


def matches(offer: NormalizedOffer, params: SearchParams) -> bool:
    if params.contract and offer.contract_type != params.contract:
        return False
    if params.remote == "total" and offer.remote != "total":
        return False
    if params.remote == "partiel" and offer.remote not in ("partiel", "total"):
        return False
    if params.query:
        blob = simplify(f"{offer.title} {offer.description} {offer.company}")
        words = [w for w in simplify(params.query).split() if len(w) > 2]
        if words and not any(w in blob for w in words):
            return False
    if params.location and offer.remote != "total":
        loc = simplify(params.location)
        city = simplify(offer.location)
        near = next((v for k, v in _NEAR.items() if k in loc), [loc])
        if not any(n in city for n in near):
            return False
    if params.max_days and offer.published_at and offer.published_at < utcnow() - timedelta(days=params.max_days):
        return False
    return True


class DemoSource:
    name = "demo"
    label = "Offres d'exemple (démo)"
    kind = "demo"

    def __init__(self) -> None:
        self.released = 0  # nombre d'offres « entrantes » déjà publiées

    def is_configured(self) -> bool:
        return get_settings().demo_mode

    def release_next(self) -> bool:
        if self.released < len(DEMO_INCOMING):
            self.released += 1
            return True
        return False

    def all_offers(self) -> list[NormalizedOffer]:
        offers = [demo_to_offer(raw) for raw in DEMO_OFFERS]
        offers += [demo_to_offer(raw, days_ago=0) for raw in DEMO_INCOMING[: self.released]]
        return offers

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        return [o for o in self.all_offers() if matches(o, params)]
