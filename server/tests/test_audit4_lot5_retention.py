"""Tests du Lot 5 de l'audit 4 — Rétention & performance (A.3, A.4, K.1, K.3).

Couvre :
- A.3 preventif : l'event d'ingestion ne duplique PLUS le raw_payload sur
  les actions de succes (INSERTED/DUPLICATE) ; il le CONSERVE sur FAILED
  (offre non creee, contexte debug du scraper) ;
- A.3 curatif : purge_ingestion_events a deux vitesses — payload NULL a
  15 jours, DELETE a 90 jours, par lots avec commits intermediaires ;
- A.4 : summarize_ids — details d'audit resumes (count + echantillon de 10)
  au lieu de listes exhaustives ;
- K.1 : les compteurs globaux /logs/stats et /audit/stats respectent la
  fenetre `days` (plus de full scan plein-table) ;
- K.3 : la cascade ne re-selectionne plus les paliers (meme resultat,
  moitie moins de requetes de selection).

K.2 (COUNT SQL scraping/status) a ete corrige au Lot 1 — verifie en live.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from models import IngestionAction, OfferIngestionEvent
from services.audit import IDS_SAMPLE_SIZE, summarize_ids
from tasks.maintenance import (
    INGESTION_EVENT_PAYLOAD_RETENTION_DAYS,
    INGESTION_EVENT_RETENTION_DAYS,
    purge_ingestion_events,
)

# ─── A.3 preventif : payload seulement sur echec ───────────────────────


def _seed_event(admin_db, *, action: IngestionAction, raw_payload: dict | None, created_at: datetime | None = None, offer_id=None, source_run_id=None) -> OfferIngestionEvent:
    event = OfferIngestionEvent(
        action=action,
        hash_unique="hash-test",
        raw_url="https://example.com/j",
        reason="test",
        raw_payload=raw_payload,
        offer_id=offer_id,
        source_scrape_run_id=source_run_id,
    )
    if created_at is not None:
        # TimestampMixin : server_default=now() — on force la date cote
        # Python apres le flush pour tester la retention.
        admin_db.add(event)
        admin_db.flush()
        event.created_at = created_at
    else:
        admin_db.add(event)
    return event


def test_event_inserted_ne_porte_plus_le_payload(admin_client, admin_db):
    """A.3 : l'event INSERTED n'embarque plus le raw_payload (doublon de
    JobOffer.raw_payload). Verifie via la vraie fonction _event du service."""
    import services.ingestion as ingestion_mod
    from models import OfferIngestionEvent

    before = len(admin_db.scalars(select(OfferIngestionEvent)).all())
    ingestion_mod._event(
        admin_db,
        source_run=None,
        action=IngestionAction.INSERTED,
        hash_unique="h1",
        raw_url="https://example.com/1",
        raw_payload={"title": "Offre X", "description": "payload lourd"},
    )
    ingestion_mod._event(
        admin_db,
        source_run=None,
        action=IngestionAction.DUPLICATE,
        hash_unique="h2",
        raw_url="https://example.com/2",
        raw_payload={"title": "Offre Y"},
    )
    ingestion_mod._event(
        admin_db,
        source_run=None,
        action=IngestionAction.FAILED,
        hash_unique="h3",
        raw_url="https://example.com/3",
        reason="validation",
        raw_payload={"title": "Offre Z", "rupture": "contexte debug"},
    )
    admin_db.commit()

    events = list(admin_db.scalars(select(OfferIngestionEvent).order_by(OfferIngestionEvent.created_at)).all())[before:]
    by_action = {e.action: e for e in events}
    assert by_action[IngestionAction.INSERTED].raw_payload is None, "INSERTED ne doit plus porter le payload"
    assert by_action[IngestionAction.DUPLICATE].raw_payload is None, "DUPLICATE ne doit plus porter le payload"
    assert by_action[IngestionAction.FAILED].raw_payload == {"title": "Offre Z", "rupture": "contexte debug"}


# ─── A.3 curatif : purge deux vitesses ─────────────────────────────────


def _cleanup_events(admin_db) -> None:
    """Base module-scoped : purge les events des tests precedents pour que
    les compteurs ne voient QUE les lignes de ce test."""
    admin_db.query(OfferIngestionEvent).delete(synchronize_session=False)
    admin_db.commit()


def test_purge_ingestion_events_deux_vitesses(admin_client, admin_db):
    """A.3 : payload NULL a 15 jours, ligne conservée ; DELETE a 90 jours.

    3 events :
    - recent (2 j) : payload conserve, ligne conservee ;
    - moyen (30 j) : payload NULLifie, ligne CONSERVEE (stats du mois exactes) ;
    - vieux (120 j) : ligne supprimee.
    """
    _cleanup_events(admin_db)
    now = datetime.now(UTC)
    recent_id = _seed_event(admin_db, action=IngestionAction.FAILED, raw_payload={"k": "recent"}, created_at=now - timedelta(days=2)).id
    moyen_id = _seed_event(admin_db, action=IngestionAction.FAILED, raw_payload={"k": "moyen"}, created_at=now - timedelta(days=30)).id
    vieux_id = _seed_event(admin_db, action=IngestionAction.INSERTED, raw_payload=None, created_at=now - timedelta(days=120)).id
    admin_db.commit()

    result = purge_ingestion_events.run()

    # Les IDs sont captures AVANT run() ; on reinterroge la base par requete
    # (pas par l'objet ORM, supprime/expire).
    admin_db.expire_all()
    remaining_ids = {row_id for (row_id, _payload) in admin_db.execute(select(OfferIngestionEvent.id, OfferIngestionEvent.raw_payload)).all()}
    by_id = dict(admin_db.execute(select(OfferIngestionEvent.id, OfferIngestionEvent.raw_payload)).all())

    assert result["payload_nulled"] >= 1
    assert result["deleted"] >= 1
    assert recent_id in remaining_ids and by_id[recent_id] == {"k": "recent"}, "recent : intact"
    assert moyen_id in remaining_ids and by_id[moyen_id] is None, "30 j : ligne conservée, payload NULL"
    assert vieux_id not in remaining_ids, "120 j : ligne supprimee"


def test_purge_ingestion_events_idempotente(admin_client, admin_db):
    """A.3 : rejouer la purge ne supprime rien de plus (compteurs a zero)."""
    _cleanup_events(admin_db)
    now = datetime.now(UTC)
    _seed_event(admin_db, action=IngestionAction.FAILED, raw_payload={"k": "vieux"}, created_at=now - timedelta(days=200))
    admin_db.commit()

    first = purge_ingestion_events.run()
    second = purge_ingestion_events.run()

    assert first["deleted"] >= 1
    assert second["deleted"] == 0
    assert second["payload_nulled"] == 0


def test_purge_respecte_retention_constants():
    """A.3 : les constantes de retention sont celles decidees produit."""
    assert INGESTION_EVENT_PAYLOAD_RETENTION_DAYS == 15
    assert INGESTION_EVENT_RETENTION_DAYS == 90


# ─── A.4 : details d'audit resumes ─────────────────────────────────────


def test_summarize_ids_petite_liste_conservee():
    """A.4 : <= 10 IDs — la liste entiere reste (debug des petites actions)."""
    ids = [f"offer-{i}" for i in range(5)]
    details = summarize_ids("offer_ids", ids, status="hidden")
    assert details["offer_ids"] == ids
    assert details["status"] == "hidden"


def test_summarize_ids_grande_liste_resumee():
    """A.4 : > 10 IDs — count + echantillon de 10, jamais la liste entiere."""
    ids = [f"offer-{i}" for i in range(500)]
    details = summarize_ids("offer_ids", ids, status="hidden", count=500)
    assert details["offer_ids_count"] == 500
    assert details["offer_ids_sample"] == ids[:IDS_SAMPLE_SIZE]
    assert len(details["offer_ids_sample"]) == IDS_SAMPLE_SIZE
    assert "offer_ids" not in details, "la liste exhaustive ne doit plus etre journalisee"


def test_bulk_status_journalise_un_resume(admin_client, admin_db):
    """A.4 : POST /offers/bulk-status ecrit un details resume (end-to-end)."""
    from models import Company, JobOffer, JobOfferStatus, SourceStatus
    from models.admin import AdminActionLog
    from models.enums import JobOfferOrigin
    from models.referentials import Source

    admin_db.query(AdminActionLog).delete(synchronize_session=False)

    source = Source(code="src-l5", name="Src L5", slug="src-l5", base_url="https://example.com", status=SourceStatus.ACTIVE)
    company = Company(name="Cie L5", normalized_name="cie l5", slug="cie-l5")
    admin_db.add_all([source, company])
    admin_db.flush()
    offers = []
    for i in range(12):
        offer = JobOffer(
            public_id=9000 + i,
            title=f"Offre L5 {i}",
            normalized_title=f"offre l5 {i}",
            slug=f"offre-l5-{i}",
            company_id=company.id,
            source_id=source.id,
            status=JobOfferStatus.ACTIVE,
            visible_site=True,
            source_url=f"https://example.com/{i}",
            hash_unique=f"hash-l5-{i}",
            origin=JobOfferOrigin.MANUAL,
        )
        offers.append(offer)
        admin_db.add(offer)
    admin_db.commit()

    resp = admin_client.post(
        "/api/admin/offers/bulk-status",
        json={"offer_ids": [o.id for o in offers], "status": "hidden"},
    )
    assert resp.status_code == 200, resp.text

    log = (
        admin_db.scalars(
            select(AdminActionLog)
            .where(AdminActionLog.target_table == "job_offers")
            .order_by(AdminActionLog.created_at.desc())
            .limit(1)
        )
        .first()
    )
    assert log is not None
    assert log.details.get("offer_ids_count") == 12
    assert len(log.details.get("offer_ids_sample", [])) == IDS_SAMPLE_SIZE
    assert "offer_ids" not in log.details


# ─── K.1 : compteurs fenetres ───────────────────────────────────────────


def test_logs_stats_compteurs_respectent_la_fenetre(admin_client, admin_db):
    """K.1 : un event de plus de 30 jours n'est PAS compte avec days=30."""
    _cleanup_events(admin_db)
    now = datetime.now(UTC)
    _seed_event(admin_db, action=IngestionAction.INSERTED, raw_payload=None, created_at=now - timedelta(days=40))
    _seed_event(admin_db, action=IngestionAction.INSERTED, raw_payload=None, created_at=now - timedelta(days=2))
    admin_db.commit()

    resp = admin_client.get("/api/admin/logs/stats?days=30")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Les 2 events existent en base, mais la fenetre de 30 jours n'en voit
    # qu'un ; le compteur global suit la meme fenetre que les axes (K.1).
    assert body["events_total"] == 1
    assert sum(j["total"] for j in body["events_par_jour"]) == 1

    # Fenetre large : les 2 events reviennent.
    resp90 = admin_client.get("/api/admin/logs/stats?days=90")
    body90 = resp90.json()
    assert body90["events_total"] == 2


