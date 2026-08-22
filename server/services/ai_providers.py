from __future__ import annotations

import json
from typing import Any, Protocol

import httpx

from models import AIApiKey
from models.enums import AIErrorType, AIProviderType
from services.ai_errors import AIConfigurationError, AIProviderError, AIResponseValidationError


class AIProviderProtocol(Protocol):
    name: str
    supports_structured_output: bool

    def generate_structured(self, prompt: str, schema_hint: dict | None = None) -> dict:
        ...

    def test_connection(self) -> dict:
        ...


def _select_model(models: list[str] | dict | None) -> str:
    if isinstance(models, list) and models:
        return str(models[0])
    if isinstance(models, dict):
        for key in ("chat", "default", "model"):
            value = models.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        for value in models.values():
            if isinstance(value, str) and value.strip():
                return value.strip()
    return "gpt-4o-mini"


def _classify_http_error(status_code: int, response_text: str) -> AIProviderError:
    lowered = response_text.lower()
    if status_code in {401, 403}:
        return AIProviderError(
            "AI provider authentication failed",
            error_type=AIErrorType.AUTHENTICATION_ERROR,
            retryable=False,
            fallback_immediately=True,
            status_code=status_code,
        )
    if status_code == 404:
        return AIProviderError(
            "AI provider model or endpoint was not found",
            error_type=AIErrorType.MODEL_NOT_FOUND,
            retryable=False,
            fallback_immediately=True,
            status_code=status_code,
        )
    if status_code == 429:
        error_type = AIErrorType.QUOTA_EXCEEDED if "quota" in lowered or "credit" in lowered else AIErrorType.RATE_LIMIT
        return AIProviderError(
            "AI provider rate limit or quota was reached",
            error_type=error_type,
            retryable=True,
            fallback_immediately=True,
            status_code=status_code,
        )
    if 500 <= status_code <= 599:
        return AIProviderError(
            "AI provider server error",
            error_type=AIErrorType.SERVER_ERROR,
            retryable=True,
            status_code=status_code,
        )
    if "content" in lowered and "policy" in lowered:
        return AIProviderError(
            "AI provider rejected the content",
            error_type=AIErrorType.CONTENT_POLICY_ERROR,
            retryable=False,
            fallback_immediately=True,
            status_code=status_code,
        )
    return AIProviderError(
        f"AI provider HTTP error {status_code}",
        error_type=AIErrorType.UNKNOWN_ERROR,
        retryable=False,
        fallback_immediately=True,
        status_code=status_code,
    )


