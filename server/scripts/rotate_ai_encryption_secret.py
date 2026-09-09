"""Rotation du secret de chiffrement des cles IA (audit 4, B.5).

Avant : changer AI_KEY_ENCRYPTION_SECRET rendait TOUTES les cles IA
indechiffrables (InvalidToken -> AIConfigurationError) sans procedure de
re-chiffrement — il fallait ressaisir chaque cle a la main.

Procedure :
1. generer le nouveau secret (ex: python -c "import secrets; print(secrets.token_urlsafe(32))") ;
2. AI_KEY_ENCRYPTION_SECRET=<nouveau> python scripts/rotate_ai_encryption_secret.py <ANCIEN_SECRET>
   (l'ancien secret est passe en argument pour que le script puisse lire
   puis re-ecrire dans la meme transaction) ;
3. deployer le nouveau secret dans l'environnement.

Le script :
- verifie que l'ancien secret dechiffre chaque cle ;
- re-encrypte chaque cle avec le NOUVEAU secret (celui de l'env) ;
- tout en une seule transaction : si une cle echoue, RIEN n'est ecrit.

Usage :
    AI_KEY_ENCRYPTION_SECRET=<nouveau> python scripts/rotate_ai_encryption_secret.py <ancien>
"""
from __future__ import annotations

import sys

from sqlalchemy import select

from db.session import session_scope
from models import AIApiKey
from services.ai_errors import AIConfigurationError


def _decrypt_with_secret(api_key_encrypted: str, old_secret: str) -> str:
    """Decrypte avec l'ANCIEN secret, sans toucher a l'env courant."""
    from cryptography.fernet import Fernet, InvalidToken

    from services.ai_crypto import _fernet_key_from_secret

    try:
        fernet = Fernet(_fernet_key_from_secret(old_secret))
        return fernet.decrypt(api_key_encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AIConfigurationError(
            "une cle ne peut pas etre decryptee avec l'ancien secret fourni — verifiez ANCIEN_SECRET"
        ) from exc


def rotate_ai_encryption_secret(old_secret: str) -> dict:
    if not old_secret or not old_secret.strip():
        raise SystemExit("Usage: rotate_ai_encryption_secret.py <ANCIEN_SECRET>")

    from services.ai_crypto import encrypt_api_key

    rotated = 0
    with session_scope() as db:
        keys = db.scalars(select(AIApiKey).where(AIApiKey.deleted_at.is_(None))).all()
        # 1. Tout decrypter d'abord : si UNE cle echoue, on n'ecrit rien.
        plains = {}
        for key in keys:
            plains[key.id] = _decrypt_with_secret(key.api_key_encrypted, old_secret)
        # 2. Re-encrypter avec le nouveau secret (env courant).
        for key in keys:
            key.api_key_encrypted = encrypt_api_key(plains[key.id])
            rotated += 1
    return {"rotated": rotated}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    result = rotate_ai_encryption_secret(sys.argv[1])
    print(f"Rotation terminee: {result['rotated']} cle(s) re-encryptee(s) avec le nouveau secret.")