def test_audit_stats_total_respecte_la_fenetre(admin_client, admin_db):
    """K.1 : le total /audit/stats porte sur la fenetre days, plus plein-table."""
    from models.admin import AdminActionLog
    from models.enums import AdminAction as AdminActionEnum

    admin_db.query(AdminActionLog).delete(synchronize_session=False)
    now = datetime.now(UTC)
    admin_db.add_all(
        [
            AdminActionLog(admin_id="x", action=AdminActionEnum.UPDATE, target_table="t", created_at=now - timedelta(days=40)),
            AdminActionLog(admin_id="x", action=AdminActionEnum.UPDATE, target_table="t", created_at=now - timedelta(days=1)),
        ]
    )
    admin_db.commit()

    resp = admin_client.get("/api/admin/logs/audit/stats?days=30")
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1

    resp90 = admin_client.get("/api/admin/logs/audit/stats?days=90")
    assert resp90.json()["total"] == 2


def test_ai_stats_suggestions_fenetrees(admin_client, admin_db):
    """K.1 : suggestions_par_statut respecte la fenetre days."""
    from models import AIFiliereSuggestion
    from models.enums import AIFiliereSuggestionStatus

    admin_db.query(AIFiliereSuggestion).delete(synchronize_session=False)
    now = datetime.now(UTC)
    s_old = AIFiliereSuggestion(code="l5-old", label="Vieux", status=AIFiliereSuggestionStatus.PENDING, created_at=now - timedelta(days=40))
    s_new = AIFiliereSuggestion(code="l5-new", label="Neuf", status=AIFiliereSuggestionStatus.PENDING, created_at=now - timedelta(days=2))
    admin_db.add_all([s_old, s_new])
    admin_db.commit()

    resp = admin_client.get("/api/admin/ai/stats?days=30")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    pending = body["suggestions_par_statut"].get("pending", 0)
    assert pending == 1, "seule la suggestion des 30 derniers jours doit etre comptee"


