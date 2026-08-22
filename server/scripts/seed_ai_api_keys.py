from __future__ import annotations

import os
from dataclasses import dataclass

from sqlalchemy import select

from db.session import session_scope
from models import AIApiKey
from models.enums import AIProviderType
from services.ai_crypto import api_key_last4, encrypt_api_key


@dataclass(frozen=True)
class AIKeySeed:
    name: str
    env_var: str
    provider_type: AIProviderType
    base_url: str
    models: list[str]
    priority: int
    notes: str


AI_KEYS: tuple[AIKeySeed, ...] = (
    AIKeySeed(
        name="OpenRouter",
        env_var="OPENROUTER_API_KEY",
        provider_type=AIProviderType.OPENAI_COMPATIBLE,
        base_url="https://openrouter.ai/api/v1",
        models=["deepseek/deepseek-chat"],
        priority=10,
        notes="Seed admin IA: OpenRouter (repere fourni: sk-or-v1-b...a192).",
    ),
    AIKeySeed(
        name="Groq",
        env_var="GROQ_API_KEY",
        provider_type=AIProviderType.GROQ,
        base_url="https://api.groq.com/openai/v1",
        models=["llama-3.3-70b-versatile"],
        priority=20,
        notes="Seed admin IA: Groq (repere fourni: gsk_RIXueU...Erm).",
    ),
    AIKeySeed(
        name="DeepSeek",
        env_var="DEEPSEEK_API_KEY",
        provider_type=AIProviderType.OPENAI_COMPATIBLE,
        base_url="https://api.deepseek.com",
        models=["deepseek-chat"],
        priority=30,
        notes="Seed admin IA: DeepSeek (repere fourni: sk-708...8c).",
    ),
)


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        raise RuntimeError(f"Variable d'environnement manquante: {name}")
    return value.strip()


def seed_ai_api_keys() -> None:
    _required_env("AI_KEY_ENCRYPTION_SECRET")
    inserted = 0
    updated = 0

    with session_scope() as db:
        for seed in AI_KEYS:
            plain_key = _required_env(seed.env_var)
            existing = db.scalar(select(AIApiKey).where(AIApiKey.name == seed.name, AIApiKey.deleted_at.is_(None)))
            values = {
                "provider_type": seed.provider_type,
                "base_url": seed.base_url,
                "models": seed.models,
                "api_key_encrypted": encrypt_api_key(plain_key),
                "api_key_last4": api_key_last4(plain_key),
                "priority": seed.priority,
                "is_active": True,
                "max_concurrent_requests": 1,
                "timeout_seconds": 60,
                "max_retries": 2,
                "retry_backoff_seconds": 5,
                "rate_limit_per_minute": None,
                "notes": seed.notes,
                "disabled_until": None,
            }

            if existing is None:
                db.add(AIApiKey(name=seed.name, **values))
                inserted += 1
            else:
                for field_name, field_value in values.items():
                    setattr(existing, field_name, field_value)
                updated += 1

    print(f"Cles IA seed: {inserted} creee(s), {updated} mise(s) a jour.")


if __name__ == "__main__":
    seed_ai_api_keys()
