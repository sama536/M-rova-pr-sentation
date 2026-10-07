"""France Travail – API Offres d'emploi v2 (https://francetravail.io/data/api/offres-emploi).

Authentification OAuth2 « client credentials ». Paramètres utilisés : motsCles, commune (code INSEE),
distance (km), typeContrat, natureContrat, publieeDepuis, range. Réponse : 200 (complet) ou 206 (partiel).
Les codes et champs non confirmés sur la doc officielle sont signalés dans le README.
"""

from __future__ import annotations

import time

import httpx

from ..config import get_settings
from .base import NormalizedOffer, SearchParams, SourceBlocked, SourceError, clean_text, detect_remote, parse_datetime

TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token"
SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"
SCOPE = "api_offresdemploiv2 o2dsoffre"

_CONTRACT_MAP = {"cdi": "CDI", "cdd": "CDD", "interim": "MIS", "freelance": "LIB"}
_PUBLIEE_DEPUIS = [1, 3, 7, 14, 31]


class FranceTravailSource:
    name = "france_travail"
    label = "France Travail"
    kind = "api"

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expiry = 0.0

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.france_travail_client_id and s.france_travail_client_secret)

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        if self._token and time.monotonic() < self._token_expiry - 60:
            return self._token
        s = get_settings()
        resp = await client.post(
            TOKEN_URL,
            params={"realm": "/partenaire"},
            data={
                "grant_type": "client_credentials",
                "client_id": s.france_travail_client_id,
                "client_secret": s.france_travail_client_secret,
                "scope": SCOPE,
            },
        )
        if resp.status_code in (400, 401):
            raise SourceError("Identifiants France Travail refusés : vérifiez FRANCE_TRAVAIL_CLIENT_ID et SECRET.")
        resp.raise_for_status()
        payload = resp.json()
        self._token = payload["access_token"]
        self._token_expiry = time.monotonic() + float(payload.get("expires_in", 1499))
        return self._token

    def build_query(self, params: SearchParams) -> dict[str, str]:
        q: dict[str, str] = {"range": "0-99", "sort": "1"}
        if params.query:
            q["motsCles"] = params.query
        if params.insee_code:
            q["commune"] = params.insee_code
            q["distance"] = str(max(0, min(params.radius_km, 200)))
        if params.contract == "alternance":
            q["natureContrat"] = "E2,FS"  # apprentissage, professionnalisation
        elif params.contract in _CONTRACT_MAP:
            q["typeContrat"] = _CONTRACT_MAP[params.contract]
        if params.max_days:
            q["publieeDepuis"] = str(next((d for d in _PUBLIEE_DEPUIS if d >= params.max_days), 31))
        return q

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        token = await self._get_token(client)
        resp = await client.get(
            SEARCH_URL, params=self.build_query(params), headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 204:
            return []
        if resp.status_code in (403, 429):
            raise SourceBlocked(f"France Travail a refusé la requête (code {resp.status_code}). Quota atteint ?")
        if resp.status_code not in (200, 206):
            raise SourceError(f"France Travail a répondu avec le code {resp.status_code}.")
        return [self.normalize(item) for item in resp.json().get("resultats", [])]

    @staticmethod
    def normalize(item: dict) -> NormalizedOffer:
        lieu = item.get("lieuTravail") or {}
        contact = item.get("contact") or {}
        origine = item.get("origineOffre") or {}
        nature = (item.get("natureContrat") or "").lower()
        type_contrat = (item.get("typeContrat") or "").upper()
        is_alt = bool(item.get("alternance")) or "apprentissage" in nature or "professionnalisation" in nature
        contract = (
            "alternance"
            if is_alt
            else {"CDI": "cdi", "CDD": "cdd", "MIS": "interim", "LIB": "freelance"}.get(type_contrat, "autre")
        )
        description = clean_text(item.get("description"))
        offer_id = str(item.get("id"))
        return NormalizedOffer(
            source="france_travail",
            external_id=offer_id,
            title=(item.get("intitule") or "Offre sans titre").strip(),
            description=description,
            company=(item.get("entreprise") or {}).get("nom"),
            location=lieu.get("libelle"),
            postal_code=lieu.get("codePostal"),
            latitude=lieu.get("latitude"),
            longitude=lieu.get("longitude"),
            contract_type=contract,
            is_alternance=is_alt,
            remote=detect_remote(description),
            salary=(item.get("salaire") or {}).get("libelle"),
            url=origine.get("urlOrigine") or f"https://candidat.francetravail.fr/offres/recherche/detail/{offer_id}",
            apply_email=contact.get("courriel") if "@" in (contact.get("courriel") or "") else None,
            apply_url=contact.get("urlPostulation"),
            published_at=parse_datetime(item.get("dateCreation")),
        )
