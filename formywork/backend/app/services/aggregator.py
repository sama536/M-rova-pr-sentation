"""Interroge toutes les sources en parallèle, dédoublonne et enregistre les offres.

Une source qui échoue ne casse jamais les autres : son erreur est enregistrée et renvoyée à l'interface.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import Offer, SourceStatus
from ..sources import ALL_SOURCES, DAILY_LIMITS
from ..sources.base import NormalizedOffer, SearchParams, SourceBlocked, merge_duplicates, simplify
from .summaries import store_demo_summary

log = logging.getLogger("formywork.sources")
SOURCE_TIMEOUT_S = 25
GEO_URL = "https://geo.api.gouv.fr/communes"
_geo_cache: dict[str, dict | None] = {}


class GeoUnavailable(Exception):
    pass


@dataclass
class SourceReport:
    name: str
    label: str
    ok: bool
    count: int = 0
    error: str | None = None
    skipped: bool = False


@dataclass
class AggregateResult:
    offer_ids: list[int] = field(default_factory=list)
    new_offer_ids: list[int] = field(default_factory=list)
    reports: list[SourceReport] = field(default_factory=list)
    location_found: bool | None = None


async def geocode(location: str, client: httpx.AsyncClient) -> dict | None:
    """Ville → code INSEE + coordonnées via geo.api.gouv.fr (service public, sans clé)."""
    key = simplify(location)
    if not key or "teletravail" in key or "remote" in key:
        return None
    if key in _geo_cache:
        return _geo_cache[key]
    query: dict[str, str] = {"fields": "code,nom,centre,codesPostaux", "boost": "population", "limit": "1"}
    digits = "".join(c for c in location if c.isdigit())
    if len(digits) == 5:
        query["codePostal"] = digits
    else:
        query["nom"] = location.split(",")[0].strip()
    try:
        resp = await client.get(GEO_URL, params=query, timeout=8)
        resp.raise_for_status()
        items = resp.json()
    except (httpx.HTTPError, ValueError):
        log.warning("Géocodage impossible pour %s (service geo.api.gouv.fr injoignable)", location)
        raise GeoUnavailable from None
    result = None
    if items:
        item = items[0]
        coords = (item.get("centre") or {}).get("coordinates") or [None, None]
        result = {
            "insee": item.get("code"),
            "name": item.get("nom"),
            "lon": coords[0],
            "lat": coords[1],
            "postal_code": (item.get("codesPostaux") or [None])[0],
        }
    _geo_cache[key] = result
    return result


def _status(db: Session, name: str) -> SourceStatus:
    st = db.get(SourceStatus, name)
    if st is None:
        st = SourceStatus(name=name)
        db.add(st)
        db.flush()
    return st


def _quota_ok(st: SourceStatus, name: str) -> bool:
    today = utcnow().date().isoformat()
    if st.calls_day != today:
        st.calls_day, st.calls_today = today, 0
    return st.calls_today < DAILY_LIMITS.get(name, 100)


async def _run_source(source, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
    return await asyncio.wait_for(source.search(params, client), timeout=SOURCE_TIMEOUT_S)


def active_sources(kinds: set[str] | None = None) -> list:
    return [s for s in ALL_SOURCES if s.is_configured() and (kinds is None or s.kind in kinds)]


async def aggregate(
    db: Session,
    params: SearchParams,
    *,
    kinds: set[str] | None = None,
    client: httpx.AsyncClient | None = None,
) -> AggregateResult:
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=20, follow_redirects=True)
    result = AggregateResult()
    try:
        if params.location and params.latitude is None:
            try:
                geo = await geocode(params.location, client)
                result.location_found = geo is not None
            except GeoUnavailable:
                geo = None  # on continue : les sources qui acceptent une ville en texte libre fonctionnent
            if geo:
                params.insee_code = geo["insee"]
                params.latitude, params.longitude = geo["lat"], geo["lon"]
                params.postal_code = geo["postal_code"]

        sources = active_sources(kinds)
        runnable = []
        for source in sources:
            st = _status(db, source.name)
            if st.blocked_until and st.blocked_until > utcnow():
                result.reports.append(
                    SourceReport(
                        source.name, source.label, False, error="Source en pause après un blocage.", skipped=True
                    )
                )
            elif not _quota_ok(st, source.name):
                result.reports.append(
                    SourceReport(source.name, source.label, False, error="Quota du jour atteint.", skipped=True)
                )
            else:
                st.calls_today += 1
                runnable.append(source)
        db.commit()

        outcomes = await asyncio.gather(*(_run_source(s, params, client) for s in runnable), return_exceptions=True)

        collected: list[NormalizedOffer] = []
        for source, outcome in zip(runnable, outcomes, strict=True):
            st = _status(db, source.name)
            if isinstance(outcome, BaseException):
                message = _error_message(outcome)
                log.warning("Source %s en échec : %s", source.name, message)
                st.last_error, st.last_error_at = message, utcnow()
                if isinstance(outcome, SourceBlocked):
                    st.blocked_until = utcnow() + timedelta(hours=24 if source.kind == "scraping" else 1)
                result.reports.append(SourceReport(source.name, source.label, False, error=message))
            else:
                st.last_success_at, st.last_count, st.last_error = utcnow(), len(outcome), None
                result.reports.append(SourceReport(source.name, source.label, True, count=len(outcome)))
                collected.extend(outcome)

        for normalized in merge_duplicates(collected):
            offer, created = upsert_offer(db, normalized)
            result.offer_ids.append(offer.id)
            if created:
                result.new_offer_ids.append(offer.id)
        db.commit()
    finally:
        if own_client:
            await client.aclose()
    return result


def _error_message(exc: BaseException) -> str:
    if isinstance(exc, asyncio.TimeoutError):
        return "La source a mis trop de temps à répondre."
    if isinstance(exc, httpx.ConnectError):
        return "Connexion impossible (internet coupé ou site indisponible)."
    if isinstance(exc, httpx.HTTPError):
        return f"Erreur réseau : {exc.__class__.__name__}."
    text = str(exc) or exc.__class__.__name__
    return text[:400]


def upsert_offer(db: Session, n: NormalizedOffer) -> tuple[Offer, bool]:
    now = utcnow()
    offer = db.scalar(select(Offer).where(Offer.source == n.source, Offer.external_id == n.external_id))
    if offer is None:
        # Même offre déjà connue via une autre source ? On la complète au lieu de créer un doublon.
        twin = db.scalar(select(Offer).where(Offer.dedup_key == n.dedup_key, Offer.source != n.source))
        if twin is not None:
            if n.source not in twin.also_on:
                twin.also_on = [*twin.also_on, n.source]
            twin.apply_email = twin.apply_email or n.apply_email
            twin.last_seen_at, twin.expired = now, False
            return twin, False
        offer = Offer(source=n.source, external_id=n.external_id, first_seen_at=now)
        db.add(offer)
        created = True
    else:
        created = False
    offer.dedup_key = n.dedup_key
    offer.title = n.title[:300]
    offer.company = n.company
    offer.location = n.location
    offer.postal_code = n.postal_code
    offer.latitude, offer.longitude = n.latitude, n.longitude
    offer.contract_type = n.contract_type
    offer.is_alternance = n.is_alternance
    offer.remote = n.remote
    offer.salary = n.salary
    offer.description = n.description
    offer.url = n.url
    offer.apply_email = n.apply_email
    offer.apply_url = n.apply_url
    offer.published_at = n.published_at
    offer.also_on = sorted(set(offer.also_on or []) | set(n.extra.get("also_on", [])))
    offer.last_seen_at = now
    offer.expired = False
    offer.content_hash = n.content_hash
    db.flush()
    if n.extra.get("demo_summary"):
        store_demo_summary(db, offer.content_hash, n.extra["demo_summary"], n.extra.get("demo_keywords") or [])
    return offer, created


def expire_old_offers(db: Session, days: int) -> int:
    """Une offre qu'aucune source n'a revue depuis `days` jours est considérée comme expirée."""
    limit = utcnow() - timedelta(days=days)
    offers = db.scalars(select(Offer).where(Offer.expired.is_(False), Offer.last_seen_at < limit)).all()
    for offer in offers:
        offer.expired = True
    db.commit()
    return len(offers)
