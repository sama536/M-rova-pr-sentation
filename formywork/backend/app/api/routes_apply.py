from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..apply import service
from ..auth import current_user
from ..config import get_settings
from ..db import get_db, utcnow
from ..models import APPLICATION_STATUSES, Application, ApplicationEvent, Offer, Resume, SavedSearch, User
from ..schemas import ApplicationIn, ApplicationUpdate, ApplyMarkIn, ApplyPrepareIn, ApplySendIn
from ..services.offers import NEW_WINDOW
from ..sources import ALL_SOURCES

router = APIRouter(prefix="/api", tags=["candidatures"])

STATUS_LABELS = {
    "a_postuler": "À postuler",
    "postule": "Postulé",
    "relance": "Relance",
    "entretien": "Entretien",
    "refus": "Refus",
    "offre": "Offre",
}


def _wrap(exc: service.ApplyError):
    return HTTPException(exc.status, str(exc))


@router.post("/apply/prepare")
async def prepare(payload: ApplyPrepareIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        return await service.prepare(db, user, payload.offer_id, payload.resume_id)
    except service.ApplyError as exc:
        raise _wrap(exc) from exc


@router.post("/apply/preview")
def preview(payload: ApplySendIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        return service.preview(
            db,
            user,
            offer_id=payload.offer_id,
            resume_id=payload.resume_id,
            subject=payload.subject,
            body=payload.body,
            letter=payload.letter,
            attach_letter=payload.attach_letter,
        )
    except service.ApplyError as exc:
        raise _wrap(exc) from exc


@router.post("/apply/send")
async def send(payload: ApplySendIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        app = await service.send(db, user, payload)
    except service.ApplyError as exc:
        raise _wrap(exc) from exc
    return application_out(db, app)


@router.post("/apply/mark")
def mark(payload: ApplyMarkIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        app = service.mark_applied(db, user, payload)
    except service.ApplyError as exc:
        raise _wrap(exc) from exc
    return application_out(db, app)


def application_out(db: Session, a: Application) -> dict:
    resume = db.get(Resume, a.resume_id) if a.resume_id else None
    offer = db.get(Offer, a.offer_id) if a.offer_id else None
    return {
        "id": a.id,
        "offer_id": a.offer_id,
        "resume_id": a.resume_id,
        "resume_name": resume.name if resume else None,
        "title": a.title,
        "company": a.company,
        "status": a.status,
        "notes": a.notes,
        "cover_letter": a.cover_letter,
        "applied_at": a.applied_at,
        "follow_up_at": a.follow_up_at,
        "interview_at": a.interview_at,
        "position": a.position,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "offer_url": (offer.url if offer else None),
        "events": [{"id": e.id, "kind": e.kind, "message": e.message, "created_at": e.created_at} for e in a.events],
    }


@router.get("/applications")
def list_applications(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Application)
        .where(Application.user_id == user.id)
        .order_by(Application.position, Application.updated_at.desc())
    )
    return [application_out(db, a) for a in rows]


@router.post("/applications")
def create_application(
    payload: ApplicationIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    title, company = payload.title.strip(), payload.company
    if payload.offer_id:
        offer = db.get(Offer, payload.offer_id)
        if offer is None:
            raise HTTPException(404, "Offre introuvable.")
        existing = service.existing_application(db, user, offer)
        if existing:
            return application_out(db, existing)
        title, company = title or offer.title, company or offer.company
    if not title:
        raise HTTPException(400, "Indiquez au moins l'intitulé du poste.")
    a = Application(
        user_id=user.id,
        offer_id=payload.offer_id,
        title=title,
        company=company,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(a)
    db.flush()
    db.add(ApplicationEvent(application_id=a.id, kind="status", message=f"Ajoutée dans « {STATUS_LABELS[a.status]} »"))
    db.commit()
    db.refresh(a)
    return application_out(db, a)


@router.patch("/applications/{app_id}")
def update_application(
    app_id: int, payload: ApplicationUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    a = db.get(Application, app_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Candidature introuvable.")
    if payload.status and payload.status != a.status:
        db.add(
            ApplicationEvent(
                application_id=a.id,
                kind="status",
                message=f"{STATUS_LABELS[a.status]} → {STATUS_LABELS[payload.status]}",
            )
        )
        a.status = payload.status
        if payload.status == "postule" and not a.applied_at:
            a.applied_at = utcnow()
            a.follow_up_at = a.follow_up_at or utcnow() + timedelta(days=7)
        if payload.status in ("refus", "offre"):
            a.follow_up_at = None
    if payload.notes is not None:
        a.notes = payload.notes
    if payload.follow_up_at is not None:
        a.follow_up_at = payload.follow_up_at.replace(tzinfo=None)
    if payload.clear_follow_up:
        a.follow_up_at = None
    if payload.interview_at is not None:
        a.interview_at = payload.interview_at.replace(tzinfo=None)
    if payload.position is not None:
        a.position = payload.position
    if payload.resume_id is not None:
        r = db.get(Resume, payload.resume_id)
        if r is None or r.user_id != user.id:
            raise HTTPException(404, "CV introuvable.")
        a.resume_id = r.id
    db.commit()
    db.refresh(a)
    return application_out(db, a)


@router.delete("/applications/{app_id}")
def delete_application(app_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    a = db.get(Application, app_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Candidature introuvable.")
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    from ..services.offers import offers_out

    counts = dict(
        db.execute(
            select(Application.status, func.count(Application.id))
            .where(Application.user_id == user.id)
            .group_by(Application.status)
        ).all()
    )
    now = utcnow()
    due = db.scalars(
        select(Application)
        .where(
            Application.user_id == user.id,
            Application.follow_up_at.is_not(None),
            Application.follow_up_at <= now + timedelta(days=1),
            Application.status.in_(["postule", "relance"]),
        )
        .order_by(Application.follow_up_at)
    ).all()
    interviews = db.scalars(
        select(Application)
        .where(
            Application.user_id == user.id,
            Application.interview_at.is_not(None),
            Application.interview_at >= now,
        )
        .order_by(Application.interview_at)
        .limit(5)
    ).all()
    recent = list(
        db.scalars(
            select(Offer)
            .where(Offer.expired.is_(False), Offer.first_seen_at >= now - NEW_WINDOW)
            .order_by(Offer.first_seen_at.desc())
            .limit(30)
        )
    )
    new_offers = [o for o in offers_out(db, recent, user) if o["is_new"]][:6]
    base = db.scalar(
        select(Resume).where(Resume.user_id == user.id, Resume.is_base.is_(True)).order_by(Resume.updated_at.desc())
    )
    resume_score = None
    if base:
        from ..ats.analyzer import analyze
        from ..ats.schema import ResumeData

        resume_score = {
            "id": base.id,
            "name": base.name,
            "score": analyze(ResumeData.model_validate(base.data), None, user.profile_type).score,
        }
    return {
        "counts": {s: counts.get(s, 0) for s in APPLICATION_STATUSES},
        "follow_ups": [application_out(db, a) for a in due],
        "interviews": [application_out(db, a) for a in interviews],
        "new_offers": new_offers,
        "new_offers_total": sum(1 for _ in new_offers),
        "resume": resume_score,
        "searches": db.scalar(select(func.count(SavedSearch.id)).where(SavedSearch.user_id == user.id)) or 0,
    }


@router.get("/settings/status")
def settings_status(user: User = Depends(current_user)) -> dict:
    s = get_settings()
    return {
        "demo_mode": s.demo_mode,
        "ai": {"enabled": s.ai_enabled, "model_summary": s.ai_model_summary, "model_cv": s.ai_model_cv},
        "mail": service.mail_status(user),
        "scraping_enabled": s.scraping_enabled,
        "refresh_api_minutes": s.refresh_api_minutes,
        "refresh_scraping_hours": s.refresh_scraping_hours,
        "sources": [
            {"name": src.name, "label": src.label, "kind": src.kind, "configured": src.is_configured()}
            for src in ALL_SOURCES
        ],
        "max_upload_mb": s.max_upload_mb,
    }
