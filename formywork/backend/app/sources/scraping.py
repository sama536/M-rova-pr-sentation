"""Lecture de pages publiques d'offres (désactivée par défaut : SCRAPING_ENABLED=false).

Règles appliquées, sans exception :
- aucun login, aucun compte, aucun contournement (pas de proxy, pas de faux navigateur, pas de captcha) ;
- respect du robots.txt : si la page est interdite, la source s'arrête et l'interface le dit ;
- User-Agent honnête, 2 à 4 s entre deux requêtes, quelques pages maximum, cache local ;
- au premier 403/429/captcha, la source est mise en pause 24 h.
LinkedIn et Indeed ne sont pas lus (conditions d'utilisation interdisant l'extraction automatique).
On lit uniquement les données structurées schema.org « JobPosting » publiées par le site.
"""

from __future__ import annotations

import asyncio
import json
import random
from datetime import timedelta
from urllib.parse import urlencode, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from ..config import get_settings
from ..db import SessionLocal, utcnow
from ..models import HttpCache
from .base import (
    NormalizedOffer,
    SearchParams,
    SourceBlocked,
    SourceError,
    clean_text,
    detect_contract,
    detect_remote,
    parse_datetime,
)

CACHE_TTL = timedelta(hours=6)
_robots_cache: dict[str, RobotFileParser] = {}


async def polite_get(client: httpx.AsyncClient, url: str, *, delay: bool = True) -> str:
    s = get_settings()
    with SessionLocal() as db:
        cached = db.get(HttpCache, url)
        if cached and utcnow() - cached.fetched_at < CACHE_TTL:
            return cached.body
    if delay:
        await asyncio.sleep(random.uniform(s.scraping_min_delay_s, s.scraping_max_delay_s))
    resp = await client.get(url, headers={"User-Agent": s.scraping_user_agent, "Accept-Language": "fr-FR"})
    if resp.status_code in (403, 429, 503):
        raise SourceBlocked(f"Le site a refusé l'accès (code {resp.status_code}). Source mise en pause.")
    if resp.status_code != 200:
        raise SourceError(f"Page indisponible (code {resp.status_code}).")
    body = resp.text
    lowered = body[:20000].lower()
    if "captcha" in lowered or "cf-challenge" in lowered or "are you a robot" in lowered:
        raise SourceBlocked("Le site demande une vérification anti-robot : arrêt, aucune tentative de contournement.")
    with SessionLocal() as db:
        db.merge(HttpCache(url=url, body=body, fetched_at=utcnow()))
        db.commit()
    return body


async def robots_allows(client: httpx.AsyncClient, url: str) -> bool:
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    parser = _robots_cache.get(base)
    if parser is None:
        parser = RobotFileParser()
        try:
            resp = await client.get(f"{base}/robots.txt", headers={"User-Agent": get_settings().scraping_user_agent})
        except httpx.HTTPError as exc:
            raise SourceError("Impossible de lire le robots.txt du site.") from exc
        if resp.status_code >= 400:
            parser.parse([])  # pas de robots.txt : tout est autorisé
        else:
            parser.parse(resp.text.splitlines())
        _robots_cache[base] = parser
    return parser.can_fetch(get_settings().scraping_user_agent, url)


def extract_job_postings(html_text: str, source: str) -> list[NormalizedOffer]:
    soup = BeautifulSoup(html_text, "html.parser")
    offers: list[NormalizedOffer] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for item in _iter_postings(data):
            offers.append(_normalize_posting(item, source))
    return offers


def _iter_postings(data):
    if isinstance(data, list):
        for d in data:
            yield from _iter_postings(d)
    elif isinstance(data, dict):
        kind = data.get("@type")
        if kind == "JobPosting" or (isinstance(kind, list) and "JobPosting" in kind):
            yield data
        for key in ("@graph", "itemListElement", "item"):
            if key in data:
                yield from _iter_postings(data[key])


def _normalize_posting(item: dict, source: str) -> NormalizedOffer:
    org = item.get("hiringOrganization") or {}
    loc = item.get("jobLocation") or {}
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    address = loc.get("address") or {} if isinstance(loc, dict) else {}
    title = clean_text(item.get("title")) or "Offre sans titre"
    description = clean_text(item.get("description"))
    employment = item.get("employmentType")
    employment = " ".join(employment) if isinstance(employment, list) else (employment or "")
    contract, is_alt = detect_contract(employment, title, description)
    url = item.get("url") or ""
    return NormalizedOffer(
        source=source,
        external_id=str(
            item.get("identifier", {}).get("value") if isinstance(item.get("identifier"), dict) else url or title
        ),
        title=title,
        description=description,
        company=org.get("name") if isinstance(org, dict) else None,
        location=address.get("addressLocality") if isinstance(address, dict) else None,
        postal_code=address.get("postalCode") if isinstance(address, dict) else None,
        contract_type=contract,
        is_alternance=is_alt,
        remote="total" if item.get("jobLocationType") == "TELECOMMUTE" else detect_remote(description),
        url=url or None,
        published_at=parse_datetime(item.get("datePosted")),
    )


class HelloworkSource:
    name = "hellowork"
    label = "Hellowork (pages publiques)"
    kind = "scraping"
    base_url = "https://www.hellowork.com/fr-fr/emploi/recherche.html"

    def is_configured(self) -> bool:
        return get_settings().scraping_enabled

    def search_url(self, params: SearchParams, page: int) -> str:
        q = {"k": params.query or "", "l": params.location or "", "p": str(page)}
        if params.contract == "alternance":
            q["c"] = "Alternance"
        return f"{self.base_url}?{urlencode(q)}"

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        first = self.search_url(params, 1)
        if not await robots_allows(client, first):
            raise SourceError(
                "Le robots.txt de Hellowork interdit la lecture de ses pages de recherche : source ignorée."
            )
        offers: list[NormalizedOffer] = []
        for page in range(1, get_settings().scraping_max_pages + 1):
            html_text = await polite_get(client, self.search_url(params, page), delay=page > 1)
            found = extract_job_postings(html_text, self.name)
            if not found:
                break
            offers.extend(found)
        return offers
