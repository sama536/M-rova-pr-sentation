"""Adzuna – https://developer.adzuna.com/docs/search (pays « fr »)."""

from __future__ import annotations

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

SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/fr/search/1"


class AdzunaSource:
    name = "adzuna"
    label = "Adzuna"
    kind = "api"

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.adzuna_app_id and s.adzuna_app_key)

    def build_query(self, params: SearchParams) -> dict[str, str]:
        s = get_settings()
        what = params.query
        if params.contract == "alternance":
            what = f"{what} alternance".strip()
        q = {
            "app_id": s.adzuna_app_id,
            "app_key": s.adzuna_app_key,
            "results_per_page": "50",
            "sort_by": "date",
            "content-type": "application/json",
        }
        if what:
            q["what"] = what
        if params.location:
            q["where"] = params.location
            q["distance"] = str(params.radius_km)
        if params.max_days:
            q["max_days_old"] = str(params.max_days)
        if params.contract == "cdi":
            q["permanent"] = "1"
        elif params.contract in ("cdd", "interim"):
            q["contract"] = "1"
        return q

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        resp = await client.get(SEARCH_URL, params=self.build_query(params))
        if resp.status_code in (401, 403):
            raise SourceError("Clés Adzuna refusées : vérifiez ADZUNA_APP_ID et ADZUNA_APP_KEY.")
        if resp.status_code == 429:
            raise SourceBlocked("Quota Adzuna atteint, nouvel essai plus tard.")
        if resp.status_code != 200:
            raise SourceError(f"Adzuna a répondu avec le code {resp.status_code}.")
        return [self.normalize(item) for item in resp.json().get("results", [])]

    @staticmethod
    def normalize(item: dict) -> NormalizedOffer:
        title = clean_text(item.get("title")) or "Offre sans titre"
        description = clean_text(item.get("description"))
        contract, is_alt = detect_contract(title, description)
        if contract == "autre":
            contract = {"permanent": "cdi", "contract": "cdd"}.get(item.get("contract_type") or "", "autre")
        smin, smax = item.get("salary_min"), item.get("salary_max")
        salary = None
        if smin and smax and smin != smax:
            salary = f"{int(smin):,} € à {int(smax):,} € par an (estimation Adzuna)".replace(",", " ")
        elif smin:
            salary = f"{int(smin):,} € par an (estimation Adzuna)".replace(",", " ")
        return NormalizedOffer(
            source="adzuna",
            external_id=str(item.get("id")),
            title=title,
            description=description,
            company=(item.get("company") or {}).get("display_name"),
            location=(item.get("location") or {}).get("display_name"),
            latitude=item.get("latitude"),
            longitude=item.get("longitude"),
            contract_type=contract,
            is_alternance=is_alt,
            remote=detect_remote(title, description),
            salary=salary,
            url=item.get("redirect_url"),
            published_at=parse_datetime(item.get("created")),
        )
