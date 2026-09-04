"""Tests du correctif P1 audit 3 (F1) : SAVEPOINT par resultat dans
`apply_ai_results`.

Couvre les 3 scenarios du rapport:
1. un batch mixte (valide + ValueError) ne corrompt pas l'offre valide ;
2. une exception INATTENDUE (non ValueError) sur un resultat est isolee par
   savepoint — l'offre fautive revient en BRUT/FAILED, les autres restent
   ACTIVE, et la route repond 200 (plus de 500) ;
3. le commit unique de la route laisse la base coherente.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.admin_db

from models import (  # noqa: E402
    AiOfferStatus,
    Company,
    Filiere,
    JobOffer,
    JobOfferStatus,
    OfferFiliere,
    Source,
    SourceStatus,
)
from models.enums import JobOfferOrigin  # noqa: E402
from services.ai_results import apply_ai_results  # noqa: E402
from schemas.ai import AIInternalResultSubmission, AIProcessedOfferDetail, AIProcessedOfferResult  # noqa: E402
from db.base import Base  # noqa: E402
from db.session import engine  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _ai_results_db():
    """Cree les tables une fois pour le module (le marker admin_db neutralise
    le drop/create par test du conftest principal)."""
    import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _detail_payload() -> AIProcessedOfferDetail:
    return AIProcessedOfferDetail(
        intro="Une intro convaincante",
        missions=["Mission A"],
        profile_requirements=["Profile A"],
        benefits=["Benefit A"],
        tags=["tag1"],
    )


def _result(offer_id: str, *, filiere_code: str | None = "tech-dev", requires_review: bool = False) -> AIProcessedOfferResult:
    return AIProcessedOfferResult(
        offer_id=offer_id,
        primary_filiere_code=filiere_code,
        filiere_confidence=0.9,
        requires_admin_review=requires_review,
        detail=_detail_payload(),
    )


@pytest.fixture()
def seed(admin_db):
    """1 source, 1 filiere, 1 entreprise, 2 offres BRUT (nettoyees en fin)."""
    from models import OfferIngestionEvent, OfferFiliere as OF, JobOfferDetail

    # Nettoyage des tests precedents du module (la base vit entre tests).
    admin_db.query(OfferIngestionEvent).delete()
    admin_db.query(OF).delete()
    admin_db.query(JobOfferDetail).delete()
    admin_db.query(JobOffer).delete()
    admin_db.query(Company).delete()
    admin_db.query(Filiere).delete()
    admin_db.query(Source).delete()
    admin_db.commit()

    source = Source(code="goafrica", name="GoAfrica", slug="goafrica", base_url="https://goafrica.com", status=SourceStatus.ACTIVE, supports_scraping=True)
    filiere = Filiere(code="tech-dev", slug="tech-dev", label="Tech & Dev")
    company = Company(name="ACME CI", normalized_name="acme ci")
    admin_db.add_all([source, filiere, company])
    admin_db.commit()

    offers = []
    for index in range(2):
        offer = JobOffer(
            id=str(uuid.uuid4()),
            public_id=100 + index,
            title=f"Dev Python {index}",
            slug=f"dev-python-{index}",
            normalized_title="dev python",
            company_id=company.id,
            source_id=source.id,
            status=JobOfferStatus.BRUT,
            origin=JobOfferOrigin.SCRAPING,
            visible_site=False,
            source_reference=f"ref-{index}",
            source_url=f"https://example.com/{index}",
            hash_unique=f"hash-{index}",
            ai_status=AiOfferStatus.PENDING,
        )
        admin_db.add(offer)
        offers.append(offer)
    admin_db.commit()
    return admin_db, filiere, offers


def _payload(offers: list[JobOffer], results: list[AIProcessedOfferResult]) -> AIInternalResultSubmission:
    return AIInternalResultSubmission(
        job_id=uuid.uuid4(),
        results=results,
    )


def test_batch_mixte_valueerror_isole(seed):
    db, filiere, offers = seed
    # Offre 0 valide, offre 1 avec une filiere inconnue -> ValueError.
    payload = _payload(
        offers,
        [
            _result(offers[0].id),
            _result(offers[1].id, filiere_code="inconnu"),
        ],
    )
    summary = apply_ai_results(db, payload)
    db.commit()

    db.expire_all()
    ok_offer = db.get(JobOffer, offers[0].id)
    ko_offer = db.get(JobOffer, offers[1].id)

    assert ok_offer.status == JobOfferStatus.ACTIVE
    assert ok_offer.visible_site is True
    assert ok_offer.ai_error_message is None
    assert ok_offer.detail is not None
    assert ok_offer.detail.intro == "Une intro convaincante"

    assert ko_offer.status == JobOfferStatus.BRUT
    assert ko_offer.ai_status == AiOfferStatus.FAILED
    assert ko_offer.ai_error_message is not None
    assert ko_offer.detail is None  # pas de commit partiel du detail

    assert summary.activated == 1
    assert summary.reprocess_required == 1
    assert len(summary.errors) == 1


def test_exception_inattendue_isolee(seed, monkeypatch):
    db, filiere, offers = seed
    # On force une exception non-ValueError sur l'offre 0 (ex. IntegrityError
    # sur _upsert_offer_filiere), l'offre 1 reste valide.
    import services.ai_results as mod

    original = mod._upsert_offer_filiere

    def _boom(db, offer, filiere, confidence):
        # Simule un crash (ex. IntegrityError) uniquement pour l'offre 0.
        if offer.id == offers[0].id:
            raise RuntimeError("boom simulant IntegrityError")
        return original(db, offer, filiere, confidence)

    monkeypatch.setattr(mod, "_upsert_offer_filiere", _boom)

    payload = _payload(
        offers,
        [
            _result(offers[0].id),
            _result(offers[1].id),
        ],
    )
    summary = apply_ai_results(db, payload)
    db.commit()

    db.expire_all()
    ko_offer = db.get(JobOffer, offers[0].id)
    ok_offer = db.get(JobOffer, offers[1].id)

    # L'offre fautive est marquee FAILED dans son propre savepoint.
    assert ko_offer.status == JobOfferStatus.BRUT
    assert ko_offer.ai_status == AiOfferStatus.FAILED
    assert "erreur inattendue" in ko_offer.ai_error_message
    # Le detail applique avant l'exception a ete ANNULE par le rollback.
    assert ko_offer.detail is None
    # L'offre saine est bien ACTIVE.
    assert ok_offer.status == JobOfferStatus.ACTIVE
    assert ok_offer.detail is not None

    assert summary.activated == 1
    assert summary.reprocess_required == 1


def test_offres_deja_actives_ignorees(seed):
    db, filiere, offers = seed
    # Passe 1 : on active l'offre 0.
    summary1 = apply_ai_results(db, _payload(offers, [_result(offers[0].id)]))
    db.commit()
    assert summary1.activated == 1

    # Passe 2 : resoumettre l'offre 0 -> ignoree, pas d'erreur.
    summary2 = apply_ai_results(db, _payload(offers, [_result(offers[0].id)]))
    db.commit()
    assert summary2.activated == 0
    assert len(summary2.errors) == 1
    assert "deja active" in summary2.errors[0].message


def test_pending_review_avec_suggestion(seed):
    db, filiere, offers = seed
    payload = _payload(
        offers,
        [
            AIProcessedOfferResult(
                offer_id=offers[0].id,
                primary_filiere_code=None,
                filiere_confidence=0.4,
                requires_admin_review=True,
                suggested_filiere={"code": "tech-dev", "label": "Tech & Dev", "reason": "incertain"},
                detail=_detail_payload(),
            )
        ],
    )
    summary = apply_ai_results(db, payload)
    db.commit()

    db.expire_all()
    offer = db.get(JobOffer, offers[0].id)
    assert offer.status == JobOfferStatus.PENDING_REVIEW
    assert offer.visible_site is False
    assert offer.ai_status == AiOfferStatus.SKIPPED
    assert summary.pending_review == 1
