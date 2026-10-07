"""Configuration des tests : base temporaire, aucune clé, aucun appel réseau réel."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

for _var in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(_var, None)  # les réponses simulées ne doivent pas passer par un proxy

_TMP = Path(tempfile.mkdtemp(prefix="formywork-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
        "DEMO_MODE": "true",
        "ANTHROPIC_API_KEY": "",
        "FRANCE_TRAVAIL_CLIENT_ID": "",
        "FRANCE_TRAVAIL_CLIENT_SECRET": "",
        "ADZUNA_APP_ID": "",
        "ADZUNA_APP_KEY": "",
        "JOOBLE_API_KEY": "",
        "LBA_API_TOKEN": "",
        "SCRAPING_ENABLED": "false",
        "SMTP_ACCOUNTS": "",
        "SCRAPING_MIN_DELAY_S": "0",
        "SCRAPING_MAX_DELAY_S": "0",
    }
)

import socket  # noqa: E402

import pytest  # noqa: E402

from app.config import get_settings  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tout appel réseau non simulé fait échouer le test."""

    real_connect = socket.socket.connect

    def guarded(self, address):
        host = address[0] if isinstance(address, tuple) else address
        if host in ("127.0.0.1", "localhost", "::1") or self.family == socket.AF_UNIX:
            return real_connect(self, address)
        raise ConnectionRefusedError(f"Appel réseau réel interdit dans les tests : {address}")

    monkeypatch.setattr(socket.socket, "connect", guarded)
    yield


@pytest.fixture(scope="session", autouse=True)
def database():
    from app.migrate import upgrade_database

    upgrade_database()
    yield


@pytest.fixture
def settings_override(monkeypatch):
    def apply(**values):
        for key, value in values.items():
            monkeypatch.setenv(key.upper(), str(value))
        get_settings.cache_clear()
        return get_settings()

    yield apply
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    app.state.disable_scheduler = True
    with TestClient(app) as c:
        yield c


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")
