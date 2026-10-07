"""Accès à l'API Anthropic. Si la clé est absente ou si l'appel échoue, on renvoie None : l'appelant
utilise alors son repli simple, l'application ne plante jamais à cause de l'IA."""

from __future__ import annotations

import logging
from typing import TypeVar

import anthropic
from pydantic import BaseModel

from ..config import get_settings

log = logging.getLogger("formywork.ai")
T = TypeVar("T", bound=BaseModel)
_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic | None:
    global _client
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=90, max_retries=2)
    return _client


async def ask_structured(*, model: str, system: str, prompt: str, schema: type[T], max_tokens: int = 4000) -> T | None:
    client = get_client()
    if client is None:
        return None
    try:
        response = await client.messages.parse(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_format=schema,
        )
    except anthropic.AuthenticationError:
        log.error("Clé Anthropic refusée : vérifiez ANTHROPIC_API_KEY dans .env")
        return None
    except anthropic.RateLimitError:
        log.warning("Limite de débit Anthropic atteinte")
        return None
    except anthropic.APIStatusError as exc:
        log.warning("Erreur API Anthropic %s : %s", exc.status_code, exc.message)
        return None
    except anthropic.APIConnectionError:
        log.warning("API Anthropic injoignable")
        return None
    if response.stop_reason == "refusal":
        log.warning("Le modèle a refusé la demande")
        return None
    return response.parsed_output
