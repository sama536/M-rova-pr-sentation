import json

from app.sources.adzuna import AdzunaSource
from app.sources.base import (
    NormalizedOffer,
    clean_text,
    detect_contract,
    detect_remote,
    find_email,
    make_dedup_key,
    merge_duplicates,
)
from app.sources.france_travail import FranceTravailSource
from app.sources.jooble import JoobleSource
from app.sources.labonnealternance import LaBonneAlternanceSource
from app.sources.scraping import extract_job_postings

from .conftest import load


def test_clean_text_removes_html_and_keeps_lines():
    assert (
        clean_text("<p>Bonjour&nbsp;<b>vous</b></p><ul><li>Un</li><li>Deux</li></ul>") == "Bonjour vous\n• Un\n• Deux"
    )


def test_detect_contract():
    assert detect_contract("Contrat d'apprentissage") == ("alternance", True)
    assert detect_contract("Poste en CDI") == ("cdi", False)
    assert detect_contract("CDD de 6 mois") == ("cdd", False)
    assert detect_contract("Mission d'intérim") == ("interim", False)
    assert detect_contract("Poste intéressant") == ("autre", False)


def test_detect_remote():
    assert detect_remote("Télétravail 2 jours par semaine") == "partiel"
    assert detect_remote("Poste en full remote") == "total"
    assert detect_remote("Sur site uniquement") == "inconnu"


def test_find_email_ignores_noreply():
    assert find_email("Écrire à noreply@x.fr ou rh@entreprise.fr") == "rh@entreprise.fr"


def test_dedup_key_ignores_gender_marks_and_company_suffix():
    a = make_dedup_key("Assistant administratif H/F", "ACME SAS", "69 - LYON 03")
    b = make_dedup_key("Assistant administratif (F/H)", "Acme", "Lyon")
    assert a == b


def test_merge_duplicates_keeps_richest_and_notes_other_source():
    short = NormalizedOffer(
        source="jooble",
        external_id="1",
        title="Assistant administratif H/F",
        company="ACME",
        location="Lyon",
        description="court",
    )
    long = NormalizedOffer(
        source="france_travail",
        external_id="2",
        title="Assistant administratif (F/H)",
        company="ACME SAS",
        location="69 - LYON 03",
        description="x" * 300,
        apply_email="a@b.fr",
    )
    merged = merge_duplicates([short, long])
    assert len(merged) == 1
    assert merged[0].source == "france_travail"
    assert merged[0].extra["also_on"] == ["jooble"]


def test_france_travail_normalize():
    items = json.loads(load("france_travail_search.json"))["resultats"]
    first, second = (FranceTravailSource.normalize(i) for i in items)
    assert first.title == "Assistant administratif H/F"
    assert first.contract_type == "cdi"
    assert first.apply_email == "rh@acme.example.org"
    assert first.remote == "partiel"
    assert "\n" in first.description
    assert second.is_alternance and second.contract_type == "alternance"


def test_adzuna_normalize():
    items = json.loads(load("adzuna_search.json"))["results"]
    offer = AdzunaSource.normalize(items[0])
    assert offer.title == "Assistant administratif (H/F)"
    assert offer.contract_type == "cdi"
    assert "24 000" in offer.salary


def test_jooble_normalize():
    item = json.loads(load("jooble_search.json"))["jobs"][0]
    offer = JoobleSource.normalize(item)
    assert offer.contract_type == "cdd"
    assert offer.company == "Mairie de Lyon"
    assert "<b>" not in offer.description


def test_lba_normalize():
    jobs = json.loads(load("lba_search.json"))["jobs"]
    offer = LaBonneAlternanceSource.normalize(jobs[0])
    assert offer.is_alternance
    assert offer.company == "Boulangerie Petit"
    assert offer.latitude == 45.75 and offer.longitude == 4.83
    assert "Sens du contact" in offer.description
    assert offer.remote == "non"


def test_json_ld_extraction():
    offers = extract_job_postings(load("hellowork_page.html"), "hellowork")
    assert len(offers) == 1
    assert offers[0].company == "Compta Plus"
    assert offers[0].contract_type == "cdi"
    assert offers[0].location == "Lyon"
