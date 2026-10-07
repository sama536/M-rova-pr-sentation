"""Jooble – API REST (POST https://jooble.org/api/{clé}), documentation help.jooble.org."""

from __future__ import annotations

import hashlib

import httpx

from ..config import get_settings
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

API_URL = "https://jooble.org/api/"
_RADIUS = [0, 4, 8, 16, 26, 40, 80]


class JoobleSource:
    name = "jooble"
    label = "Jooble"
    kind = "api"

    def is_configured(self) -> bool:
        return bool(get_settings().jooble_api_key)

    def build_body(self, params: SearchParams) -> dict:
        keywords = params.query
        if params.contract == "alternance":
            keywords = f"{keywords} alternance".strip()
        body: dict = {"keywords": keywords, "location": params.location or "France", "page": 1}
        if params.location:
            body["radius"] = str(next((r for r in _RADIUS if r >= params.radius_km), 80))
        return body

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        resp = await client.post(API_URL + get_settings().jooble_api_key, json=self.build_body(params))
        if resp.status_code in (401, 403):
            raise SourceError("Clé Jooble refusée : vérifiez JOOBLE_API_KEY.")
        if resp.status_code == 429:
            raise SourceBlocked("Quota Jooble atteint.")
        if resp.status_code != 200:
            raise SourceError(f"Jooble a répondu avec le code {resp.status_code}.")
        return [self.normalize(item) for item in resp.json().get("jobs", [])]

    @staticmethod
    def normalize(item: dict) -> NormalizedOffer:
        title = clean_text(item.get("title")) or "Offre sans titre"
        description = clean_text(item.get("snippet"))
        contract, is_alt = detect_contract(item.get("type"), title, description)
        link = item.get("link")
        ext = str(item.get("id") or hashlib.sha1((link or title).encode()).hexdigest())
        return NormalizedOffer(
            source="jooble",
            external_id=ext,
            title=title,
            description=description,
            company=item.get("company") or None,
            location=item.get("location") or None,
            contract_type=contract,
            is_alternance=is_alt,
            remote=detect_remote(title, description),
            salary=item.get("salary") or None,
            url=link,
            published_at=parse_datetime(item.get("updated")),
        )
