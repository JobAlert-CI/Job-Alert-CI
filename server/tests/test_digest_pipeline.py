from __future__ import annotations

"""Tests du pipeline digest quotidien en 2 phases (mode eager, mock provider).

Conformement au cahier des charges (prompt_send_offres_email.md), ces tests
couvrent:
- la preparation: eligibilite, filtres durs, scoring, skipped_empty,
  UNIQUE(subscriber_id, digest_date);
- l'envoi: queued -> sending -> sent/failed/cancelled, trace
  EmailDeliveryAttempt, retry borne a EMAIL_MAX_RETRIES;
- les liens tokenises (hash avant SELECT via token_hash).
"""

from datetime import date, datetime, timedelta, timezone

import pytest

from models import (
    Company,
    ContractType,
    DigestStatus,
    EmailAttemptStatus,
    EmailDigest,
    EmailDeliveryAttempt,
    ExperienceLevel,
    Filiere,
    JobOffer,
    JobOfferOrigin,
    JobOfferStatus,
    Location,
    Source,
    Subscriber,
    SubscriberFiliere,
    SubscriberStatus,
)
from services.digest_builder_service import (
    build_and_queue_digest_sync,
    is_subscriber_eligible,
    select_candidate_offers,
)
from services.digest_sender_service import send_digest_now

# ─── Jeu de donnees minimal ───────────────────────────────────────────────


def _make_reference_data(db) -> dict:
    filiere = db.query(Filiere).filter_by(code="tech-dev").one()
    contract = db.query(ContractType).filter_by(code="cdi").one()
    source = db.query(Source).filter_by(code="test").first() or Source(
        code="test", name="Source test", slug="source-test", base_url="https://example.com"
    )
    if source.id is None or not db.query(Source).filter_by(code="test").count():
        db.add(source)
        db.flush()
    company = Company(name="ACME", normalized_name="acme")
    location = Location(
        city="Abidjan",
        label="Abidjan",
        normalized_label=f"abidjan-{date.today().isoformat()}",
        country_code="CI",
    )
    remote_location = Location(
        city="Teletravail",
        label="Remote CI",
        normalized_label=f"remote-{date.today().isoformat()}",
        country_code="CI",
        is_remote=True,
    )
    experience = db.query(ExperienceLevel).filter_by(code="junior").one()
    db.add_all([company, location, remote_location])
    db.flush()
    return {
        "filiere": filiere,
        "contract": contract,
        "source": source,
        "company": company,
        "location": location,
        "remote_location": remote_location,
        "experience": experience,
    }


def _make_offer(db, ref: dict, **overrides) -> JobOffer:
    now = datetime.now(timezone.utc)
    defaults = dict(
        title="Developpeur Python",
        normalized_title="developpeur python",
        company_id=ref["company"].id,
        source_id=ref["source"].id,
        location_id=ref["location"].id,
        primary_filiere_id=ref["filiere"].id,
        contract_type_id=ref["contract"].id,
        experience_level_id=None,
        status=JobOfferStatus.ACTIVE,
        origin=JobOfferOrigin.MANUAL,
        visible_site=True,
        source_url="https://example.com/offre-1",
        hash_unique=f"hash-{now.timestamp()}-{id(overrides)}",
        published_at=now - timedelta(hours=2),
    )
    defaults.update(overrides)
    offer = JobOffer(**defaults)
    db.add(offer)
    return offer


def _make_subscriber(db, ref: dict, **overrides) -> Subscriber:
    subscriber = Subscriber(
        email="abonne@example.com",
        email_normalized="abonne@example.com",
        full_name="Abonne Test",
        city="Abidjan",
        status=SubscriberStatus.ACTIVE,
        # Inscrit avant la publication des offres de test: la fenetre de
        # fraicheur ne doit pas exclure les offres du jeu d'essai.
        subscribed_at=datetime.now(timezone.utc) - timedelta(days=30),
        confirmed_at=datetime.now(timezone.utc) - timedelta(days=29),
    )
    db.add(subscriber)
    db.flush()
    db.add(SubscriberFiliere(subscriber_id=subscriber.id, filiere_id=ref["filiere"].id, priority=1))
    db.commit()
    return subscriber


