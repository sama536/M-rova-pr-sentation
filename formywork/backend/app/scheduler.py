"""Tâches de fond : rafraîchissement des recherches enregistrées, offres expirées, rappels de relance."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from .config import get_settings
from .db import SessionLocal, utcnow
from .models import Application, SavedSearch
from .services.aggregator import expire_old_offers
from .services.events import broker
from .services.offers import run_saved_search
from .sources import demo_source

log = logging.getLogger("formywork.scheduler")
_reminded: set[tuple[int, str]] = set()


def _search_ids(*, scraping_due: bool = False) -> list[int]:
    s = get_settings()
    with SessionLocal() as db:
        q = select(SavedSearch).where(SavedSearch.auto_refresh.is_(True))
        rows = db.scalars(q).all()
        if scraping_due:
            limit = utcnow() - timedelta(hours=s.refresh_scraping_hours)
            rows = [r for r in rows if r.last_scrape_at is None or r.last_scrape_at < limit]
        return [r.id for r in rows]


async def refresh_apis() -> None:
    for sid in _search_ids():
        try:
            await run_saved_search(sid, kinds={"api", "demo"}, notify=True)
        except Exception:  # une recherche en échec ne bloque pas les autres
            log.exception("Rafraîchissement de la recherche %s en échec", sid)


async def refresh_scraping() -> None:
    if not get_settings().scraping_enabled:
        return
    for sid in _search_ids(scraping_due=True):
        try:
            await run_saved_search(sid, kinds={"scraping"}, notify=True)
        except Exception:
            log.exception("Lecture des pages publiques en échec pour la recherche %s", sid)


async def demo_tick() -> None:
    if demo_source.release_next():
        for sid in _search_ids():
            await run_saved_search(sid, kinds={"demo"}, notify=True)


def expire_job() -> None:
    with SessionLocal() as db:
        n = expire_old_offers(db, get_settings().offer_expiry_days)
    if n:
        log.info("%s offre(s) marquée(s) comme expirée(s)", n)
        broker.publish(None, "expired", {"count": n})


def reminders_job() -> None:
    today = utcnow().date().isoformat()
    with SessionLocal() as db:
        rows = db.scalars(
            select(Application).where(
                Application.follow_up_at.is_not(None),
                Application.follow_up_at <= utcnow(),
                Application.status.in_(["postule", "relance"]),
            )
        ).all()
        for a in rows:
            key = (a.id, today)
            if key in _reminded:
                continue
            _reminded.add(key)
            broker.publish(a.user_id, "reminder", {"application_id": a.id, "title": a.title, "company": a.company})


def build_scheduler() -> AsyncIOScheduler:
    s = get_settings()
    sched = AsyncIOScheduler(job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 120})
    sched.add_job(refresh_apis, "interval", minutes=s.refresh_api_minutes, id="refresh_apis")
    sched.add_job(refresh_scraping, "interval", minutes=60, id="refresh_scraping")
    sched.add_job(expire_job, "interval", hours=6, id="expire", next_run_time=datetime.now() + timedelta(minutes=1))
    sched.add_job(
        reminders_job, "interval", minutes=30, id="reminders", next_run_time=datetime.now() + timedelta(seconds=30)
    )
    if s.demo_mode:
        sched.add_job(demo_tick, "interval", minutes=s.demo_new_offer_minutes, id="demo_tick")
    return sched
