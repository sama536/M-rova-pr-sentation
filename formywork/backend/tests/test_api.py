"""Tests de l'API REST (mode démo, base temporaire)."""

import pytest

from .conftest import load

DEMO = {"email": "demo@formywork.fr", "password": "demo1234"}


@pytest.fixture
def demo_client(client):
    client.cookies.clear()
    r = client.post("/api/auth/login", json=DEMO)
    assert r.status_code == 200
    return client


def test_health_and_status(client):
    assert client.get("/api/health").json()["ok"] is True
    status = client.get("/api/auth/status").json()
    assert status["demo_mode"] is True and status["demo_login"]["email"] == DEMO["email"]


def test_requires_login(client):
    client.cookies.clear()
    r = client.get("/api/me")
    assert r.status_code == 401
    assert "connecter" in r.json()["detail"]


def test_register_limit_and_login(client):
    client.cookies.clear()
    for i in range(3):
        r = client.post(
            "/api/auth/register", json={"email": f"p{i}@ex.fr", "display_name": f"P{i}", "password": "motdepasse1"}
        )
        assert r.status_code == 200, r.text
    r = client.post("/api/auth/register", json={"email": "p9@ex.fr", "display_name": "P9", "password": "motdepasse1"})
    assert r.status_code == 403
    assert client.post("/api/auth/login", json={"email": "p0@ex.fr", "password": "mauvais"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "P0@ex.fr", "password": "motdepasse1"})
    assert r.status_code == 200 and r.json()["display_name"] == "P0"
    r = client.patch("/api/me", json={"profile_type": "alternant", "onboarded": True})
    assert r.json()["profile_type"] == "alternant"


def test_short_password_rejected_in_french(client):
    r = client.post("/api/auth/register", json={"email": "x@ex.fr", "display_name": "X", "password": "court"})
    assert r.status_code == 422
    assert "password" in r.json()["detail"]


def test_demo_search_filters_and_summaries(demo_client):
    r = demo_client.post("/api/search", json={"query": "", "location": "Lyon", "contract": "alternance"})
    data = r.json()
    assert r.status_code == 200
    assert data["offers"] and all(o["contract_type"] == "alternance" for o in data["offers"])
    assert all(o["summary"] and len(o["keywords"]) <= 3 for o in data["offers"])
    assert data["sources"][0]["ok"]
    r = demo_client.post("/api/search", json={"query": "", "location": "", "remote": "total"})
    assert all(o["remote"] == "total" for o in r.json()["offers"])


def test_offer_detail_favorite_hide(demo_client):
    offers = demo_client.post("/api/search", json={"query": "comptable"}).json()["offers"]
    oid = offers[0]["id"]
    detail = demo_client.get(f"/api/offers/{oid}").json()
    assert detail["description"]
    demo_client.patch(f"/api/offers/{oid}/state", json={"favorite": True})
    assert any(o["id"] == oid for o in demo_client.get("/api/offers?view=favorites").json())
    demo_client.patch(f"/api/offers/{oid}/state", json={"hidden": True})
    again = demo_client.post("/api/search", json={"query": "comptable"}).json()["offers"]
    assert all(o["id"] != oid for o in again)
    demo_client.patch(f"/api/offers/{oid}/state", json={"hidden": False})


def test_saved_search_lifecycle(demo_client):
    r = demo_client.post("/api/searches", json={"name": "Test", "params": {"query": "accueil", "location": ""}})
    sid = r.json()["id"]
    assert demo_client.get(f"/api/searches/{sid}/offers").json()
    assert demo_client.post(f"/api/searches/{sid}/refresh").status_code == 200
    assert demo_client.delete(f"/api/searches/{sid}").status_code == 200


def test_new_demo_offer_arrives_and_notifies(demo_client):
    import asyncio

    from app.services.events import broker
    from app.services.offers import run_saved_search
    from app.sources import demo_source

    searches = demo_client.get("/api/searches").json()
    alt = next(s for s in searches if s["params"]["contract"] == "alternance")
    queue = broker.subscribe(1)
    demo_source.release_next()  # « Gestionnaire de paie en alternance » à Lyon
    asyncio.run(run_saved_search(alt["id"], kinds={"demo"}, notify=True))
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    broker.unsubscribe(1, queue)
    assert any("new_offers" in e and "Gestionnaire de paie" in e for e in events)
    offers = demo_client.get(f"/api/searches/{alt['id']}/offers").json()
    assert any(o["title"].startswith("Gestionnaire de paie") and o["is_new"] for o in offers)


def test_resume_crud_import_analyze_export(demo_client):
    files = {"file": ("cv.txt", load("cv_exemple.txt").encode(), "text/plain")}
    r = demo_client.post("/api/resumes/import", files=files)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert r.json()["data"]["contact"]["full_name"] == "Camille Bernard"
    data = r.json()["data"]
    data["skills"].append("Paie")
    r = demo_client.put(f"/api/resumes/{rid}", json={"name": "CV Camille", "data": data})
    assert "Paie" in r.json()["data"]["skills"]
    report = demo_client.post("/api/resumes/analyze", json={"data": data}).json()
    assert 0 <= report["score"] <= 100 and report["checks"]
    pdf = demo_client.get(f"/api/resumes/{rid}/export.pdf")
    assert pdf.content.startswith(b"%PDF")
    docx = demo_client.get(f"/api/resumes/{rid}/export.docx")
    assert docx.content.startswith(b"PK")
    assert demo_client.delete(f"/api/resumes/{rid}").status_code == 200