def _extract_json_object(text: str) -> dict:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIResponseValidationError("AI provider returned invalid JSON")
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise AIResponseValidationError("AI provider returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise AIResponseValidationError("AI provider returned JSON that is not an object")
    return parsed


class OpenAICompatibleAdapter:
    supports_structured_output = True

    def __init__(self, api_key_config: AIApiKey, api_key: str) -> None:
        self.api_key_config = api_key_config
        self.api_key = api_key
        self.name = api_key_config.name
        self.model = _select_model(api_key_config.models)
        self.base_url = self._resolve_base_url(api_key_config)
        self.timeout_seconds = api_key_config.timeout_seconds

    @staticmethod
    def _resolve_base_url(api_key_config: AIApiKey) -> str:
        if api_key_config.base_url:
            return api_key_config.base_url.rstrip("/")
        if api_key_config.provider_type == AIProviderType.OPENAI:
            return "https://api.openai.com/v1"
        raise AIConfigurationError("base_url is required for OpenAI-compatible AI providers")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(self, prompt: str, schema_hint: dict | None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }
        if schema_hint is not None:
            payload["response_format"] = {"type": "json_object"}
        return payload

    def generate_structured(self, prompt: str, schema_hint: dict | None = None) -> dict:
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=self._payload(prompt, schema_hint),
                )
        except httpx.TimeoutException as exc:
            raise AIProviderError("AI provider request timed out", error_type=AIErrorType.TIMEOUT, retryable=True) from exc
        except httpx.TransportError as exc:
            raise AIProviderError("AI provider network error", error_type=AIErrorType.NETWORK_ERROR, retryable=True) from exc

        if response.status_code >= 400:
            raise _classify_http_error(response.status_code, response.text[:1000])

        try:
            payload = response.json()
        except ValueError as exc:
            raise AIResponseValidationError("AI provider response body is not JSON") from exc

        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIResponseValidationError("AI provider response is missing message content") from exc

        if isinstance(content, dict):
            return content
        if not isinstance(content, str):
            raise AIResponseValidationError("AI provider message content is not JSON text")
        return _extract_json_object(content)

    def test_connection(self) -> dict:
        result = self.generate_structured(
            'Return exactly this JSON object: {"ok": true}.',
            schema_hint={"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]},
        )
        return {"ok": bool(result.get("ok")), "provider": self.name, "model": self.model}


class MockAIAdapter:
    name = "mock"
    supports_structured_output = True

    def __init__(self, api_key_config: AIApiKey, api_key: str | None = None) -> None:
        self.api_key_config = api_key_config
        self.model = _select_model(api_key_config.models)

    def generate_structured(self, prompt: str, schema_hint: dict | None = None) -> dict:
        if self.api_key_config.notes and "simulate_error" in self.api_key_config.notes:
            raise AIProviderError("simulated mock provider error", error_type=AIErrorType.UNKNOWN_ERROR)
        try:
            prompt_payload = _extract_json_object(prompt)
        except AIProviderError:
            prompt_payload = {}

        offers = prompt_payload.get("offers") if isinstance(prompt_payload, dict) else None
        filieres = prompt_payload.get("referentiels", {}).get("filieres", []) if isinstance(prompt_payload, dict) else []
        contract_types = (
            prompt_payload.get("referentiels", {}).get("contract_types", []) if isinstance(prompt_payload, dict) else []
        )
        experience_levels = (
            prompt_payload.get("referentiels", {}).get("experience_levels", []) if isinstance(prompt_payload, dict) else []
        )
        education_levels = (
            prompt_payload.get("referentiels", {}).get("education_levels", []) if isinstance(prompt_payload, dict) else []
        )
        default_filiere_code = filieres[0]["code"] if filieres else None
        default_contract_type_code = contract_types[0]["code"] if contract_types else None
        default_experience_level_code = experience_levels[0]["code"] if experience_levels else None
        default_education_level_code = education_levels[0]["code"] if education_levels else None

        if not isinstance(offers, list):
            return {"results": []}

        results = []
        for offer in offers:
            if not isinstance(offer, dict) or "offer_id" not in offer:
                continue
            requires_review = default_filiere_code is None
            results.append(
                {
                    "offer_id": offer["offer_id"],
                    "primary_filiere_code": None if requires_review else default_filiere_code,
                    "specialty_code": None,
                    "filiere_confidence": 0.75 if not requires_review else 0.4,
                    "requires_admin_review": requires_review,
                    "suggested_filiere": {
                        "code": "a-classer",
                        "label": "A classer",
                        "reason": "Aucune filiere active fournie au mock.",
                    }
                    if requires_review
                    else None,
                    "contract_type_code": offer.get("contract_type_code") or default_contract_type_code,
                    "experience_level_code": offer.get("experience_level_code") or default_experience_level_code,
                    "education_level_code": offer.get("education_level_code") or default_education_level_code,
                    "detail": {
                        "intro": offer.get("description") or offer.get("title") or "Offre a verifier.",
                        "missions": [],
                        "profile_requirements": [],
                        "benefits": [],
                        "tags": [item for item in [offer.get("location_raw"), "Cote d'Ivoire"] if item],
                    },
                }
            )
        return {"results": results}

    def test_connection(self) -> dict:
        return {"ok": True, "provider": self.name, "model": self.model}


class AIProviderFactory:
    @staticmethod
    def build(api_key_config: AIApiKey, api_key: str) -> AIProviderProtocol:
        provider_type = api_key_config.provider_type
        if provider_type == AIProviderType.MOCK:
            return MockAIAdapter(api_key_config, api_key)
        if provider_type in {
            AIProviderType.OPENAI_COMPATIBLE,
            AIProviderType.OPENAI,
            AIProviderType.MISTRAL,
            AIProviderType.GROQ,
            AIProviderType.OLLAMA,
            AIProviderType.CUSTOM_HTTP,
        }:
            return OpenAICompatibleAdapter(api_key_config, api_key)
        raise AIConfigurationError(f"AI provider type is not implemented yet: {provider_type.value}")
