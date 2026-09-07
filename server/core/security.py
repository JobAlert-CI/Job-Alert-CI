from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

import bcrypt

from core.config import get_settings

"""Securite du back-office: hachage des mots de passe et JWT "maison".

On evite volontairement une dependance a PyJWT / python-jose: le format reste
un JWT standard (header.payload.signature, HS256) mais l'encodage/decodage
tient en quelques lignes de stdlib + bcrypt. Suffisant pour un back-office
interne, et facilement remplaçable par une lib complete plus tard sans
changer l'API (`create_access_token` / `decode_access_token`).
"""


class TokenError(Exception):
    """Levee quand un token est absent, malforme, expire ou falsifie."""


@dataclass(frozen=True)
class TokenPayload:
    admin_id: str
    role: str
    token_type: str
    expires_at: int


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# Cycle 15: alphabet sans caracteres ambigus (pas de 0/O/1/l/I) — le mot de
# passe temporaire est recopie a la main depuis l'ecran de creation.
_TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def generate_temporary_password(length: int = 16) -> str:
    """Mot de passe temporaire cryptosecure (secrets, sans caracteres ambigus).

    Sert a la creation d'un compte admin sans mot de passe fourni : le
    temporaire est affiche UNE seule fois au super_admin createur, et le
    compte porte must_change_password=True jusqu'au premier changement.
    """
    import secrets

    if length < 8:
        raise ValueError("Un mot de passe temporaire doit faire au moins 8 caracteres")
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(message: bytes, secret: str) -> bytes:
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()


def _encode_token(admin_id: str, role: str, token_type: str, expires_in_minutes: int) -> str:
    settings = get_settings()
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": admin_id,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_in_minutes * 60,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature_b64 = _b64url_encode(_sign(signing_input, settings.admin_jwt_secret))
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def create_access_token(admin_id: str, role: str) -> str:
    settings = get_settings()
    return _encode_token(admin_id, role, "access", settings.admin_jwt_access_minutes)


def create_refresh_token(admin_id: str, role: str) -> str:
    settings = get_settings()
    return _encode_token(admin_id, role, "refresh", settings.admin_jwt_refresh_minutes)


def decode_token(token: str, *, expected_type: str | None = None) -> TokenPayload:
    settings = get_settings()
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise TokenError("Format de token invalide") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_signature = _sign(signing_input, settings.admin_jwt_secret)
    try:
        provided_signature = _b64url_decode(signature_b64)
    except Exception as exc:
        raise TokenError("Signature illisible") from exc

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise TokenError("Signature invalide")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception as exc:
        raise TokenError("Payload illisible") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise TokenError("Token expire")

    # Audit 3, W6 (heritage S14 audit 1) : sanity horloge. Un iat trop dans
    # le futur signale une horloge divergente (multi-noeuds) ou un token
    # forge : on refuse plutot que d'accepter un token "pas encore emis".
    # Tolerance de 60s pour absorber un drift legitime entre noeuds.
    iat = int(payload.get("iat", 0))
    if iat > int(time.time()) + 60:
        raise TokenError("Token emis dans le futur (horloge incoherente)")

    if expected_type and payload.get("type") != expected_type:
        raise TokenError("Type de token inattendu")

    return TokenPayload(
        admin_id=str(payload.get("sub")),
        role=str(payload.get("role")),
        token_type=str(payload.get("type")),
        expires_at=int(payload.get("exp", 0)),
    )