# ─── Preparation ──────────────────────────────────────────────────────────


class TestDigestPreparation:
    def test_build_creates_queued_digest_with_offers(self, db):
        ref = _make_reference_data(db)
        _make_offer(db, ref)
        subscriber = _make_subscriber(db, ref)

        result = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=get_test_settings()
        )

        assert result.status == "queued"
        assert result.offer_count == 1
        digest = db.get(EmailDigest, result.digest_id)
        assert digest.status == DigestStatus.QUEUED
        assert len(digest.offer_links) == 1
        assert digest.offer_links[0].position == 1

    def test_skipped_empty_when_no_matching_offer(self, db):
        ref = _make_reference_data(db)
        # Offre hors filiere de l'abonne.
        other_filiere = Filiere(code="autre", slug="autre", label="Autre")
        db.add(other_filiere)
        db.flush()
        _make_offer(db, ref, primary_filiere_id=other_filiere.id)
        subscriber = _make_subscriber(db, ref)

        result = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=get_test_settings()
        )

        assert result.status == "skipped_empty"
        digest = db.get(EmailDigest, result.digest_id)
        assert digest.status == DigestStatus.SKIPPED_EMPTY
        assert digest.offer_count == 0
        assert digest.skipped_reason == "no_matching_offer"

    def test_no_duplicate_digest_for_same_date(self, db):
        ref = _make_reference_data(db)
        _make_offer(db, ref)
        subscriber = _make_subscriber(db, ref)
        settings = get_test_settings()

        first = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=settings
        )
        second = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=settings
        )
        assert second.digest_id == first.digest_id
        assert second.detail == "digest deja existant"

    def test_force_recancels_only_unsent(self, db):
        ref = _make_reference_data(db)
        _make_offer(db, ref)
        subscriber = _make_subscriber(db, ref)
        settings = get_test_settings()

        first = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=settings
        )
        forced = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=settings, force=True
        )
        assert forced.digest_id == first.digest_id
        assert forced.status == "queued"

    def test_hard_filters_exclude_inactive_or_invisible(self, db):
        ref = _make_reference_data(db)
        _make_offer(db, ref, status=JobOfferStatus.BRUT)  # non validee par l'IA
        _make_offer(db, ref, visible_site=False)
        subscriber = _make_subscriber(db, ref)

        ranked, _ = select_candidate_offers(db, subscriber, settings=get_test_settings())
        assert ranked == []

    def test_never_resends_already_sent_offer(self, db):
        ref = _make_reference_data(db)
        sent_offer = _make_offer(db, ref)
        new_offer = _make_offer(db, ref, title="Second poste", hash_unique="hash-new")
        subscriber = _make_subscriber(db, ref)
        db.commit()

        # Un ancien digest `sent` contenant deja sent_offer (envoye AVANT la
        # publication des offres actuelles: la fraicheur ne doit rien exclure).
        old_digest = EmailDigest(
            subscriber_id=subscriber.id,
            digest_date=date.today() - timedelta(days=1),
            scheduled_for=datetime.now(timezone.utc) - timedelta(days=1),
            status=DigestStatus.SENT,
            sent_at=datetime.now(timezone.utc) - timedelta(days=2),
            offer_count=1,
        )
        db.add(old_digest)
        db.flush()
        from models import EmailDigestOffer

        db.add(EmailDigestOffer(digest_id=old_digest.id, offer_id=sent_offer.id, position=1))
        db.commit()

        ranked, _ = select_candidate_offers(db, subscriber, settings=get_test_settings())
        ranked_ids = [offer.id for offer in ranked]
        assert sent_offer.id not in ranked_ids
        assert new_offer.id in ranked_ids

    def test_eligibility_rules(self, db):
        ref = _make_reference_data(db)
        subscriber = _make_subscriber(db, ref)

        assert is_subscriber_eligible(subscriber) is True

        subscriber.paused_until = datetime.now(timezone.utc) + timedelta(days=1)
        assert is_subscriber_eligible(subscriber) is False
        subscriber.paused_until = None

        subscriber.status = SubscriberStatus.UNSUBSCRIBED
        assert is_subscriber_eligible(subscriber) is False
        subscriber.status = SubscriberStatus.ACTIVE

        subscriber.filiere_links.clear()
        assert is_subscriber_eligible(subscriber) is False


