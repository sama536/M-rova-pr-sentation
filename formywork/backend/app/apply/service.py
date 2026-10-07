"""Bouton « Postuler » : préparation, aperçu exact, envoi après confirmation, historique, anti-doublon.

Aucun formulaire de site n'est rempli automatiquement et aucun compte n'est utilisé à la place de la personne.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import smtplib
import ssl
from datetime import timedelta
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.adapt import adapt_resume, standard_answers, write_letter
from ..ats.analyzer import analyze
from ..ats.export import letter_to_pdf, to_pdf
from ..ats.schema import ResumeData
from ..config import get_settings
from ..db import utcnow
from ..models import Application, ApplicationEvent, Offer, Resume, User


class ApplyError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _safe_filename(text: str) -> str:
    return re.sub(r"[^\w\- ]+", "", text, flags=re.UNICODE).strip() or "candidat"


def fingerprint(*, to: str | None, subject: str, body: str, letter: str, attach_letter: bool, resume: Resume) -> str:
    raw = "\x1f".join(
        [to or "", subject, body, letter if attach_letter else "", str(resume.id), resume.updated_at.isoformat()]
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def mail_status(user: User) -> dict:
    s = get_settings()
    password = s.smtp_password_for(user.email)
    if password:
        return {"mode": "smtp", "ready": True, "sender": user.email, "label": f"Envoi depuis {user.email}"}
    if s.demo_mode:
        return {
            "mode": "simulation",
            "ready": True,
            "sender": user.email,
            "label": "Mode démo : l'envoi est simulé, aucun e-mail ne part.",
        }
    return {
        "mode": "none",
        "ready": False,
        "sender": None,
        "label": "Envoi d'e-mail non configuré (voir Réglages et le README).",
    }


def existing_application(db: Session, user: User, offer: Offer) -> Application | None:
    return db.scalar(select(Application).where(Application.user_id == user.id, Application.offer_id == offer.id))


def base_resume(db: Session, user: User, resume_id: int | None) -> Resume:
    if resume_id:
        resume = db.get(Resume, resume_id)
        if resume is None or resume.user_id != user.id:
            raise ApplyError("CV introuvable.", 404)
        if not resume.is_base and resume.parent_id:
            parent = db.get(Resume, resume.parent_id)
            if parent:
                return parent
        return resume
    resume = db.scalar(
        select(Resume).where(Resume.user_id == user.id, Resume.is_base.is_(True)).order_by(Resume.updated_at.desc())
    )
    if resume is None:
        raise ApplyError("Ajoutez d'abord un CV dans « Mes CV ».", 400)
    return resume


async def get_or_create_variant(db: Session, user: User, offer: Offer, base: Resume) -> Resume:
    variant = db.scalar(
        select(Resume)
        .where(Resume.user_id == user.id, Resume.offer_id == offer.id, Resume.is_base.is_(False))
        .order_by(Resume.updated_at.desc())
    )
    if variant:
        return variant
    return await create_variant(db, user, offer, base, with_letter=True)


async def create_variant(db: Session, user: User, offer: Offer, base: Resume, *, with_letter: bool) -> Resume:
    base_data = ResumeData.model_validate(base.data)
    offer_text = f"{offer.title}\n{offer.description}"
    before = analyze(base_data, offer_text, user.profile_type)
    adapted = await adapt_resume(base_data, offer, user.profile_type)
    after = analyze(adapted["data"], offer_text, user.profile_type)
    letter = await write_letter(adapted["data"], offer, user.profile_type) if with_letter else None
    variant = Resume(
        user_id=user.id,
        name=f"{base.name} – {offer.title[:60]}",
        data=adapted["data"].model_dump(),
        is_base=False,
        parent_id=base.id,
        offer_id=offer.id,
        adaptation={
            "changes": adapted["changes"],
            "points": adapted["points"],
            "generated_by": adapted["generated_by"],
            "score_before": before.score,
            "score_after": after.score,
            "keywords_missing": after.keywords_missing,
            "letter": letter["letter"] if letter else None,
            "email_message": letter["email_message"] if letter else None,
            "letter_by": letter["generated_by"] if letter else None,
        },
    )
    db.add(variant)
    db.commit()
    return variant


async def prepare(db: Session, user: User, offer_id: int, resume_id: int | None) -> dict:
    offer = db.get(Offer, offer_id)
    if offer is None:
        raise ApplyError("Offre introuvable.", 404)
    base = base_resume(db, user, resume_id)
    variant = await get_or_create_variant(db, user, offer, base)
    adaptation = variant.adaptation or {}
    if not adaptation.get("letter"):
        letter = await write_letter(ResumeData.model_validate(variant.data), offer, user.profile_type)
        adaptation = {**adaptation, "letter": letter["letter"], "email_message": letter["email_message"]}
        variant.adaptation = adaptation
        db.commit()
    name = ResumeData.model_validate(variant.data).contact.full_name or user.display_name
    app = existing_application(db, user, offer)
    already = app is not None and app.status != "a_postuler"
    return {
        "offer_id": offer.id,
        "method": "email" if offer.apply_email else "site",
        "to": offer.apply_email,
        "site_url": offer.apply_url or offer.url,
        "resume_id": variant.id,
        "resume_name": variant.name,
        "score_before": adaptation.get("score_before"),
        "score_after": adaptation.get("score_after"),
        "points": adaptation.get("points", []),
        "subject": f"Candidature – {offer.title}",
        "body": adaptation.get("email_message") or "",
        "letter": adaptation.get("letter") or "",
        "attachments": [f"CV - {_safe_filename(name)}.pdf", f"Lettre de motivation - {_safe_filename(name)}.pdf"],
        "answers": standard_answers(ResumeData.model_validate(variant.data), offer, user.profile_type),
        "mail": mail_status(user),
        "already_applied": already,
        "already_applied_at": app.applied_at if already else None,
    }


def preview(
    db: Session, user: User, *, offer_id: int, resume_id: int, subject: str, body: str, letter: str, attach_letter: bool
) -> dict:
    offer, resume = _load(db, user, offer_id, resume_id)
    name = ResumeData.model_validate(resume.data).contact.full_name or user.display_name
    attachments = [f"CV - {_safe_filename(name)}.pdf"]
    if attach_letter and letter.strip():
        attachments.append(f"Lettre de motivation - {_safe_filename(name)}.pdf")
    return {
        "from": mail_status(user)["sender"],
        "to": offer.apply_email,
        "subject": subject,
        "body": body,
        "attachments": attachments,
        "fingerprint": fingerprint(
            to=offer.apply_email, subject=subject, body=body, letter=letter, attach_letter=attach_letter, resume=resume
        ),
        "mail": mail_status(user),
    }


def _load(db: Session, user: User, offer_id: int, resume_id: int) -> tuple[Offer, Resume]:
    offer = db.get(Offer, offer_id)
    resume = db.get(Resume, resume_id)
    if offer is None:
        raise ApplyError("Offre introuvable.", 404)
    if resume is None or resume.user_id != user.id:
        raise ApplyError("CV introuvable.", 404)
    return offer, resume


def _record(
    db: Session, user: User, offer: Offer, resume: Resume | None, letter: str, kind: str, message: str, details: dict
) -> Application:
    app = existing_application(db, user, offer)
    now = utcnow()
    if app is None:
        app = Application(user_id=user.id, offer_id=offer.id, title=offer.title, company=offer.company)
        db.add(app)
    app.status = "postule"
    app.applied_at = now
    app.follow_up_at = now + timedelta(days=7)
    app.resume_id = resume.id if resume else app.resume_id
    app.cover_letter = letter or app.cover_letter
    db.flush()
    db.add(ApplicationEvent(application_id=app.id, kind=kind, message=message, details=details))
    db.commit()
    db.refresh(app)
    return app


def _check_duplicate(db: Session, user: User, offer: Offer, allow_duplicate: bool, fp: str | None = None) -> None:
    app = existing_application(db, user, offer)
    if app is None:
        return
    if fp and any(ev.details.get("fingerprint") == fp for ev in app.events):
        raise ApplyError("Ce même e-mail a déjà été envoyé pour cette offre.", 409)
    if app.status != "a_postuler" and not allow_duplicate:
        when = app.applied_at.strftime("%d/%m/%Y") if app.applied_at else "déjà"
        raise ApplyError(f"Vous avez déjà postulé à cette offre ({when}).", 409)


def _send_smtp(sender: str, password: str, msg: EmailMessage) -> None:
    s = get_settings()
    context = ssl.create_default_context()
    if s.smtp_port == 465:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=context, timeout=30) as smtp:
            smtp.login(sender, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
            smtp.starttls(context=context)
            smtp.login(sender, password)
            smtp.send_message(msg)


async def send(db: Session, user: User, payload) -> Application:
    if not payload.confirm:
        raise ApplyError("L'envoi doit être confirmé.", 400)
    offer, resume = _load(db, user, payload.offer_id, payload.resume_id)
    if not offer.apply_email:
        raise ApplyError("Cette offre n'a pas d'adresse e-mail de candidature.", 400)
    expected = fingerprint(
        to=offer.apply_email,
        subject=payload.subject,
        body=payload.body,
        letter=payload.letter,
        attach_letter=payload.attach_letter,
        resume=resume,
    )
    if expected != payload.fingerprint:
        raise ApplyError("Le contenu a changé depuis l'aperçu : vérifiez à nouveau avant d'envoyer.", 409)
    _check_duplicate(db, user, offer, payload.allow_duplicate, expected)

    status = mail_status(user)
    if not status["ready"]:
        raise ApplyError(status["label"], 400)
    data = ResumeData.model_validate(resume.data)
    name = data.contact.full_name or user.display_name
    msg = EmailMessage()
    msg["From"] = formataddr((name, user.email))
    msg["To"] = offer.apply_email
    msg["Subject"] = payload.subject
    msg["Message-ID"] = make_msgid(domain="formywork.local")
    msg.set_content(payload.body)
    msg.add_attachment(to_pdf(data), maintype="application", subtype="pdf", filename=f"CV - {_safe_filename(name)}.pdf")
    if payload.attach_letter and payload.letter.strip():
        msg.add_attachment(
            letter_to_pdf(payload.letter, name),
            maintype="application",
            subtype="pdf",
            filename=f"Lettre de motivation - {_safe_filename(name)}.pdf",
        )

    details = {"fingerprint": expected, "to": offer.apply_email, "subject": payload.subject}
    if status["mode"] == "smtp":
        try:
            await asyncio.to_thread(_send_smtp, user.email, get_settings().smtp_password_for(user.email) or "", msg)
        except smtplib.SMTPAuthenticationError as exc:
            raise ApplyError(
                "La boîte e-mail a refusé la connexion : vérifiez le mot de passe d'application.", 502
            ) from exc
        except (smtplib.SMTPException, OSError) as exc:
            raise ApplyError(
                f"L'e-mail n'a pas pu partir : {exc.__class__.__name__}. Rien n'a été envoyé.", 502
            ) from exc
        return _record(
            db, user, offer, resume, payload.letter, "email_sent", f"E-mail envoyé à {offer.apply_email}", details
        )
    return _record(
        db,
        user,
        offer,
        resume,
        payload.letter,
        "email_simulated",
        f"Mode démo : envoi simulé à {offer.apply_email} (aucun e-mail réel)",
        details,
    )


def mark_applied(db: Session, user: User, payload) -> Application:
    offer = db.get(Offer, payload.offer_id)
    if offer is None:
        raise ApplyError("Offre introuvable.", 404)
    resume = None
    if payload.resume_id:
        resume = db.get(Resume, payload.resume_id)
        if resume is None or resume.user_id != user.id:
            raise ApplyError("CV introuvable.", 404)
    _check_duplicate(db, user, offer, payload.allow_duplicate)
    return _record(
        db,
        user,
        offer,
        resume,
        payload.letter,
        "site_applied",
        "Candidature faite sur le site de l'offre (confirmée par vous)",
        {"url": offer.apply_url or offer.url},
    )
