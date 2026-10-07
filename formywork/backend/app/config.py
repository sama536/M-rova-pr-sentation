"""Configuration de FormyWork, lue depuis le fichier .env (jamais de secret dans le code)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]  # dossier formywork/
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    # Général
    demo_mode: bool = True
    secret_key: str = "change-me"
    host: str = "127.0.0.1"
    port: int = 8000
    database_url: str = f"sqlite:///{(DATA_DIR / 'formywork.db').as_posix()}"
    max_users: int = 3
    max_upload_mb: int = 5
    session_days: int = 30

    # IA (Anthropic)
    anthropic_api_key: str = ""
    ai_model_summary: str = "claude-haiku-4-5"
    ai_model_cv: str = "claude-opus-5-5"

    # Sources officielles
    france_travail_client_id: str = ""
    france_travail_client_secret: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jooble_api_key: str = ""
    lba_api_token: str = ""

    # Scraping de pages publiques (désactivé par défaut)
    scraping_enabled: bool = False
    scraping_min_delay_s: float = 2.0
    scraping_max_delay_s: float = 4.0
    scraping_max_pages: int = 2
    scraping_user_agent: str = "FormyWorkBot/1.0 (usage prive, 3 personnes)"

    # Rafraîchissement automatique
    refresh_api_minutes: int = Field(12, ge=5)
    refresh_scraping_hours: int = Field(6, ge=1)
    offer_expiry_days: int = 21
    demo_new_offer_minutes: int = 3

    # E-mail (SMTP). Une ligne par boîte : SMTP_ACCOUNTS=adresse:motdepasse,adresse2:motdepasse2
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_accounts: str = ""

    def smtp_password_for(self, email: str) -> str | None:
        for chunk in self.smtp_accounts.split(","):
            if ":" not in chunk:
                continue
            address, password = chunk.split(":", 1)
            if address.strip().lower() == email.strip().lower():
                return password.strip()
        return None

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return Settings()