# ─── Envoi ────────────────────────────────────────────────────────────────

from conftest import FakeEmailProvider  # noqa: E402
from core.config import Settings, get_settings  # noqa: E402


def get_test_settings() -> Settings:
    return get_settings()


class TestDigestSending:
    def _prepare_queued_digest(self, db) -> tuple[object, object]:
        ref = _make_reference_data(db)
        _make_offer(db, ref)
        subscriber = _make_subscriber(db, ref)
        db.commit()
        result = build_and_queue_digest_sync(
            db, subscriber_id=subscriber.id, digest_day=date.today(), settings=get_test_settings()
        )
        return db.get(EmailDigest, result.digest_id), subscriber

    def test_successful_send_traces_attempt(self, db):
        digest, subscriber = self._prepare_queued_digest(db)
        provider = FakeEmailProvider()

        outcome = send_digest_now(db, digest_id=digest.id, provider=provider, settings=get_test_settings())

        assert outcome.success is True
        assert outcome.status == "sent"
        attempts = db.query(EmailDeliveryAttempt).filter_by(digest_id=digest.id).all()
        assert len(attempts) == 1
        assert attempts[0].status == EmailAttemptStatus.SUCCESS
        assert attempts[0].provider_message_id is not None
        assert digest.status == DigestStatus.SENT
        assert digest.sent_at is not None
        assert subscriber.last_email_sent_at is not None
        # Le lien unsubscribe pointe vers un token brut (jamais le hash).
        assert "/desinscription/" in provider.sent[0].text

    def test_cancelled_if_subscriber_unsubscribed(self, db):
        digest, subscriber = self._prepare_queued_digest(db)
        subscriber.status = SubscriberStatus.UNSUBSCRIBED
        db.commit()

        outcome = send_digest_now(db, digest_id=digest.id, provider=FakeEmailProvider(), settings=get_test_settings())

        assert outcome.success is False
        assert outcome.status == "cancelled"
        fresh = db.get(EmailDigest, digest.id)
        assert fresh.status == DigestStatus.CANCELLED
        assert fresh.skipped_reason == "subscriber_unsubscribed"

    def test_failed_after_max_retries_then_stops(self, db):
        digest, _subscriber = self._prepare_queued_digest(db)
        settings = get_test_settings()

        outcomes = []
        while True:
            db.expire_all()
            current = db.get(EmailDigest, digest.id)
            if current.status != DigestStatus.QUEUED:
                break
            outcome = send_digest_now(db, digest_id=digest.id, provider=FakeFailingProvider(), settings=settings)
            outcomes.append(outcome)

        assert len(outcomes) == 3  # EMAIL_MAX_RETRIES
        assert all(item.success is False for item in outcomes)
        final = db.get(EmailDigest, digest.id)
        assert final.status == DigestStatus.FAILED
        attempts = db.query(EmailDeliveryAttempt).filter_by(digest_id=digest.id).all()
        assert sorted(a.attempt_no for a in attempts) == [1, 2, 3]
        assert all(a.status == EmailAttemptStatus.FAILED for a in attempts)


class FakeFailingProvider:
    """Provider qui echoue toujours avec une erreur retentable (timeout)."""

    def __init__(self) -> None:
        self.calls = 0

    def send(self, message):
        self.calls += 1
        from services.email.email_provider import EmailSendResult

        return EmailSendResult(success=False, provider="mock", error_message="Timeout reseau", retryable=True)