def test_upload_limits(demo_client):
    big = b"a" * (5 * 1024 * 1024 + 10)
    assert demo_client.post("/api/resumes/import", files={"file": ("cv.txt", big)}).status_code == 413
    assert demo_client.post("/api/resumes/import", files={"file": ("cv.exe", b"MZ")}).status_code == 400
    r = demo_client.post("/api/resumes/import", files={"file": ("cv.pdf", b"pas un pdf")})
    assert r.status_code == 400 and "PDF" in r.json()["detail"]


def _offer_with_email(client):
    offers = client.post("/api/search", json={"query": "ressources humaines", "location": "Lyon"}).json()["offers"]
    return next(o for o in offers if o["apply_email"])


def test_apply_by_email_requires_confirmation_and_blocks_duplicates(demo_client):
    offer = _offer_with_email(demo_client)
    prep = demo_client.post("/api/apply/prepare", json={"offer_id": offer["id"]}).json()
    assert prep["method"] == "email" and prep["mail"]["mode"] == "simulation"
    assert prep["score_after"] >= prep["score_before"] - 5
    assert prep["letter"] and prep["body"]
    payload = {
        "offer_id": offer["id"],
        "resume_id": prep["resume_id"],
        "subject": prep["subject"],
        "body": prep["body"],
        "letter": prep["letter"],
        "attach_letter": True,
    }
    preview = demo_client.post("/api/apply/preview", json={**payload, "fingerprint": "x" * 64}).json()
    assert preview["to"] == offer["apply_email"] and len(preview["attachments"]) == 2
    # Sans confirmation : refus
    r = demo_client.post("/api/apply/send", json={**payload, "fingerprint": preview["fingerprint"]})
    assert r.status_code == 400
    # Contenu modifié après l'aperçu : refus
    r = demo_client.post(
        "/api/apply/send", json={**payload, "body": "autre", "confirm": True, "fingerprint": preview["fingerprint"]}
    )
    assert r.status_code == 409
    r = demo_client.post("/api/apply/send", json={**payload, "confirm": True, "fingerprint": preview["fingerprint"]})
    assert r.status_code == 200, r.text
    app = r.json()
    assert app["status"] == "postule" and app["events"][-1]["kind"] == "email_simulated"
    # Doublon
    r = demo_client.post("/api/apply/send", json={**payload, "confirm": True, "fingerprint": preview["fingerprint"]})
    assert r.status_code == 409
    again = demo_client.post("/api/apply/prepare", json={"offer_id": offer["id"]}).json()
    assert again["already_applied"] is True


def test_apply_on_site_and_kanban(demo_client):
    offers = demo_client.post("/api/search", json={"query": "développeur"}).json()["offers"]
    offer = next(o for o in offers if not o["apply_email"])
    prep = demo_client.post("/api/apply/prepare", json={"offer_id": offer["id"]}).json()
    assert prep["method"] == "site" and prep["answers"]
    r = demo_client.post("/api/apply/mark", json={"offer_id": offer["id"], "resume_id": prep["resume_id"]})
    app = r.json()
    assert app["status"] == "postule" and app["follow_up_at"]
    assert demo_client.post("/api/apply/mark", json={"offer_id": offer["id"]}).status_code == 409
    r = demo_client.patch(f"/api/applications/{app['id']}", json={"status": "entretien", "notes": "RDV mardi"})
    assert r.json()["status"] == "entretien" and r.json()["notes"] == "RDV mardi"
    assert any("Entretien" in e["message"] for e in r.json()["events"])
    board = demo_client.get("/api/applications").json()
    assert any(a["id"] == app["id"] for a in board)


def test_adapt_creates_variant_with_scores(demo_client):
    resumes = demo_client.get("/api/resumes").json()
    base = next(r for r in resumes if r["is_base"])
    offers = demo_client.post("/api/search", json={"query": "comptable"}).json()["offers"]
    r = demo_client.post(f"/api/resumes/{base['id']}/adapt", json={"offer_id": offers[0]["id"]})
    v = r.json()
    assert v["is_base"] is False and v["parent_id"] == base["id"]
    assert {"score_before", "score_after", "points", "changes"} <= set(v["adaptation"])
    assert v["data"]["experiences"][0]["company"] == base["data"]["experiences"][0]["company"]


def test_dashboard_and_settings(demo_client):
    d = demo_client.get("/api/dashboard").json()
    assert set(d["counts"]) == {"a_postuler", "postule", "relance", "entretien", "refus", "offre"}
    assert d["resume"]["score"] > 0
    s = demo_client.get("/api/settings/status").json()
    assert s["ai"]["enabled"] is False and s["demo_mode"] is True
    assert any(src["name"] == "france_travail" and not src["configured"] for src in s["sources"])
    assert demo_client.get("/api/sources").status_code == 200
