"""Sources testées avec des réponses simulées (respx) : aucun appel réseau réel."""

import json

import httpx
import pytest
import respx

from app.db import SessionLocal
from app.models import Offer, SourceStatus
from app.sources import france_travail, scraping
from app.sources.base import SearchParams, SourceBlocked, SourceError
from app.sources.scraping import HelloworkSource

from .conftest import load

pytestmark = pytest.mark.asyncio

GEO = [
    {
        "code": "69123",
        "nom": "Lyon",
        "centre": {"type": "Point", "coordinates": [4.835, 45.758]},
        "codesPostaux": ["69001"],
    }
]


@pytest.fixture
def keys(settings_override):
    return settings_override(
        france_travail_client_id="id",
        france_travail_client_secret="secret",
        adzuna_app_id="a",
        adzuna_app_key="k",
        jooble_api_key="j",
        lba_api_token="t",
        demo_mode="false",
    )


@pytest.fixture(autouse=True)
def reset_state():
    france_travail_instance = next(
        s for s in __import__("app.sources", fromlist=["ALL_SOURCES"]).ALL_SOURCES if s.name == "france_travail"
    )
    france_travail_instance._token = None
    scraping._robots_cache.clear()
    from app.services import aggregator

    aggregator._geo_cache.clear()
    with SessionLocal() as db:
        db.query(SourceStatus).delete()
        db.commit()
    yield


def mock_all(router: respx.Router, *, adzuna_status=200):
    router.get("https://geo.api.gouv.fr/communes").mock(return_value=httpx.Response(200, json=GEO))
    router.post(france_travail.TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "tok", "expires_in": 1499})
    )
    router.get(france_travail.SEARCH_URL).mock(
        return_value=httpx.Response(206, json=json.loads(load("france_travail_search.json")))
    )
    router.get("https://api.adzuna.com/v1/api/jobs/fr/search/1").mock(
        return_value=httpx.Response(
            adzuna_status, json=json.loads(load("adzuna_search.json")) if adzuna_status == 200 else {}
        )
    )
    router.post("https://jooble.org/api/j").mock(
        return_value=httpx.Response(200, json=json.loads(load("jooble_search.json")))
    )
    router.get("https://api.apprentissage.beta.gouv.fr/api/job/v1/search").mock(
        return_value=httpx.Response(200, json=json.loads(load("lba_search.json")))
    )


async def test_france_travail_query_and_auth(keys):
    with respx.mock(assert_all_called=False) as router:
        mock_all(router)
        params = SearchParams(
            query="assistant", location="Lyon", radius_km=15, contract="alternance", max_days=5, insee_code="69123"
        )
        async with httpx.AsyncClient() as client:
            offers = await france_travail.FranceTravailSource().search(params, client)
        token_call = router.calls[0].request
        assert b"grant_type=client_credentials" in token_call.content
        assert b"scope=api_offresdemploiv2+o2dsoffre" in token_call.content
        search_call = router.calls[1].request
        assert search_call.headers["Authorization"] == "Bearer tok"
        q = dict(search_call.url.params)
        assert q["commune"] == "69123" and q["distance"] == "15" and q["natureContrat"] == "E2,FS"
        assert q["publieeDepuis"] == "7"
        assert len(offers) == 2


async def test_aggregate_all_sources_and_dedup(keys):
    from app.services.aggregator import aggregate

    with respx.mock(assert_all_called=False) as router:
        mock_all(router)
        with SessionLocal() as db:
            result = await aggregate(db, SearchParams(query="assistant", location="Lyon", contract=""))
            reports = {r.name: r for r in result.reports}
            assert all(reports[n].ok for n in ("france_travail", "adzuna", "jooble", "la_bonne_alternance"))
            assert result.location_found is True
            titles = [db.get(Offer, i).title for i in result.offer_ids]
            # « Assistant administratif » de France Travail et Adzuna (même entreprise, même ville) = une seule offre
            assert sum(1 for t in titles if t.lower().startswith("assistant administratif")) == 1


async def test_one_failing_source_does_not_break_others(keys):
    from app.services.aggregator import aggregate

    with respx.mock(assert_all_called=False) as router:
        mock_all(router, adzuna_status=500)
        with SessionLocal() as db:
            result = await aggregate(db, SearchParams(query="assistant", location="Lyon"))
            reports = {r.name: r for r in result.reports}
            assert reports["adzuna"].ok is False
            assert "500" in reports["adzuna"].error
            assert reports["france_travail"].ok and reports["jooble"].ok
            assert len(result.offer_ids) >= 3
            status = db.get(SourceStatus, "adzuna")
            assert status.last_error and status.last_success_at is None


async def test_rate_limited_source_is_paused(keys):
    from app.services.aggregator import aggregate

    with respx.mock(assert_all_called=False) as router:
        mock_all(router, adzuna_status=429)
        with SessionLocal() as db:
            await aggregate(db, SearchParams(query="assistant", location="Lyon"))
            assert db.get(SourceStatus, "adzuna").blocked_until is not None
            again = await aggregate(db, SearchParams(query="assistant", location="Lyon"))
            assert {r.name: r for r in again.reports}["adzuna"].skipped


async def test_scraping_respects_robots_txt(settings_override):
    settings_override(scraping_enabled="true")
    with respx.mock() as router:
        router.get("https://www.hellowork.com/robots.txt").mock(
            return_value=httpx.Response(200, text="User-agent: *\nDisallow: /fr-fr/emploi/recherche.html\n")
        )
        async with httpx.AsyncClient() as client:
            with pytest.raises(SourceError, match="robots.txt"):
                await HelloworkSource().search(SearchParams(query="comptable", location="Lyon"), client)


async def test_scraping_reads_json_ld_and_stops_on_captcha(settings_override):
    settings_override(scraping_enabled="true", scraping_max_pages="2")
    with respx.mock() as router:
        router.get("https://www.hellowork.com/robots.txt").mock(return_value=httpx.Response(404))
        page = router.get(url__startswith="https://www.hellowork.com/fr-fr/emploi/recherche.html")
        page.side_effect = [
            httpx.Response(200, text=load("hellowork_page.html")),
            httpx.Response(200, text="<html>Please solve this captcha</html>"),
        ]
        async with httpx.AsyncClient() as client:
            with pytest.raises(SourceBlocked):
                await HelloworkSource().search(SearchParams(query="comptable", location="Lyon"), client)
        assert page.call_count == 2
        sent_ua = page.calls[0].request.headers["User-Agent"]
        assert "FormyWorkBot" in sent_ua


async def test_scraping_disabled_by_default():
    assert HelloworkSource().is_configured() is False
