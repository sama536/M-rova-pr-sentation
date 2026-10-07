from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db, utcnow
from ..models import Offer, SavedSearch, SearchResult, SourceStatus, User, UserOffer
from ..schemas import OfferStateIn, SavedSearchIn, SearchIn
from ..services.aggregator import aggregate
from ..services.offers import (
    NEW_WINDOW,
    ensure_simple_summaries,
    link_results,
    offer_out,
    offers_out,
    remote_filter,
    run_saved_search,
    sorted_offers,
    summarize_in_background,
)
from ..services.summaries import get_summary
from ..sources import ALL_SOURCES
from ..sources.base import SearchParams

router = APIRouter(prefix="/api", tags=["offres"])
_background: set[asyncio.Task] = set()


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)


@router.post("/search")
async def search(payload: SearchIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    params = SearchParams(**payload.model_dump())
    result = await aggregate(db, params)
    offers = remote_filter(params, sorted_offers(db, result.offer_ids))
    pending = ensure_simple_summaries(db, offers)
    if pending:
        _spawn(summarize_in_background(pending, user.id))
    return {
        "offers": offers_out(db, offers, user),
        "sources": [r.__dict__ for r in result.reports],
        "location_found": result.location_found,
    }


@router.get("/offers")
def list_offers(view: str = "recent", user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    q = select(Offer).where(Offer.expired.is_(False))
    if view == "favorites":
        q = q.join(UserOffer, UserOffer.offer_id == Offer.id).where(
            UserOffer.user_id == user.id, UserOffer.favorite.is_(True)
        )
    elif view == "hidden":
        q = q.join(UserOffer, UserOffer.offer_id == Offer.id).where(
            UserOffer.user_id == user.id, UserOffer.hidden.is_(True)
        )
    elif view == "new":
        q = q.where(Offer.first_seen_at >= utcnow() - NEW_WINDOW)
    offers = list(db.scalars(q.order_by(Offer.first_seen_at.desc()).limit(200)))
    items = offers_out(db, offers, user, include_hidden=view == "hidden")
    if view == "new":
        items = [i for i in items if i["is_new"]]
    return items


@router.get("/offers/{offer_id}")
def get_offer(offer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    offer = db.get(Offer, offer_id)
    if offer is None:
        raise HTTPException(404, "Offre introuvable.")
    out = offer_out(db, offer, user, detail=True)
    state = db.scalar(select(UserOffer).where(UserOffer.user_id == user.id, UserOffer.offer_id == offer.id))
    if state is None:
        state = UserOffer(user_id=user.id, offer_id=offer.id)
        db.add(state)
    if state.opened_at is None:
        state.opened_at = utcnow()
    db.commit()
    return out


@router.post("/offers/{offer_id}/summary")
async def offer_summary(offer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    offer = db.get(Offer, offer_id)
    if offer is None:
        raise HTTPException(404, "Offre introuvable.")
    summary = await get_summary(db, offer)
    return {"summary": summary.summary, "keywords": summary.keywords, "summary_by": summary.generated_by}


@router.patch("/offers/{offer_id}/state")
def set_state(
    offer_id: int, payload: OfferStateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    if db.get(Offer, offer_id) is None:
        raise HTTPException(404, "Offre introuvable.")
    state = db.scalar(select(UserOffer).where(UserOffer.user_id == user.id, UserOffer.offer_id == offer_id))
    if state is None:
        state = UserOffer(user_id=user.id, offer_id=offer_id)
        db.add(state)
    if payload.favorite is not None:
        state.favorite = payload.favorite
    if payload.hidden is not None:
        state.hidden = payload.hidden
    db.commit()
    return {"favorite": state.favorite, "hidden": state.hidden}


# ------------------------------------------------------------- recherches enregistrées


def _search_out(db: Session, s: SavedSearch, user: User) -> dict:
    new_count = (
        db.scalar(
            select(func.count(SearchResult.id))
            .join(Offer, Offer.id == SearchResult.offer_id)
            .outerjoin(UserOffer, (UserOffer.offer_id == Offer.id) & (UserOffer.user_id == user.id))
            .where(
                SearchResult.search_id == s.id,
                Offer.expired.is_(False),
                Offer.first_seen_at >= utcnow() - NEW_WINDOW,
                UserOffer.opened_at.is_(None),
            )
        )
        or 0
    )
    return {
        "id": s.id,
        "name": s.name,
        "params": s.params,
        "auto_refresh": s.auto_refresh,
        "last_run_at": s.last_run_at,
        "new_count": new_count,
    }


@router.get("/searches")
def list_searches(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(SavedSearch).where(SavedSearch.user_id == user.id).order_by(SavedSearch.created_at))
    return [_search_out(db, s, user) for s in rows]


@router.post("/searches")
async def create_search(
    payload: SavedSearchIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    count = db.scalar(select(func.count(SavedSearch.id)).where(SavedSearch.user_id == user.id)) or 0
    if count >= 15:
        raise HTTPException(400, "Maximum 15 recherches enregistrées.")
    s = SavedSearch(
        user_id=user.id,
        name=payload.name.strip(),
        params=payload.params.model_dump(),
        auto_refresh=payload.auto_refresh,
        last_run_at=utcnow(),
    )
    db.add(s)
    db.commit()
    # Mémorise les offres déjà connues pour cette recherche (elles ne déclencheront pas de notification).
    params = SearchParams.from_dict(s.params)
    result = await aggregate(db, params)
    link_results(db, s, [o.id for o in remote_filter(params, sorted_offers(db, result.offer_ids))])
    return _search_out(db, s, user)


@router.delete("/searches/{search_id}")
def delete_search(search_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = db.get(SavedSearch, search_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Recherche introuvable.")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/searches/{search_id}/refresh")
async def refresh_search(search_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = db.get(SavedSearch, search_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Recherche introuvable.")
    result = await run_saved_search(search_id, kinds={"api", "demo"}, notify=False)
    return {"sources": [r.__dict__ for r in result.reports] if result else []}


@router.get("/searches/{search_id}/offers")
def search_offers(search_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    s = db.get(SavedSearch, search_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Recherche introuvable.")
    ids = list(db.scalars(select(SearchResult.offer_id).where(SearchResult.search_id == s.id)))
    return offers_out(db, sorted_offers(db, ids), user)


# ------------------------------------------------------------------------ sources


@router.get("/sources")
def sources(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    out = []
    for src in ALL_SOURCES:
        st = db.get(SourceStatus, src.name)
        out.append(
            {
                "name": src.name,
                "label": src.label,
                "kind": src.kind,
                "configured": src.is_configured(),
                "last_success_at": st.last_success_at if st else None,
                "last_error": st.last_error if st else None,
                "last_error_at": st.last_error_at if st else None,
                "last_count": st.last_count if st else 0,
                "blocked_until": st.blocked_until if st else None,
                "calls_today": st.calls_today if st and st.calls_day == utcnow().date().isoformat() else 0,
            }
        )
    return out
