from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.adapt import write_letter
from ..apply.service import create_variant
from ..ats.analyzer import analyze
from ..ats.export import letter_to_pdf, to_docx, to_pdf
from ..ats.parser import ALLOWED_EXT, ImportErrorFr, extract_text, parse_resume_text
from ..ats.schema import ResumeData
from ..auth import current_user
from ..config import get_settings
from ..db import get_db
from ..models import Offer, Resume, User
from ..schemas import AdaptIn, AnalyzeIn, ResumeIn

router = APIRouter(prefix="/api/resumes", tags=["cv"])


def _owned(db: Session, resume_id: int, user: User) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.user_id != user.id:
        raise HTTPException(404, "CV introuvable.")
    return resume


def _out(db: Session, r: Resume, user: User) -> dict:
    data = ResumeData.model_validate(r.data)
    offer = db.get(Offer, r.offer_id) if r.offer_id else None
    report = analyze(data, f"{offer.title}\n{offer.description}" if offer else None, user.profile_type)
    return {
        "id": r.id,
        "name": r.name,
        "data": data.model_dump(),
        "is_base": r.is_base,
        "parent_id": r.parent_id,
        "offer_id": r.offer_id,
        "offer_title": offer.title if offer else None,
        "adaptation": r.adaptation,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        "score": report.score,
    }


@router.get("")
def list_resumes(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.is_base.desc(), Resume.updated_at.desc())
    )
    return [_out(db, r, user) for r in rows]


@router.post("")
def create_resume(payload: ResumeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    r = Resume(user_id=user.id, name=payload.name.strip(), data=payload.data.model_dump(), is_base=True)
    db.add(r)
    db.commit()
    return _out(db, r, user)


@router.post("/import")
async def import_resume(
    file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    filename = Path(file.filename or "cv").name
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        raise HTTPException(400, "Format non pris en charge : envoyez un PDF, un Word (.docx) ou un fichier texte.")
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(413, f"Fichier trop lourd (maximum {get_settings().max_upload_mb} Mo).")
    if not content:
        raise HTTPException(400, "Le fichier est vide.")
    try:
        text, flags = extract_text(filename, content)
    except ImportErrorFr as exc:
        raise HTTPException(400, str(exc)) from exc
    data = parse_resume_text(text)
    data.import_flags = flags
    r = Resume(
        user_id=user.id,
        name=f"Mon CV ({filename[:60]})",
        data=data.model_dump(),
        is_base=True,
        source_filename=filename,
    )
    db.add(r)
    db.commit()
    return _out(db, r, user)


@router.post("/analyze")
def analyze_resume(payload: AnalyzeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    offer_text = None
    if payload.offer_id:
        offer = db.get(Offer, payload.offer_id)
        if offer is None:
            raise HTTPException(404, "Offre introuvable.")
        offer_text = f"{offer.title}\n{offer.description}"
    return analyze(payload.data, offer_text, user.profile_type).as_dict()


@router.get("/{resume_id}")
def get_resume(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return _out(db, _owned(db, resume_id, user), user)


@router.put("/{resume_id}")
def update_resume(
    resume_id: int, payload: ResumeIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    r = _owned(db, resume_id, user)
    r.name = payload.name.strip()
    r.data = payload.data.model_dump()
    db.commit()
    return _out(db, r, user)


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.delete(_owned(db, resume_id, user))
    db.commit()
    return {"ok": True}


@router.post("/{resume_id}/adapt")
async def adapt(
    resume_id: int, payload: AdaptIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    base = _owned(db, resume_id, user)
    if not base.is_base and base.parent_id:
        base = _owned(db, base.parent_id, user)
    offer = db.get(Offer, payload.offer_id)
    if offer is None:
        raise HTTPException(404, "Offre introuvable.")
    variant = await create_variant(db, user, offer, base, with_letter=payload.with_letter)
    return _out(db, variant, user)


@router.post("/{resume_id}/letter")
async def regenerate_letter(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    r = _owned(db, resume_id, user)
    if not r.offer_id:
        raise HTTPException(400, "La lettre se prépare à partir d'un CV adapté à une offre.")
    offer = db.get(Offer, r.offer_id)
    letter = await write_letter(ResumeData.model_validate(r.data), offer, user.profile_type)
    r.adaptation = {
        **(r.adaptation or {}),
        "letter": letter["letter"],
        "email_message": letter["email_message"],
        "letter_by": letter["generated_by"],
    }
    db.commit()
    return _out(db, r, user)


def _filename(r: Resume, ext: str) -> str:
    name = ResumeData.model_validate(r.data).contact.full_name or "CV"
    safe = "".join(c for c in name if c.isalnum() or c in " -_").strip() or "CV"
    return f"CV - {safe}.{ext}"


@router.get("/{resume_id}/export.pdf")
def export_pdf(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    r = _owned(db, resume_id, user)
    return Response(
        to_pdf(ResumeData.model_validate(r.data)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_filename(r, "pdf")}"'},
    )


@router.get("/{resume_id}/export.docx")
def export_docx(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    r = _owned(db, resume_id, user)
    return Response(
        to_docx(ResumeData.model_validate(r.data)),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_filename(r, "docx")}"'},
    )


@router.get("/{resume_id}/letter.pdf")
def export_letter(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    r = _owned(db, resume_id, user)
    letter = (r.adaptation or {}).get("letter")
    if not letter:
        raise HTTPException(404, "Aucune lettre pour ce CV.")
    name = ResumeData.model_validate(r.data).contact.full_name or user.display_name
    return Response(
        letter_to_pdf(letter, name),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Lettre de motivation.pdf"'},
    )
