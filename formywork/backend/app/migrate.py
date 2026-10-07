"""Applique les migrations Alembic au démarrage (la base est créée si besoin)."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from . import db
from .config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def alembic_config(url: str | None = None) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url or str(db.engine.url) or get_settings().database_url)
    return cfg


def upgrade_database() -> None:
    command.upgrade(alembic_config(), "head")
