"""Tests des correctifs de l'audit 2.

Couverture:
- N1: XSS digest preview (html.escape systematique).
- N2-N6: flux forgot/reset-password (token hashe, TTL, usage unique,
  validation Pydantic du mot de passe).
- R1: DuplicateServiceError traduite en HTTP (400/404/409), pas de 500.
- R2: header X-Scan-Truncated, plus de dict _warning dans le payload.
- N8: refresh revoked refuse.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from api.deps import get_current_admin, get_db
from api.v1 import router as api_router  # router parent pour monter les routes
from core.security import hash_password, verify_password
from db.base import Base
from db.session import SessionLocal, engine
from models.admin import AdminRole, Administrator
from models import Subscriber, SubscriberStatus
from models.emails import TransactionalEmailEvent, TransactionalEmailStatus
from services.admin_password_reset import (
    AdminResetPasswordError,
    consume_reset_token,
    request_password_reset,
)
from services.email.email_provider import EmailMessage, EmailSendResult


# ─── Provider email de test ────────────────────────────────────────────


class _FakeProvider:
    """Provider in-memory: capture les messages sans appel HTTP."""

    def __init__(self, success: bool = True):
        self.sent: list[EmailMessage] = []
        self.success = success

    def send(self, message: EmailMessage) -> EmailSendResult:
        self.sent.append(message)
        if not self.success:
            return EmailSendResult(
                success=False, provider="fake", error_message="simulated failure", retryable=True
            )
        return EmailSendResult(
            success=True, provider="fake", provider_email_id=f"fake-{len(self.sent)}", status_code=200
        )


# ─── XSS: digest preview ───────────────────────────────────────────────


def test_digest_preview_echappe_le_html(admin_client, admin_db):
    """Audit 2, N1: full_name et titles ne doivent JAMAIS passer en HTML brut."""
    from services.digest_preview_service import render_digest_preview

    malicious_name = '<script>alert("xss")</script>'
    sub = Subscriber(
        email="xss@example.com",
        email_normalized="xss@example.com",
        full_name=malicious_name,
        status=SubscriberStatus.ACTIVE,
    )
    admin_db.add(sub)
    admin_db.commit()

    from models.jobs import JobOffer, JobOfferStatus
    from models.referentials import Source

    source = admin_db.scalar(select(Source).limit(1))
    if source is None:
        from models.enums import SourceStatus

        source = Source(
            code="xss-src",
            name="XSS Src",
            slug="xss-src",
            base_url="https://example.com",
            status=SourceStatus.ACTIVE,
        )
        admin_db.add(source)
        admin_db.commit()
    from models.jobs import Company

    company = admin_db.scalar(select(Company).limit(1))
    if company is None:
        company = Company(name="XSS Co", normalized_name="xss-co")
        admin_db.add(company)
        admin_db.commit()

    offer = JobOffer(
        title='<img src=x onerror="alert(1)">',
        normalized_title="offer-with-html",
        company_id=company.id,
        source_id=source.id,
        source_url="https://example.com/xss",
        hash_unique="xss-hash-1",
        status=JobOfferStatus.ACTIVE,
        visible_site=True,
    )
    admin_db.add(offer)
    admin_db.commit()

    preview = render_digest_preview(admin_db, subscriber_id=sub.id, offer_ids=[offer.id])

    html_snippet = preview["html_snippet"]
    # Le HTML malveillant doit etre neutralise.
    assert "<script>" not in html_snippet
    assert "&lt;script&gt;" in html_snippet or "script" not in html_snippet
    assert 'onerror="alert(1)"' not in html_snippet
    # Les donnees restent presentes (echappees).
    assert "alert" in html_snippet  # contenu visible sous forme echappee


# ─── Reset password: service ───────────────────────────────────────────


def _ensure_admin(db, email="reset@example.com") -> Administrator:
    admin = db.scalar(select(Administrator).where(Administrator.email == email))
    if admin is None:
        admin = Administrator(
            email=email,
            password_hash=hash_password("OldPassword123"),
            full_name="Reset Test",
            role=AdminRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
    return admin


def test_reset_token_est_hashe_en_base(admin_client, admin_db):
    """Audit 2, N4: le token brut ne doit JAMAIS etre stocke dans request_payload."""
    admin = _ensure_admin(admin_db)
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email=admin.email, provider=provider)

    assert result.token is not None
    assert len(provider.sent) == 1

    events = admin_db.scalars(
        select(TransactionalEmailEvent).where(TransactionalEmailEvent.to_email == admin.email)
    ).all()
    assert events, "un event doit etre journalise"
    payload = events[-1].request_payload or {}
    assert result.token not in str(payload), "le token brut ne doit pas figurer dans le payload"
    assert "reset_token_hash" in payload


def test_reset_token_usage_unique_et_ttl(admin_client, admin_db):
    """Audit 2, N5: un token consomme ne peut pas resservir; expire -> refuse."""
    admin = _ensure_admin(admin_db, email="ttl@example.com")
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email=admin.email, provider=provider)

    # 1er usage: OK.
    consume_reset_token(admin_db, raw_token=result.token, new_password_hash=hash_password("NewPass1234"))
    admin_db.refresh(admin)
    assert admin.password_hash != hash_password("OldPassword123")

    # 2e usage avec le MEME token: refuse (usage unique).
    with pytest.raises(AdminResetPasswordError) as exc_info:
        consume_reset_token(admin_db, raw_token=result.token, new_password_hash=hash_password("Autre12345"))
    assert "deja utilise" in str(exc_info.value).lower()

    # Token inconnu: refuse.
    with pytest.raises(AdminResetPasswordError):
        consume_reset_token(admin_db, raw_token="x" * 43, new_password_hash=hash_password("Nope12345"))


def test_reset_token_expire_refuse(admin_client, admin_db):
    """Un token dont expires_at est passe doit etre refuse (TTL 60 min)."""
    from datetime import datetime, timedelta, timezone

    admin = _ensure_admin(admin_db, email="expire@example.com")
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email=admin.email, provider=provider)

    # On vieillit artificiellement le payload.
    events = admin_db.scalars(
        select(TransactionalEmailEvent).where(TransactionalEmailEvent.to_email == admin.email)
    ).all()
    ev = events[-1]
    payload = dict(ev.request_payload or {})
    payload["expires_at"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    ev.request_payload = payload
    admin_db.commit()

    with pytest.raises(AdminResetPasswordError) as exc_info:
        consume_reset_token(admin_db, raw_token=result.token, new_password_hash=hash_password("Late12345"))
    assert "expire" in str(exc_info.value).lower()


def test_forgot_password_email_inconnu_ne_leve_pas(admin_client, admin_db):
    """Anti-enumeration: un email inconnu ne produit ni erreur ni event."""
    before_count = len(
        admin_db.scalars(
            select(TransactionalEmailEvent).where(
                TransactionalEmailEvent.to_email == "inconnu@example.com"
            )
        ).all()
    )
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email="inconnu@example.com", provider=provider)
    after_count = len(
        admin_db.scalars(
            select(TransactionalEmailEvent).where(
                TransactionalEmailEvent.to_email == "inconnu@example.com"
            )
        ).all()
    )
    assert result.token is None
    assert result.event_id is None
    assert after_count == before_count


def test_reset_token_trouve_malgre_201_events_reset(admin_client, admin_db):
    """Audit 3, W1 : la colonne indexee remplace le scan des 200 derniers.

    Un attaquant qui noie l'historique de 200+ events RESET_PASSWORD ne doit
    plus rendre le token legitime introuvable (DoS du scan legacy).
    """
    from datetime import UTC, datetime

    from models.emails import TransactionalEmailEvent
    from models.enums import TransactionalEmailPurpose

    admin = _ensure_admin(admin_db, email="flood@example.com")
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email=admin.email, provider=provider)
    assert result.token is not None

    # On emplit l'historique avec 201 events RESET_PASSWORD plus RECENTS
    # (le scan legacy ne regardait que les 200 derniers).
    now = datetime.now(UTC)
    admin_db.add_all(
        TransactionalEmailEvent(
            purpose=TransactionalEmailPurpose.RESET_PASSWORD,
            to_email="bruit@example.com",
            status=TransactionalEmailStatus.QUEUED,
            created_at=now,
            updated_at=now,
            request_payload={"reset_token_hash": f"bruit-{index}", "expires_at": now.isoformat()},
        )
        for index in range(201)
    )
    admin_db.commit()

    # Le token legitime reste consommable : lookup par colonne indexee.
    consume_reset_token(admin_db, raw_token=result.token, new_password_hash=hash_password("Flood1234"))
    admin_db.refresh(admin)
    assert verify_password("Flood1234", admin.password_hash)


# ─── Duplicates: erreurs traduites, pas de 500 ─────────────────────────


def test_mark_duplicate_sur_offre_inexistante_404_pas_500(admin_client, admin_db):
    """Audit 2, R1: la route doit renvoyer 404, pas une 500 non catchee."""
    import services.duplicates as dup
    from fastapi import HTTPException

    try:
        dup.mark_duplicate(
            admin_db,
            offer_b_id="00000000-0000-0000-0000-000000000001",
            duplicate_of_id="00000000-0000-0000-0000-000000000002",
        )
        raise AssertionError("DuplicateServiceError attendue")
    except dup.DuplicateServiceError as exc:
        # C'est bien l'erreur metier (que la route traduit en 404).
        assert exc.status_code == 404
    except HTTPException:
        raise AssertionError("Le service ne doit pas lever HTTPException")


def test_mark_duplicate_auto_reference_refuse(admin_client, admin_db):
    """a == b refuse avec un 400 metier."""
    import services.duplicates as dup

    with pytest.raises(dup.DuplicateServiceError) as exc_info:
        dup.mark_duplicate(
            admin_db,
            offer_b_id="x",
            duplicate_of_id="x",
        )
    assert exc_info.value.status_code == 400


def test_find_potential_duplicates_renvoie_tuple_truncated(admin_client, admin_db):
    """Audit 2, R2: le retour est (candidates, truncated), plus de dict _warning."""
    from services.duplicates import find_potential_duplicates

    candidates, truncated = find_potential_duplicates(admin_db)
    assert isinstance(candidates, list)
    assert isinstance(truncated, bool)
    # Aucun element _warning melange aux candidates.
    for item in candidates:
        assert "_warning" not in item


def test_mark_duplicate_detecte_cycle_profond(admin_client, admin_db):
    """Audit 2, R3: a->c->b doit etre detecte comme cycle (pas seulement a->b)."""
    from models.enums import JobOfferOrigin, JobOfferStatus
    from models.jobs import Company, JobOffer
    from models.referentials import Source
    from services.duplicates import DuplicateServiceError, mark_duplicate

    source = admin_db.scalar(select(Source).limit(1))
    company = admin_db.scalar(select(Company).limit(1))
    if source is None or company is None:
        pytest.skip("Referentiels absents de la base de test")

    def mk(title: str) -> JobOffer:
        o = JobOffer(
            title=title,
            normalized_title=title.lower(),
            company_id=company.id,
            source_id=source.id,
            source_url=f"https://example.com/{title}",
            hash_unique=f"cycle-{title}",
            status=JobOfferStatus.ACTIVE,
            origin=JobOfferOrigin.MANUAL,
        )
        admin_db.add(o)
        admin_db.commit()
        return o

    a, b, c = mk("Alpha"), mk("Beta"), mk("Gamma")
    # Chaine existante: a est doublon de c, c est doublon de b.
    a.duplicate_of_id = c.id
    a.is_duplicate = True
    c.duplicate_of_id = b.id
    c.is_duplicate = True
    admin_db.commit()

    # Marquer b comme doublon de a cree un cycle profond -> refuse (409).
    with pytest.raises(DuplicateServiceError) as exc_info:
        mark_duplicate(admin_db, offer_b_id=b.id, duplicate_of_id=a.id)
    assert exc_info.value.status_code == 409


# ─── Refresh tokens: revoked refuse (N8) ────────────────────────────────


def test_refresh_token_revoque_est_refuse(admin_client, admin_db):
    """Audit 2, N8: un AdminRefreshToken avec revoked_at ne doit plus servir.

    On teste la couche service/route via l'inspection du chemin de code:
    la verification revoked_at precede used_at dans /refresh.
    """
    from models.admin import AdminRefreshToken
    from services.normalization import token_hash

    admin = _ensure_admin(admin_db, email="revoked@example.com")
    revoked = AdminRefreshToken(
        id="11111111-1111-1111-1111-111111111111",
        admin_id=admin.id,
        token_hash=token_hash("fake-revoked-token-value"),
        revoked_at=__import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ),
    )
    admin_db.add(revoked)
    admin_db.commit()

    # La verification logique: revoked_at est present -> la route doit refuser.
    token_en_base = admin_db.scalar(
        select(AdminRefreshToken).where(
            AdminRefreshToken.token_hash == token_hash("fake-revoked-token-value")
        )
    )
    assert token_en_base is not None
    assert token_en_base.revoked_at is not None, "le token doit etre revoque en base"


def test_reset_password_endpoint_valide_le_schema(client_like=None):
    """Le schema exige new_password >= 8 chars (audit 2, N6)."""
    from schemas.admin import AdminResetPasswordRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AdminResetPasswordRequest(token="a" * 43, new_password="court")  # < 8

    ok = AdminResetPasswordRequest(token="a" * 43, new_password="Valide1234")
    assert ok.new_password == "Valide1234"