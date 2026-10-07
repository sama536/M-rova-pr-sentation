"""Recherche, recherches enregistrées et mise en forme des offres pour l'interface."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal, utcnow
from ..models import Application, Offer, OfferSummary, SavedSearch, SearchResult, User, UserOffer
from ..sources import ALL_SOURCES
from ..sources.base import SearchParams
from .aggregator import AggregateResult, aggregate
from .events import broker
from .summaries import get_summary, simple_summary

log = logging.getLogger("formywork.offers")
NEW_WINDOW = timedelta(hours=36)
SOURCE_LABELS = {s.name: s.label for s in ALL_SOURCES}
_summary_lock = asyncio.Semaphore(3)


def offer_out(
    db: Session,
    offer: Offer,
    user: User,
    *,
    detail: bool = False,
    state: UserOffer | None = None,
    summary: OfferSummary | None = None,
    app_status: str | None = None,
) -> dict:
    if state is None:
        state = db.scalar(select(UserOffer).where(UserOffer.user_id == user.id, UserOffer.offer_id == offer.id))
    if summary is None and offer.content_hash:
        summary = db.get(OfferSummary, offer.content_hash)
    if app_status is None:
        app_status = db.scalar(
            select(Application.status).where(Application.user_id == user.id, Application.offer_id == offer.id)
        )
    out = {
        "id": offer.id,
        "source": offer.source,
        "source_label": SOURCE_LABELS.get(offer.source, offer.source),
        "also_on": [SOURCE_LABELS.get(s, s) for s in (offer.also_on or [])],
        "title": offer.title,
        "company": offer.company,
        "location": offer.location,
        "contract_type": offer.contract_type,
        "is_alternance": offer.is_alternance,
        "remote": offer.remote,
        "salary": offer.salary,
        "url": offer.url,
        "apply_email": offer.apply_email,
        "apply_url": offer.apply_url,
        "published_at": offer.published_at,
        "first_seen_at": offer.first_seen_at,
        "expired": offer.expired,
        "is_new": (state is None or state.opened_at is None) and offer.first_seen_at >= utcnow() - NEW_WINDOW,
        "favorite": bool(state and state.favorite),
        "hidden": bool(state and state.hidden),
        "summary": summary.summary if summary else None,
        "keywords": summary.keywords if summary else None,
        "summary_by": summary.generated_by if summary else None,
        "application_status": app_status,
    }
    if detail:
        out["description"] = offer.description
    return out


def offers_out(db: Session, offers: list[Offer], user: User, *, include_hidden: bool = False) -> list[dict]:
    ids = [o.id for o in offers]
    states = {
        s.offer_id: s
        for s in db.scalars(select(UserOffer).where(UserOffer.user_id == user.id, UserOffer.offer_id.in_(ids)))
    }
    hashes = [o.content_hash for o in offers if o.content_hash]
    summaries = {
        s.content_hash: s for s in db.scalars(select(OfferSummary).where(OfferSummary.content_hash.in_(hashes)))
    }
    apps = dict(
        db.execute(
            select(Application.offer_id, Application.status).where(
                Application.user_id == user.id, Application.offer_id.in_(ids)
            )
        ).all()
    )
    result = []
    for offer in offers:
        state = states.get(offer.id)
        if state and state.hidden and not include_hidden:
            continue
        result.append(
            offer_out(
                db,
                offer,
                user,
                state=state,
                summary=summaries.get(offer.content_hash),
                app_status=apps.get(offer.id, ""),
            )
        )
    for item in result:
        item["application_status"] = item["application_status"] or None
    return result


def ensure_simple_summaries(db: Session, offers: list[Offer]) -> list[int]:
    """Sans IA : résumé simple immédiat. Avec IA : renvoie les offres à résumer en arrière-plan."""
    pending: list[int] = []
    for offer in offers:
        if offer.content_hash and db.get(OfferSummary, offer.content_hash) is None:
            if get_settings().ai_enabled:
                pending.append(offer.id)
            else:
                lines, kws = simple_summary(offer)
                db.add(
                    OfferSummary(content_hash=offer.content_hash, summary=lines, keywords=kws, generated_by="simple")
                )
    db.commit()
    return pending


async def summarize_in_background(offer_ids: list[int], user_id: int | None) -> None:
    async def one(offer_id: int) -> None:
        async with _summary_lock:
            with SessionLocal() as db:
                offer = db.get(Offer, offer_id)
                if offer:
                    await get_summary(db, offer)

    await asyncio.gather(*(one(i) for i in offer_ids), return_exceptions=True)
    if offer_ids:
        broker.publish(user_id, "summaries", {"offer_ids": offer_ids})


def sorted_offers(db: Session, ids: list[int]) -> list[Offer]:
    if not ids:
        return []
    offers = list(db.scalars(select(Offer).where(Offer.id.in_(ids), Offer.expired.is_(False))))
    offers.sort(key=lambda o: o.published_at or o.first_seen_at, reverse=True)
    return offers


def link_results(db: Session, search: SavedSearch, offer_ids: list[int]) -> list[int]:
    known = set(db.scalars(select(SearchResult.offer_id).where(SearchResult.search_id == search.id)))
    fresh = [i for i in offer_ids if i not in known]
    for oid in fresh:
        db.add(SearchResult(search_id=search.id, offer_id=oid))
    db.commit()
    return fresh


def remote_filter(params: SearchParams, offers: list[Offer]) -> list[Offer]:
    if params.remote == "total":
        return [o for o in offers if o.remote == "total"]
    if params.remote == "partiel":
        return [o for o in offers if o.remote in ("partiel", "total")]
    return offers


async def run_saved_search(search_id: int, *, kinds: set[str] | None, notify: bool) -> AggregateResult | None:
    with SessionLocal() as db:
        search = db.get(SavedSearch, search_id)
        if search is None:
            return None
        params = SearchParams.from_dict(search.params)
        result = await aggregate(db, params, kinds=kinds)
        offers = remote_filter(params, sorted_offers(db, result.offer_ids))
        fresh = link_results(db, search, [o.id for o in offers])
        now = utcnow()
        search.last_run_at = now
        if kinds and "scraping" in kinds:
            search.last_scrape_at = now
        db.commit()
        pending = ensure_simple_summaries(db, [o for o in offers if o.id in fresh])
        if notify and fresh and search.last_run_at:
            titles = [o.title for o in offers if o.id in fresh][:3]
            broker.publish(
                search.user_id,
                "new_offers",
                {
                    "search_id": search.id,
                    "search_name": search.name,
                    "count": len(fresh),
                    "titles": titles,
                },
            )
        broker.publish(search.user_id, "sources", {"reports": [r.__dict__ for r in result.reports]})
        user_id = search.user_id
    if pending:
        await summarize_in_background(pending, user_id)
    return result
