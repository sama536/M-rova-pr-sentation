"""La Bonne Alternance via l'API Apprentissage (https://api.apprentissage.beta.gouv.fr).

GET /api/job/v1/search avec en-tête « Authorization: Bearer <jeton> ». Recherche par latitude/longitude
et rayon (0 à 200 km). Champs vérifiés dans le code source officiel (mission-apprentissage/api-apprentissage).
"""

from __future__ import annotations

import httpx

from ..config import get_settings
from .base import NormalizedOffer, SearchParams, SourceBlocked, SourceError, clean_text, parse_datetime, simplify

SEARCH_URL = "https://api.apprentissage.beta.gouv.fr/api/job/v1/search"


class LaBonneAlternanceSource:
    name = "la_bonne_alternance"
    label = "La Bonne Alternance"
    kind = "api"

    def is_configured(self) -> bool:
        return bool(get_settings().lba_api_token)

    def build_query(self, params: SearchParams) -> dict[str, str]:
        q: dict[str, str] = {}
        if params.latitude is not None and params.longitude is not None:
            q["latitude"] = str(params.latitude)
            q["longitude"] = str(params.longitude)
            q["radius"] = str(max(0, min(params.radius_km, 200)))
        return q

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> list[NormalizedOffer]:
        # Offres d'alternance uniquement : inutile d'appeler si on cherche autre chose.
        if params.contract and params.contract != "alternance":
            return []
        if params.latitude is None:
            raise SourceError("La Bonne Alternance a besoin d'une ville pour chercher.")
        resp = await client.get(
            SEARCH_URL,
            params=self.build_query(params),
            headers={"Authorization": f"Bearer {get_settings().lba_api_token}"},
        )
        if resp.status_code in (401, 403):
            raise SourceError("Jeton La Bonne Alternance refusé : vérifiez LBA_API_TOKEN.")
        if resp.status_code == 429:
            raise SourceBlocked("Limite de 60 requêtes/minute atteinte sur La Bonne Alternance.")
        if resp.status_code != 200:
            raise SourceError(f"La Bonne Alternance a répondu avec le code {resp.status_code}.")
        offers = [self.normalize(job) for job in resp.json().get("jobs", [])]
        # L'API ne filtre pas par mots-clés : on filtre ici sur le titre et la description.
        if params.query:
            words = simplify(params.query).split()
            offers = [o for o in offers if all(w in simplify(f"{o.title} {o.description}") for w in words)]
        return offers

    @staticmethod
    def normalize(job: dict) -> NormalizedOffer:
        ident = job.get("identifier") or {}
        workplace = job.get("workplace") or {}
        offer = job.get("offer") or {}
        contract = job.get("contract") or {}
        apply = job.get("apply") or {}
        location = workplace.get("location") or {}
        coords = (location.get("geopoint") or {}).get("coordinates") or [None, None]
        publication = offer.get("publication") or {}
        parts = [clean_text(offer.get("description"))]
        for label, key in (
            ("Compétences attendues", "desired_skills"),
            ("Compétences à acquérir", "to_be_acquired_skills"),
        ):
            values = offer.get(key) or []
            if values:
                parts.append(f"{label} :\n" + "\n".join(f"• {v}" for v in values))
        remote_raw = (contract.get("remote") or "").lower()
        remote = {"onsite": "non", "hybrid": "partiel", "remote": "total"}.get(remote_raw, "inconnu")
        return NormalizedOffer(
            source="la_bonne_alternance",
            external_id=str(ident.get("id") or ident.get("partner_job_id")),
            title=(offer.get("title") or "Offre d'alternance").strip(),
            description="\n\n".join(p for p in parts if p),
            company=workplace.get("brand") or workplace.get("name") or workplace.get("legal_name"),
            location=location.get("address"),
            latitude=coords[1] if len(coords) > 1 else None,
            longitude=coords[0] if coords else None,
            contract_type="alternance",
            is_alternance=True,
            remote=remote,
            url=apply.get("url"),
            apply_url=apply.get("url"),
            published_at=parse_datetime(publication.get("creation")),
        )