# ─── K.3 : cascade sans re-selection ───────────────────────────────────


def test_cascade_reutilise_les_offres_accumulees(admin_client, admin_db, monkeypatch):
    """K.3 : select_with_cascade n'appelle _select_for_tier qu'une fois par
    palier — plus de seconde passe de reconstruction.

    NB: admin_client est demandee uniquement pour son create_all module-scoped
    (piege documente : sans appel HTTP, la fixture reste OBLIGATOIRE pour que
    la base existe en execution isolee).
    """

    import services.digest_cascade_selector as cascade_mod
    from models import ContractType, ExperienceLevel, Filiere, Subscriber, SubscriberFiliere, SubscriberStatus

    # Referentiels + abonne minimal (pattern _make_subscriber de
    # test_digest_cascade.py — inscrit AVANT la fenetre de fraicheur).
    filiere = Filiere(code="l5-casc", slug="l5-casc", label="L5 Cascade")
    contract = ContractType(code="l5-cdi", label="CDI L5")
    experience = ExperienceLevel(code="l5-jun", label="Junior L5")
    admin_db.add_all([filiere, contract, experience])
    admin_db.flush()
    sub = Subscriber(
        email="l5-cascade@example.com",
        email_normalized="l5-cascade@example.com",
        full_name="L5 Cascade",
        city="Abidjan",
        status=SubscriberStatus.ACTIVE,
        experience_level_id=experience.id,
        subscribed_at=datetime.now(UTC) - timedelta(days=31),
        confirmed_at=datetime.now(UTC) - timedelta(days=30),
    )
    admin_db.add(sub)
    admin_db.flush()
    admin_db.add(SubscriberFiliere(subscriber_id=sub.id, filiere_id=filiere.id, priority=1))
    admin_db.commit()

    calls: list[str] = []
    real_select = cascade_mod._select_for_tier

    def counting_select(db, subscriber, *, tier, settings):
        calls.append(tier)
        return real_select(db, subscriber, tier=tier, settings=settings)

    monkeypatch.setattr(cascade_mod, "_select_for_tier", counting_select)

    outcome = cascade_mod.select_with_cascade(admin_db, subscriber=sub, max_tier="T5")
    # K.3 : chaque palier T1..T5 est execute EXACTEMENT une fois (plus de
    # boucle de reconstruction). T0 peut apparaitre 2x par design : l'appel
    # direct de select_with_cascade + l'appel interne de _select_for_tier
    # T1 (T1 = T0 + filieres secondaires) — ce n'est PAS une re-selection.
    for tier in ("T1", "T2", "T3", "T4", "T5"):
        assert calls.count(tier) == 1, f"{tier} execute {calls.count(tier)} fois (re-selection ?)"
    assert calls.count("T0") <= 2
    # Coherence du contrat : soit insufficient, soit des offres classees.
    if not outcome.insufficient:
        assert len(outcome.selected_offers) == len(outcome.match_kinds)
        assert all(kind for kind in outcome.match_kinds)
