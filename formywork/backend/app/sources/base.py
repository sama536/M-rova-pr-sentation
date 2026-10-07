"""Interface commune à toutes les sources d'offres et normalisation."""

from __future__ import annotations

import hashlib
import html
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

import httpx


@dataclass
class SearchParams:
    query: str = ""
    location: str = ""
    radius_km: int = 20
    contract: str = ""  # "", cdi, cdd, alternance, stage, interim, freelance
    max_days: int = 0  # 0 = peu importe
    remote: str = ""  # "", partiel, total
    # Rempli par l'agrégateur à partir de geo.api.gouv.fr
    insee_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    postal_code: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> SearchParams:
        known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**known)

    def public_dict(self) -> dict:
        return {
            "query": self.query,
            "location": self.location,
            "radius_km": self.radius_km,
            "contract": self.contract,
            "max_days": self.max_days,
            "remote": self.remote,
        }


@dataclass
class NormalizedOffer:
    source: str
    external_id: str
    title: str
    description: str = ""
    company: str | None = None
    location: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    contract_type: str = "autre"
    is_alternance: bool = False
    remote: str = "inconnu"
    salary: str | None = None
    url: str | None = None
    apply_email: str | None = None
    apply_url: str | None = None
    published_at: datetime | None = None
    extra: dict = field(default_factory=dict)

    @property
    def dedup_key(self) -> str:
        return make_dedup_key(self.title, self.company, self.location)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(f"{self.title}\n{self.description}".encode()).hexdigest()


class SourceError(Exception):
    """Erreur contrôlée d'une source (message lisible par l'utilisateur)."""


class SourceBlocked(SourceError):
    """La source refuse nos requêtes (403, 429, captcha…) : on s'arrête proprement."""


class Source(Protocol):
    name: str
    label: str
    kind: str  # "api", "scraping" ou "demo"

    def is_configured(self) -> bool: ...

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]: ...


# ---------------------------------------------------------------- normalisation

_TAG_RE = re.compile(r"<[^>]+>")
_SPACES_RE = re.compile(r"[ \t ]+")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_COMPANY_NOISE = re.compile(r"\b(sas|sasu|sarl|sa|eurl|sci|groupe|group|france)\b")
_TITLE_NOISE = re.compile(r"\(?\b[hf]\s*/\s*[hf]\b\)?|\(?\bf\s*/\s*h\b\)?|\bh/f\b|\bf/h\b|\(.*?\)")


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def simplify(text: str | None) -> str:
    if not text:
        return ""
    text = strip_accents(text.lower())
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def clean_text(raw: str | None) -> str:
    """Retire le HTML et normalise les espaces tout en gardant les retours à la ligne."""
    if not raw:
        return ""
    text = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</div>", "\n", raw)
    text = re.sub(r"(?i)<li[^>]*>", "• ", text)
    text = _TAG_RE.sub("", text)
    text = html.unescape(text)
    lines = [_SPACES_RE.sub(" ", line).strip() for line in text.splitlines()]
    out: list[str] = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip()


def make_dedup_key(title: str, company: str | None, location: str | None) -> str:
    t = simplify(_TITLE_NOISE.sub(" ", title.lower()))
    c = _COMPANY_NOISE.sub(" ", simplify(company))
    c = " ".join(c.split())
    return f"{t}|{c}|{normalize_city(location)}"


def normalize_city(location: str | None) -> str:
    """« 69 - LYON 03 », « Lyon, Rhône », « Lyon 3e (69) » → « lyon »."""
    loc = re.sub(r"^\s*\d{2,3}\s*-\s*", "", location or "")
    loc = re.split(r"[,(]", loc)[0]
    words = [w for w in simplify(loc).split() if not re.fullmatch(r"\d+(e|er|eme)?|cedex", w)]
    return " ".join(words)


def detect_contract(*texts: str | None) -> tuple[str, bool]:
    """Devine le type de contrat à partir de libellés libres. Renvoie (type, est_alternance)."""
    blob = simplify(" ".join(t for t in texts if t))
    if any(k in blob for k in ("alternance", "apprentissage", "apprenti", "professionnalisation", "contrat pro")):
        return "alternance", True
    if "stage" in blob.split() or "stagiaire" in blob:
        return "stage", False
    if "interim" in blob or "mission temporaire" in blob:
        return "interim", False
    if "cdi" in blob.split() or "duree indeterminee" in blob or "permanent" in blob:
        return "cdi", False
    if "cdd" in blob.split() or "duree determinee" in blob:
        return "cdd", False
    if "freelance" in blob or "independant" in blob:
        return "freelance", False
    return "autre", False


def detect_remote(*texts: str | None) -> str:
    blob = simplify(" ".join(t for t in texts if t))
    if any(k in blob for k in ("full remote", "100 teletravail", "teletravail complet", "teletravail total")):
        return "total"
    if any(k in blob for k in ("teletravail", "remote", "hybride")):
        if any(k in blob for k in ("pas de teletravail", "teletravail non", "sans teletravail")):
            return "non"
        return "partiel"
    return "inconnu"


def find_email(text: str | None) -> str | None:
    if not text:
        return None
    for match in _EMAIL_RE.findall(text):
        lower = match.lower()
        if not lower.endswith((".png", ".jpg", ".gif")) and "noreply" not in lower and "no-reply" not in lower:
            return match
    return None


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo is None else dt.astimezone().replace(tzinfo=None)


def merge_duplicates(offers: list[NormalizedOffer]) -> list[NormalizedOffer]:
    """Dédoublonne : même clé (titre+entreprise+ville) = même offre. Garde la plus complète."""
    by_key: dict[str, NormalizedOffer] = {}
    for offer in offers:
        key = offer.dedup_key
        current = by_key.get(key)
        if current is None:
            by_key[key] = offer
            continue
        best, other = (offer, current) if _richness(offer) > _richness(current) else (current, offer)
        best.extra.setdefault("also_on", [])
        if other.source != best.source and other.source not in best.extra["also_on"]:
            best.extra["also_on"].append(other.source)
        best.apply_email = best.apply_email or other.apply_email
        best.salary = best.salary or other.salary
        by_key[key] = best
    return list(by_key.values())


def _richness(o: NormalizedOffer) -> int:
    return len(o.description) + (200 if o.apply_email else 0) + (50 if o.salary else 0) + (30 if o.company else 0)
