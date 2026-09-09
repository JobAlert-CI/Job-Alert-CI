from __future__ import annotations

import base64
import hashlib

from services.ai_errors import AIConfigurationError

# Audit 4, B.5 : un secret trop court produit une cle Fernet faible (et la
# rotation du secret devient alors une urgence). 32 chars est la taille de
# la sortie SHA-256 utilisee pour la derivation — en dessous, le secret
# n'apporte aucune entropie exploitable.
MIN_SECRET_LENGTH = 32


def _get_fernet():
    try:
        from cryptography.fernet import Fernet, InvalidToken
    except ImportError as exc:
        raise AIConfigurationError("cryptography is required to encrypt AI API keys") from exc
    return Fernet, InvalidToken


def _fernet_key_from_secret(secret: str) -> bytes:
    raw_secret = secret.strip()
    if not raw_secret:
        raise AIConfigurationError("AI_KEY_ENCRYPTION_SECRET is required")

    # Audit 4, B.5 : longueur minimale exigee au premier usage, avec un
    # message actionnable (generer un secret base64 de 32 octets).
    if len(raw_secret) < MIN_SECRET_LENGTH:
        raise AIConfigurationError(
            f"AI_KEY_ENCRYPTION_SECRET doit faire au moins {MIN_SECRET_LENGTH} caracteres "
            "(utilisez un secret base64 de 32 octets, ex: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
        )

    try:
        decoded = base64.urlsafe_b64decode(raw_secret.encode("utf-8"))
        if len(decoded) == 32:
            return raw_secret.encode("utf-8")
    except Exception:
        pass

    digest = hashlib.sha256(raw_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet():
    Fernet, _ = _get_fernet()
    # Audit 4, B.6 : lecture via get_settings() (source de verite unique) —
    # le champ Settings ai_key_encryption_secret etait mort, ai_crypto
    # lisait l'env directement et les deux pouvaient diverger.
    from core.config import get_settings

    secret = get_settings().ai_key_encryption_secret
    if secret is None:
        raise AIConfigurationError("AI_KEY_ENCRYPTION_SECRET is required")
    return Fernet(_fernet_key_from_secret(secret))


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(api_key_encrypted: str) -> str:
    _, InvalidToken = _get_fernet()
    try:
        return _fernet().decrypt(api_key_encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AIConfigurationError("AI API key cannot be decrypted with current encryption secret") from exc


def api_key_last4(api_key: str) -> str:
    return api_key[-4:] if len(api_key) >= 4 else api_key
