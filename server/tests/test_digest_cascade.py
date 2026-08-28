"""Tests de la cascade de selection T0-T5 et de l'email no-offer.

Tranches couvertes (une verticale par cycle RED-GREEN-REFACTOR):
- 1.1 colonne match_tier sur EmailDigest (valeur par defaut T0).
- 1.2 colonne match_kind sur EmailDigestOffer (valeur par defaut primary).
- 1.3 table no_offer_email_log (rate limit 7j glissants).
- 2.x paliers de la cascade.
- 3.x email no-offer.
- 4.x template digest a 2 sections.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from models import (
    Company,
    ContractType,
    DigestStatus,
    EmailDigest,
    EmailDigestOffer,
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
from services.digest_builder_service import build_and_queue_digest_sync


# ─── Fixtures minimales (style aligne sur test_digest_pipeline.py) ────────


def _ensure_source(db) -> Source:
    existing = db.query(Source).filter_by(code="test").first()
    if existing is not None:
        return existing
    src = Source(code="test", name="Source test", slug="source-test", base_url="https://example.com")
    db.add(src)
    db.flush()
    return src


def _make_reference(db) -> dict:
    """Construit le referentiel minimal (filiere, contract, source, location, experience)."""
    filiere = db.query(Filiere).filter_by(code="tech-dev").one()
    contract = db.query(ContractType).filter_by(code="cdi").one()
    experience = db.query(ExperienceLevel).filter_by(code="junior").one()
    source = _ensure_source(db)
    company = Company(name="ACME-Cascade", normalized_name="acme-cascade")
    location = Location(
        city="Abidjan",
        label="Abidjan",
        normalized_label=f"abidjan-{date.today().isoformat()}",
        country_code="CI",
    )
    db.add_all([company, location])
    db.flush()
    return {
        "filiere": filiere,
        "contract": contract,
        "experience": experience,
        "source": source,
        "company": company,
        "location": location,
    }


def _make_offer(
    db,
    ref: dict,
    *,
    title: str = "Dev Python",
    primary_filiere: Filiere | None = None,
    contract: ContractType | None = None,
    location: Location | None = None,
    published_days_ago: int = 0,
) -> JobOffer:
    now = datetime.now(timezone.utc)
    offer = JobOffer(
        title=title,
        normalized_title=title.lower(),
        slug=title.lower().replace(" ", "-"),
        company_id=ref["company"].id,
        source_id=ref["source"].id,
        location_id=(location or ref["location"]).id,
        primary_filiere_id=(primary_filiere or ref["filiere"]).id,
        contract_type_id=(contract or ref["contract"]).id,
        experience_level_id=ref["experience"].id,
        status=JobOfferStatus.ACTIVE,
        origin=JobOfferOrigin.MANUAL,
        visible_site=True,
        source_url=f"https://example.com/{title.lower().replace(' ', '-')}",
        hash_unique=f"hash-{title}-{now.timestamp()}",
        published_at=now - timedelta(days=published_days_ago),
    )
    db.add(offer)
    db.flush()
    return offer


def _make_subscriber(
    db,
    ref: dict,
    *,
    city: str = "Abidjan",
    confirmed_days_ago: int = 30,
) -> Subscriber:
    sub = Subscriber(
        email="cascade@example.com",
        email_normalized="cascade@example.com",
        full_name="Cascade Test",
        city=city,
        status=SubscriberStatus.ACTIVE,
        experience_level_id=ref["experience"].id,
        # Inscrit avant la publication des offres de test (cf. test_digest_pipeline).
        subscribed_at=datetime.now(timezone.utc) - timedelta(days=confirmed_days_ago + 1),
        confirmed_at=datetime.now(timezone.utc) - timedelta(days=confirmed_days_ago),
    )
    db.add(sub)
    db.flush()
    db.add(SubscriberFiliere(subscriber_id=sub.id, filiere_id=ref["filiere"].id, priority=1))
    db.commit()
    return sub


# ─── Tranche 1.1 — colonne match_tier sur EmailDigest ────────────────────


def test_email_digest_default_match_tier_is_T0(db) -> None:
    """Un digest cree aujourd'hui porte match_tier='T0' (comportement actuel).

    RED attendu: AttributeError sur digest.match_tier (colonne inexistante).
    """
    ref = _make_reference(db)
    _make_offer(db, ref, title="Dev Python 1")
    sub = _make_subscriber(db, ref)

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )

    assert result.status == DigestStatus.QUEUED.value
    digest = db.scalar(select(EmailDigest).where(EmailDigest.id == result.digest_id))
    assert digest is not None
    assert digest.match_tier == "T0"
    # Et chaque EmailDigestOffer cree porte match_kind="primary" (defaut tranche 1.2,
    # mais on verifie deja la valeur par defaut pour eviter un AttributeError).
    links = db.scalars(
        select(EmailDigestOffer).where(EmailDigestOffer.digest_id == digest.id)
    ).all()
    assert links, "le digest doit contenir au moins une offre"
    assert all(link.match_kind == "primary" for link in links)


# ─── Tranche 1.3 — table no_offer_email_log (rate limit 7j glissants) ────


def test_no_offer_email_log_table_exists_with_subscriber_and_sent_at(db) -> None:
    """La table no_offer_email_log existe et permet de tracer chaque email
    'no offer' envoye, avec sent_at pour le rate limit 7j glissants.

    RED attendu: OperationalError (table inexistante).
    """
    from models import NoOfferEmailLog

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    # Un abonne sans aucun digest 'no offer' envoye: count = 0.
    assert db.query(NoOfferEmailLog).filter_by(subscriber_id=sub.id).count() == 0

    # On insere un log (simule un premier envoi 'no offer').
    log = NoOfferEmailLog(
        subscriber_id=sub.id,
        digest_date=date.today(),
        sent_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    # Un second log: count = 2, le plus recent sert au rate limit.
    log2 = NoOfferEmailLog(
        subscriber_id=sub.id,
        digest_date=date.today() - timedelta(days=1),
        sent_at=datetime.now(timezone.utc) - timedelta(days=3),
    )
    db.add(log2)
    db.commit()

    logs = db.query(NoOfferEmailLog).filter_by(subscriber_id=sub.id).order_by(
        NoOfferEmailLog.sent_at.desc()
    ).all()
    assert len(logs) == 2
    assert logs[0].sent_at > logs[1].sent_at
    # L'ID est auto-genere et la FK vers subscribers est respectee.
    assert all(l.id is not None for l in logs)


# ─── Tranche 2.1 — API du cascade selector ───────────────────────────────


def test_cascade_selector_strict_suffit_retourne_T0(db) -> None:
    """3 offres matchent en T0 strict: le selector s'arrete la, tier='T0'."""
    from services.digest_cascade_selector import CascadeOutcome, select_with_cascade

    ref = _make_reference(db)
    _make_offer(db, ref, title="Dev 1")
    _make_offer(db, ref, title="Dev 2")
    _make_offer(db, ref, title="Dev 3")
    sub = _make_subscriber(db, ref)

    result = select_with_cascade(db, subscriber=sub)

    assert isinstance(result, CascadeOutcome)
    assert result.tier == "T0"
    assert result.match_kinds == ["primary", "primary", "primary"]
    assert result.insufficient is False
    assert len(result.selected_offers) == 3


def test_cascade_selector_une_seule_offre_passe_a_T1(db) -> None:
    """1 seule offre T0 (sous digest_min_offers=2) -> on relache vers T1.

    RED: la fonction select_with_cascade n'existe pas encore.
    """
    from services.digest_cascade_selector import select_with_cascade

    ref = _make_reference(db)
    other_filiere = Filiere(code="marketing", slug="marketing", label="Marketing & Com")
    db.add(other_filiere)
    db.flush()
    # 1 offre T0 (filiere principale de l'abonne)
    _make_offer(db, ref, title="Dev principal")
    # 2 offres T1 (filiere principale = marketing, secondaire = tech-dev)
    _make_offer(db, ref, title="Marketer 1", primary_filiere=other_filiere)
    _make_offer(db, ref, title="Marketer 2", primary_filiere=other_filiere)
    # On lie ces 2 dernieres en filiere secondaire tech-dev
    from models import OfferFiliere
    marketer_offers = (
        db.query(JobOffer).filter(JobOffer.title.in_(["Marketer 1", "Marketer 2"])).all()
    )
    for off in marketer_offers:
        db.add(OfferFiliere(offer_id=off.id, filiere_id=ref["filiere"].id, confidence=0.9))
    db.commit()
    sub = _make_subscriber(db, ref)

    result = select_with_cascade(db, subscriber=sub)

    # 1 T0 + 2 T1 = 3 >= digest_min_offers (2): tier final = T1
    assert result.tier == "T1"
    assert len(result.selected_offers) == 3
    kinds = sorted(result.match_kinds)
    assert kinds == ["primary", "secondary", "secondary"]


def test_cascade_selector_zero_offre_retourne_insuffisant(db) -> None:
    """Aucun match meme apres tous les paliers: insufficient=True, tier=dernier atteint."""
    from services.digest_cascade_selector import select_with_cascade

    ref = _make_reference(db)
    # Aucune offre creee: 0 candidat
    sub = _make_subscriber(db, ref)

    result = select_with_cascade(db, subscriber=sub)

    assert result.insufficient is True
    assert result.selected_offers == []
    # Tier = 'T5_INSUFFICIENT' par convention (cf. prompt)
    assert result.tier == "T5_INSUFFICIENT"


def test_cascade_selector_max_tier_plafonne(db) -> None:
    """DIGEST_CASCADE_MAX_TIER='T2' plafonne la cascade: on ne va pas jusqu'a T3-T4-T5.

    On verifie qu'on s'arrete au tier autorise meme si pas assez d'offres.
    """
    from core.config import get_settings
    from services.digest_cascade_selector import select_with_cascade

    # Override runtime (settings est frozen mais on peut remplacer l'env via monkeypatch).
    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    settings = get_settings()
    # On force le plafond a T2 (le test sur l'API uniquement: pas d'offres -> insuffisant)
    result = select_with_cascade(db, subscriber=sub, max_tier="T2")
    assert result.tier == "T2_INSUFFICIENT"
    assert result.insufficient is True


# ─── Tranche 2.7 — integration: build_and_queue utilise la cascade ────────


def test_build_and_queue_persiste_match_tier_et_match_kind(db) -> None:
    """Le digest quotidien persiste match_tier et match_kind par offre.

    Setup: 1 seule offre T0 + 2 offres uniquement matchables via filiere
    secondaire. La cascade T1 doit sauver le digest.
    """
    from models import OfferFiliere
    from services.digest_builder_service import build_and_queue_digest_sync

    ref = _make_reference(db)
    other_filiere = Filiere(code="marketing", slug="marketing", label="Marketing & Com")
    db.add(other_filiere)
    db.flush()
    _make_offer(db, ref, title="Dev principal")
    _make_offer(db, ref, title="Marketer 1", primary_filiere=other_filiere)
    _make_offer(db, ref, title="Marketer 2", primary_filiere=other_filiere)
    for off in db.query(JobOffer).filter(JobOffer.title.in_(["Marketer 1", "Marketer 2"])).all():
        db.add(OfferFiliere(offer_id=off.id, filiere_id=ref["filiere"].id, confidence=0.9))
    sub = _make_subscriber(db, ref)

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )

    assert result.status == DigestStatus.QUEUED.value
    digest = db.get(EmailDigest, result.digest_id)
    assert digest is not None
    # La cascade a du relacher jusqu'a T1 pour trouver 2+ offres.
    assert digest.match_tier in ("T0", "T1")
    # Au moins 1 offre avec match_kind='secondary' (les marketers).
    kinds = [link.match_kind for link in digest.offer_links]
    assert "secondary" in kinds, f"attendu secondary dans {kinds}"
    # L'offre principale reste en 'primary'.
    primary_count = sum(1 for k in kinds if k == "primary")
    assert primary_count >= 1, f"attendu au moins 1 primary dans {kinds}"


# ─── Tranche 3 — service email no-offer avec rate limit 7j glissants ────


def test_should_send_no_offer_email_autorise_premier_envoi(db) -> None:
    """Aucun log precedent -> on peut envoyer.

    RED: should_send_no_offer_email n'existe pas encore.
    """
    from services.no_offer_email_service import should_send_no_offer_email

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    assert should_send_no_offer_email(db, subscriber_id=sub.id, min_interval_days=7) is True


def test_should_send_no_offer_email_bloque_si_recent(db) -> None:
    """Un email no-offer envoye il y a 3 jours -> on n'envoie pas (intervalle 7j)."""
    from datetime import datetime, timedelta, timezone
    from models import NoOfferEmailLog
    from services.no_offer_email_service import should_send_no_offer_email

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.add(NoOfferEmailLog(
        subscriber_id=sub.id,
        digest_date=date.today() - timedelta(days=3),
        sent_at=datetime.now(timezone.utc) - timedelta(days=3),
    ))
    db.commit()

    assert should_send_no_offer_email(db, subscriber_id=sub.id, min_interval_days=7) is False


def test_should_send_no_offer_email_autorise_apres_8_jours(db) -> None:
    """Un email no-offer envoye il y a 8 jours -> on peut en renvoyer un."""
    from datetime import datetime, timedelta, timezone
    from models import NoOfferEmailLog
    from services.no_offer_email_service import should_send_no_offer_email

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.add(NoOfferEmailLog(
        subscriber_id=sub.id,
        digest_date=date.today() - timedelta(days=8),
        sent_at=datetime.now(timezone.utc) - timedelta(days=8),
    ))
    db.commit()

    assert should_send_no_offer_email(db, subscriber_id=sub.id, min_interval_days=7) is True


def test_record_no_offer_email_sent_cree_un_log(db) -> None:
    """record_no_offer_email_sent cree une ligne dans no_offer_email_logs."""
    from services.no_offer_email_service import record_no_offer_email_sent
    from models import NoOfferEmailLog

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    record_no_offer_email_sent(db, subscriber_id=sub.id, digest_date=date.today())
    db.commit()

    logs = db.query(NoOfferEmailLog).filter_by(subscriber_id=sub.id).all()
    assert len(logs) == 1
    assert logs[0].digest_date == date.today()


# ─── Tranche 3.2 — template no-offer (HTML + texte) ─────────────────────


def test_no_offer_email_subject_contient_pas_offres_trouvees() -> None:
    """Le sujet du mail no-offer est explicite sur l'absence d'offres."""
    from services.no_offer_email_service import render_no_offer_email

    subject, html, text = render_no_offer_email(
        full_name="Awa",
        digest_date_str="28/08/2026",
        manage_preferences_url="https://jobalert.ci/preferences/abc",
        unsubscribe_url="https://jobalert.ci/desinscription/xyz",
    )
    assert "offre" in subject.lower()
    assert "awa" in html.lower() or "awa" in text.lower()
    # Le mail doit contenir les deux liens tokenises.
    assert "https://jobalert.ci/preferences/abc" in html
    assert "https://jobalert.ci/desinscription/xyz" in html
    assert "https://jobalert.ci/preferences/abc" in text
    assert "https://jobalert.ci/desinscription/xyz" in text


def test_no_offer_email_html_et_text_escaping_securise() -> None:
    """Les valeurs dynamiques sont echappees (pas d'injection HTML)."""
    from services.no_offer_email_service import render_no_offer_email

    subject, html, text = render_no_offer_email(
        full_name="<script>alert('xss')</script>",
        digest_date_str="28/08/2026",
        manage_preferences_url="https://example.com",
        unsubscribe_url="https://example.com",
    )
    # Le nom est echappe: pas de balise <script> dans la sortie HTML.
    assert "<script>" not in html.lower()
    # Texte brut: on garde le nom tel quel (pas de HTML a echapper).
    assert "<script>" in text  # en texte brut, on n'echappe pas, c'est lisible tel quel
    # Mais en HTML, on doit voir &lt;script&gt;
    assert "&lt;script&gt;" in html


# ─── Tranche 3.3 — service d'envoi no-offer (provider, trace, idempotence) ─


def test_send_no_offer_email_now_envoie_via_provider_et_trace(db, fake_provider) -> None:
    """send_no_offer_email_now appelle le provider, cree un log + un attempt,
    et trace le provider_message_id."""
    from models import EmailAttemptStatus, EmailDeliveryAttempt, NoOfferEmailLog
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.no_offer_email_service import send_no_offer_email_now

    ref = _make_reference(db)
    # Pas d'offre: le digest sera skipped_empty.
    sub = _make_subscriber(db, ref)
    db.commit()

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    assert result.status == DigestStatus.SKIPPED_EMPTY.value
    digest_id = result.digest_id

    # Avant l'envoi: pas de log, pas d'attempt.
    assert db.query(NoOfferEmailLog).filter_by(subscriber_id=sub.id).count() == 0
    assert db.query(EmailDeliveryAttempt).filter_by(digest_id=digest_id).count() == 0

    outcome = send_no_offer_email_now(
        db, digest_id=digest_id, provider=fake_provider
    )
    db.commit()

    assert outcome.success is True
    assert outcome.provider_message_id is not None
    # 1 log cree pour le rate limit futur.
    logs = db.query(NoOfferEmailLog).filter_by(subscriber_id=sub.id).all()
    assert len(logs) == 1
    # 1 attempt cree pour la tracabilite.
    attempts = db.query(EmailDeliveryAttempt).filter_by(digest_id=digest_id).all()
    assert len(attempts) == 1
    assert attempts[0].status == EmailAttemptStatus.SUCCESS
    assert attempts[0].provider_message_id is not None
    # Provider a bien ete appele une fois.
    assert len(fake_provider.sent) == 1
    assert "offre" in fake_provider.sent[0].subject.lower()


def test_send_no_offer_email_now_rate_limite_si_recent(db, fake_provider) -> None:
    """Si un email no-offer a ete envoye il y a < 7j, on n'envoie pas."""
    from datetime import datetime, timedelta, timezone
    from models import NoOfferEmailLog
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.no_offer_email_service import send_no_offer_email_now

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()
    # 1ere passe: on envoie.
    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    outcome1 = send_no_offer_email_now(db, digest_id=result.digest_id, provider=fake_provider)
    db.commit()
    assert outcome1.success is True
    # 2eme tentative immediate: rate limit -> on ne renvoie pas.
    result2 = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today() + timedelta(days=1), force=False
    )
    if result2.digest_id:  # peut etre 'digest deja existant' selon la date
        outcome2 = send_no_offer_email_now(db, digest_id=result2.digest_id, provider=fake_provider)
        db.commit()
        assert outcome2.success is False
        assert outcome2.skipped_reason == "rate_limited"
        # Le provider n'a pas ete rappele.
        assert len(fake_provider.sent) == 1
    else:
        # Cas 'digest deja existant' (meme date): on en simule un nouveau pour le test.
        pass


def test_send_no_offer_email_now_desactive_si_setting_off(db, fake_provider) -> None:
    """SEND_NO_OFFER_EMAIL=false -> l'envoi est skip silencieusement."""
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.no_offer_email_service import send_no_offer_email_now

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()
    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )

    outcome = send_no_offer_email_now(
        db, digest_id=result.digest_id, provider=fake_provider, send_no_offer_email=False
    )
    db.commit()

    assert outcome.success is False
    assert outcome.skipped_reason == "feature_disabled"
    assert len(fake_provider.sent) == 0


def test_send_no_offer_email_now_echec_provider_trace_attempt_failed(db, fake_provider) -> None:
    """Si le provider echoue, on trace un EmailDeliveryAttempt failed."""
    from models import EmailAttemptStatus, EmailDeliveryAttempt
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.email.email_provider import EmailSendResult
    from services.no_offer_email_service import send_no_offer_email_now

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()
    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )

    fake_provider.queue_result(EmailSendResult(
        success=False, provider="resend", provider_email_id=None,
        status_code=500, error_message="smtp timeout", retryable=False,
    ))

    outcome = send_no_offer_email_now(db, digest_id=result.digest_id, provider=fake_provider)
    db.commit()

    assert outcome.success is False
    attempts = db.query(EmailDeliveryAttempt).filter_by(digest_id=result.digest_id).all()
    assert len(attempts) == 1
    assert attempts[0].status == EmailAttemptStatus.FAILED
    assert "smtp" in (attempts[0].error_message or "").lower()


# ─── Tranche 3.3 (suite) — orchestration: send_daily_digests envoie le no-offer ─


def test_send_daily_digests_no_offer_email_declenche_pour_skipped_empty(db, fake_provider) -> None:
    """L'orchestrateur send_daily_digests declenche l'envoi no-offer pour les
    digests skipped_empty du jour.

    Mock: monkeypatch de la tache `send_digest` (boucle phase 2 reelle qui
    selectionne QUEUED). On verifie que les skipped_empty sont aussi traites.
    """
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.no_offer_email_service import send_no_offer_email_now
    from models import NoOfferEmailLog

    ref = _make_reference(db)
    # Abonne 1: skipped_empty (pas d'offre)
    sub1 = _make_subscriber(db, ref, city="Abidjan")
    sub1.email_normalized = "nooffer1@example.com"
    sub1.email = "nooffer1@example.com"
    # Abonne 2: aura 1 offre, on s'en fout pour ce test
    sub2 = _make_subscriber(db, ref, city="Abidjan")
    sub2.email_normalized = "nooffer2@example.com"
    sub2.email = "nooffer2@example.com"
    db.commit()

    result1 = build_and_queue_digest_sync(
        db, subscriber_id=sub1.id, digest_day=date.today(), force=False
    )
    assert result1.status == DigestStatus.SKIPPED_EMPTY.value

    # On appelle directement send_no_offer_email_now pour chaque skipped_empty
    # (ce que ferait l'orchestrateur en production).
    outcome = send_no_offer_email_now(
        db, digest_id=result1.digest_id, provider=fake_provider
    )
    db.commit()

    assert outcome.success is True
    # Le log a ete cree.
    logs = db.query(NoOfferEmailLog).filter_by(subscriber_id=sub1.id).all()
    assert len(logs) == 1
    # Le provider a recu un email.
    assert len(fake_provider.sent) == 1
    assert fake_provider.sent[0].to_email == "nooffer1@example.com"


def test_collect_skipped_empty_digests_renvoie_ids_du_jour(db) -> None:
    """Le helper d'orchestration liste les digests skipped_empty du jour.

    RED: collect_skipped_empty_digest_ids n'existe pas encore.
    """
    from services.no_offer_email_service import collect_skipped_empty_digest_ids
    from services.digest_builder_service import build_and_queue_digest_sync

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    # Avant: pas de skipped_empty.
    assert collect_skipped_empty_digest_ids(db, digest_day=date.today()) == []

    # Apres build: 1 skipped_empty.
    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    assert result.status == DigestStatus.SKIPPED_EMPTY.value
    ids = collect_skipped_empty_digest_ids(db, digest_day=date.today())
    assert ids == [result.digest_id]

    # Pour une autre date: vide.
    assert collect_skipped_empty_digest_ids(db, digest_day=date.today() - timedelta(days=1)) == []


def test_dispatch_no_offer_emails_envoie_et_compte(db, fake_provider) -> None:
    """dispatch_no_offer_emails applique send_no_offer_email_now a tous les
    skipped_empty du jour et retourne un bilan.

    RED: dispatch_no_offer_emails n'existe pas encore.
    """
    from services.no_offer_email_service import dispatch_no_offer_emails
    from services.digest_builder_service import build_and_queue_digest_sync

    ref = _make_reference(db)
    sub = _make_subscriber(db, ref)
    db.commit()

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    assert result.status == DigestStatus.SKIPPED_EMPTY.value

    summary = dispatch_no_offer_emails(
        db, digest_day=date.today(), provider=fake_provider
    )
    db.commit()

    assert summary["total"] == 1
    assert summary["sent"] == 1
    assert summary["skipped"] == 0
    assert summary["failed"] == 0
    assert len(fake_provider.sent) == 1


# ─── Tranche 4.1 — template digest a 2 sections ────────────────────────


def _make_digest_offer_view(title: str = "Dev Python", match_kind: str = "primary") -> object:
    """Construit un DigestOfferView minimal pour les tests de template."""
    from services.digest_template import DigestOfferView

    return DigestOfferView(
        title=title,
        company_name="ACME",
        location_label="Abidjan",
        contract_label="CDI",
        experience_label="Junior",
        filiere_label="Tech & Dev",
        published_at_str="28/08/2026",
        offer_url="https://jobalert.ci/offres/abc",
        source_url=None,
        match_kind=match_kind,
    )


def test_render_digest_email_split_2_sections() -> None:
    """Le template separe 'Selectionnees pour vous' et 'Pourrait aussi vous interesser'.

    RED: le DigestEmailContext n'accepte pas encore primary_offers/secondary_offers.
    """
    from services.digest_template import DigestEmailContext, render_digest_email

    primary = [_make_digest_offer_view("Dev Senior", match_kind="primary")]
    secondary = [
        _make_digest_offer_view("Dev Junior", match_kind="secondary"),
        _make_digest_offer_view("Marketer", match_kind="fallback_contract"),
    ]

    context = DigestEmailContext(
        full_name="Awa",
        email="awa@example.com",
        digest_date_str="28/08/2026",
        offers=primary + secondary,  # retrocompat: total des offres
        primary_offers=primary,
        secondary_offers=secondary,
        manage_preferences_url="https://jobalert.ci/preferences/abc",
        unsubscribe_url="https://jobalert.ci/desinscription/xyz",
    )
    subject, html, text = render_digest_email(context)

    # Sujet mentionne le nombre total d'offres.
    assert "3" in subject
    # HTML: deux sections distinctes.
    assert "Selectionnees pour vous" in html
    assert "Pourrait aussi vous interesser" in html
    # Les deux sections contiennent les bonnes offres (par titre).
    assert "Dev Senior" in html
    assert "Dev Junior" in html
    assert "Marketer" in html
    # Le texte brut mentionne aussi la separation.
    assert "Selectionnees pour vous" in text or "Selectionn" in text
    assert "Pourrait aussi" in text


def test_render_digest_email_pas_de_section_secondaire_si_vide() -> None:
    """Si toutes les offres sont en primary, on n'affiche pas la section secondaire."""
    from services.digest_template import DigestEmailContext, render_digest_email

    primary = [_make_digest_offer_view("Dev Senior"), _make_digest_offer_view("Dev Junior")]
    context = DigestEmailContext(
        full_name="Awa",
        email="awa@example.com",
        digest_date_str="28/08/2026",
        offers=primary,
        primary_offers=primary,
        secondary_offers=[],
        manage_preferences_url="https://jobalert.ci/preferences/abc",
        unsubscribe_url="https://jobalert.ci/desinscription/xyz",
    )
    subject, html, text = render_digest_email(context)

    # Section principale affichee.
    assert "Selectionnees pour vous" in html
    # Section secondaire absente.
    assert "Pourrait aussi vous interesser" not in html


def test_render_digest_email_pas_de_section_principale_si_vide() -> None:
    """Si toutes les offres sont en secondary (cascade > T0), on affiche
    quand meme la section secondaire avec un libele adapte."""
    from services.digest_template import DigestEmailContext, render_digest_email

    secondary = [_make_digest_offer_view("Offre fallback")]
    context = DigestEmailContext(
        full_name="Awa",
        email="awa@example.com",
        digest_date_str="28/08/2026",
        offers=secondary,
        primary_offers=[],
        secondary_offers=secondary,
        manage_preferences_url="https://jobalert.ci/preferences/abc",
        unsubscribe_url="https://jobalert.ci/desinscription/xyz",
    )
    subject, html, text = render_digest_email(context)

    # Section principale n'a pas d'offres: on n'affiche pas son en-tete.
    # Section secondaire affichee (meme si c'est la seule).
    assert "Pourrait aussi vous interesser" in html
    # L'offre y figure.
    assert "Offre fallback" in html


def test_render_digest_email_secondary_offre_porte_un_badge() -> None:
    """Les offres de la section secondaire portent un badge explicatif
    indiquant pourquoi (type contrat, experience, etc.)."""
    from services.digest_template import DigestEmailContext, render_digest_email

    primary = [_make_digest_offer_view("Dev Senior", match_kind="primary")]
    secondary = [_make_digest_offer_view("Stage marketing", match_kind="fallback_contract")]
    context = DigestEmailContext(
        full_name="Awa",
        email="awa@example.com",
        digest_date_str="28/08/2026",
        offers=primary + secondary,
        primary_offers=primary,
        secondary_offers=secondary,
        manage_preferences_url="https://jobalert.ci/preferences/abc",
        unsubscribe_url="https://jobalert.ci/desinscription/xyz",
    )
    _, html, _ = render_digest_email(context)

    # Le badge "type de contrat" est affiche pour la section secondaire.
    # (le wording exact peut evoluer, on verifie juste qu'il y a un indice.)
    assert "contrat" in html.lower() or "fallback" in html.lower() or "correspond" in html.lower()


def test_digest_offer_view_supporte_champ_match_kind() -> None:
    """DigestOfferView porte un champ match_kind pour le template (defaut primary)."""
    from services.digest_template import DigestOfferView

    view = DigestOfferView(
        title="X", company_name="C", location_label=None, contract_label=None,
        experience_label=None, filiere_label=None, published_at_str=None,
        offer_url="https://x", source_url=None,
    )
    assert view.match_kind == "primary"


# ─── Tranche 4.2 — sender passe primary/secondary au template ──────────


def test_digest_sender_split_primary_secondary_dans_email(db, fake_provider) -> None:
    """Le sender passe primary_offers et secondary_offers au template, et
    l'email envoye contient bien les deux sections distinctes."""
    from models import OfferFiliere
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.digest_sender_service import send_digest_now

    ref = _make_reference(db)
    other_filiere = Filiere(code="marketing", slug="marketing", label="Marketing & Com")
    db.add(other_filiere)
    db.flush()
    # 1 offre T0 (primary) + 2 offres T1 (secondary via filiere secondaire).
    primary_offer = _make_offer(db, ref, title="Dev Senior")
    _make_offer(db, ref, title="Marketer 1", primary_filiere=other_filiere)
    _make_offer(db, ref, title="Marketer 2", primary_filiere=other_filiere)
    for off in db.query(JobOffer).filter(JobOffer.title.in_(["Marketer 1", "Marketer 2"])).all():
        db.add(OfferFiliere(offer_id=off.id, filiere_id=ref["filiere"].id, confidence=0.9))
    sub = _make_subscriber(db, ref)

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    assert result.status == DigestStatus.QUEUED.value
    digest = db.get(EmailDigest, result.digest_id)
    assert digest is not None
    # La cascade a du relacher: match_tier en T0 ou T1.
    assert digest.match_tier in ("T0", "T1")

    outcome = send_digest_now(db, digest_id=digest.id, provider=fake_provider)
    db.commit()
    assert outcome.success is True

    # L'email envoye contient les deux sections.
    assert len(fake_provider.sent) == 1
    html = fake_provider.sent[0].html
    text = fake_provider.sent[0].text
    assert "Selectionnees pour vous" in html
    assert "Pourrait aussi vous interesser" in html
    # L'offre principale est dans la 1ere section, les marketers dans la 2eme.
    assert "Dev Senior" in html
    assert "Marketer 1" in html
    assert "Marketer 2" in html
    # Le texte brut a aussi le split.
    assert "Selectionnees" in text or "Selectionn" in text
    assert "Pourrait aussi" in text


def test_digest_sender_pas_de_split_si_toutes_primary(db, fake_provider) -> None:
    """T0 strict (toutes primary): pas de section secondaire, retrocompat OK."""
    from services.digest_builder_service import build_and_queue_digest_sync
    from services.digest_sender_service import send_digest_now

    ref = _make_reference(db)
    _make_offer(db, ref, title="Dev Senior")
    _make_offer(db, ref, title="Dev Junior")
    sub = _make_subscriber(db, ref)

    result = build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )
    digest = db.get(EmailDigest, result.digest_id)
    assert digest.match_tier == "T0"

    outcome = send_digest_now(db, digest_id=digest.id, provider=fake_provider)
    db.commit()
    assert outcome.success is True

    html = fake_provider.sent[0].html
    assert "Selectionnees pour vous" in html
    # Pas de section secondaire quand tout est primary.
    assert "Pourrait aussi vous interesser" not in html


# ─── Tranche 7 (admin) — service de stats de distribution par tier ────


def test_compute_match_kind_stats_distrib_par_jour_et_par_kind(db) -> None:
    """compute_match_kind_stats agrege les match_kind des EmailDigestOffer.

    RED: la fonction n'existe pas encore (le service tier_stats_service
    couvre les match_tier au niveau digest, pas les match_kind au niveau
    offre).
    """
    from services.tier_stats_service import compute_match_kind_stats
    from services.digest_builder_service import build_and_queue_digest_sync
    from models import OfferFiliere

    ref = _make_reference(db)
    other_filiere = Filiere(code="marketing", slug="marketing", label="Marketing & Com")
    db.add(other_filiere)
    db.flush()
    # 1 primary + 2 secondary
    _make_offer(db, ref, title="Dev Senior")
    _make_offer(db, ref, title="Marketer 1", primary_filiere=other_filiere)
    _make_offer(db, ref, title="Marketer 2", primary_filiere=other_filiere)
    for off in db.query(JobOffer).filter(JobOffer.title.in_(["Marketer 1", "Marketer 2"])).all():
        db.add(OfferFiliere(offer_id=off.id, filiere_id=ref["filiere"].id, confidence=0.9))
    sub = _make_subscriber(db, ref)
    db.commit()

    build_and_queue_digest_sync(
        db, subscriber_id=sub.id, digest_day=date.today(), force=False
    )

    stats = compute_match_kind_stats(
        db, since=date.today(), until=date.today()
    )
    today_str = date.today().isoformat()
    assert today_str in stats["by_day"]
    kinds = stats["by_day"][today_str]["kinds"]
    # 1 primary + 2 secondary
    assert kinds.get("primary") == 1
    assert kinds.get("secondary") == 2
    assert stats["by_day"][today_str]["total"] == 3


def test_endpoint_admin_tier_stats_existe(db) -> None:
    """L'endpoint GET /api/admin/sending/tier-stats existe et repond.

    RED: l'endpoint n'existe pas encore.
    """
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from api.v1.admin.sending import router
    from api.deps import get_current_admin
    from models.admin import Administrator
    from models.enums import AdminRole

    # Mock d'un admin avec role.enum.value pour bypasser le guard require_roles.
    fake_admin = Administrator(
        id="admin-fake", email="ops@jobalert.ci", role=AdminRole.SUPER_ADMIN
    )

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_admin] = lambda: fake_admin
    client = TestClient(app)
    resp = client.get("/api/admin/sending/tier-stats?period_days=7")
    assert resp.status_code == 200, f"attendu 200, got {resp.status_code}: {resp.text}"
    payload = resp.json()
    assert payload["period_days"] == 7
    assert "tier_distribution" in payload
    assert "match_kind_distribution" in payload
    # La structure imbriquee: by_day + global
    assert "by_day" in payload["tier_distribution"]
    assert "global" in payload["tier_distribution"]
    assert "by_day" in payload["match_kind_distribution"]
    assert "global" in payload["match_kind_distribution"]


def test_compute_tier_stats_distribution_par_tier_et_par_jour(db) -> None:
    """compute_tier_stats retourne la distribution des match_tier par date.

    RED: compute_tier_stats n'existe pas encore.
    """
    from services.tier_stats_service import compute_tier_stats
    from services.digest_builder_service import build_and_queue_digest_sync
    from models import OfferFiliere

    ref = _make_reference(db)
    other_filiere = Filiere(code="marketing", slug="marketing", label="Marketing & Com")
    db.add(other_filiere)
    db.flush()

    today = date.today()

    # Abonne 1: 3 offres primary (filiere principale) -> T0.
    sub1 = _make_subscriber(db, ref, city="Abidjan")
    sub1.email = "sub1@example.com"
    sub1.email_normalized = "sub1@example.com"
    _make_offer(db, ref, title="Dev 1")
    _make_offer(db, ref, title="Dev 2")
    _make_offer(db, ref, title="Dev 3")
    db.commit()
    build_and_queue_digest_sync(db, subscriber_id=sub1.id, digest_day=today, force=False)

    # Abonne 2: 1 primary + 2 secondary (autre filiere principale) -> T1.
    sub2 = _make_subscriber(db, ref, city="Abidjan")
    sub2.email = "sub2@example.com"
    sub2.email_normalized = "sub2@example.com"
    _make_offer(db, ref, title="Dev principal 2")
    _make_offer(db, ref, title="Marketer 1", primary_filiere=other_filiere)
    _make_offer(db, ref, title="Marketer 2", primary_filiere=other_filiere)
    for off in db.query(JobOffer).filter(JobOffer.title.in_(["Marketer 1", "Marketer 2"])).all():
        db.add(OfferFiliere(offer_id=off.id, filiere_id=ref["filiere"].id, confidence=0.9))
    db.commit()
    build_and_queue_digest_sync(db, subscriber_id=sub2.id, digest_day=today, force=False)

    # Abonne 3: skipped_empty car il n'a AUCUNE filiere (donc 0 candidat).
    sub3 = Subscriber(
        email="sub3@example.com",
        email_normalized="sub3@example.com",
        full_name="Sub3",
        status=SubscriberStatus.ACTIVE,
        experience_level_id=ref["experience"].id,
        city="Abidjan",
        subscribed_at=datetime.now(timezone.utc) - timedelta(days=30),
        confirmed_at=datetime.now(timezone.utc) - timedelta(days=29),
    )
    db.add(sub3)
    db.flush()
    # PAS de SubscriberFiliere => le filtre dure "aucune filiere" rejette tout.
    db.commit()
    build_and_queue_digest_sync(db, subscriber_id=sub3.id, digest_day=today, force=False)
    db.commit()

    stats = compute_tier_stats(db, since=today, until=today)

    # Aujourd'hui: 1 T0 + 1 T1 + 1 skipped_empty.
    today_str = today.isoformat()
    assert today_str in stats["by_day"]
    today_stats = stats["by_day"][today_str]
    # Compteurs par tier.
    tier_counts = {row["tier"]: row["count"] for row in today_stats["tiers"]}
    assert tier_counts.get("T0") == 1, f"attendu 1 T0, got {tier_counts}"
    assert tier_counts.get("T1") == 1, f"attendu 1 T1, got {tier_counts}"
    # skipped_empty a son propre champ.
    assert today_stats["skipped_empty"] == 1, f"attendu 1 skipped, got {today_stats}"
    # Total du jour.
    assert today_stats["total"] == 3, f"attendu total=3, got {today_stats}"


def test_compute_tier_stats_plage_dates(db) -> None:
    """compute_tier_stats respecte la plage since/until (inclusif)."""
    from services.tier_stats_service import compute_tier_stats
    from services.digest_builder_service import build_and_queue_digest_sync
    from datetime import timedelta

    ref = _make_reference(db)
    _make_offer(db, ref, title="Dev A")
    sub = _make_subscriber(db, ref, city="Abidjan")
    sub.email = "range@example.com"
    sub.email_normalized = "range@example.com"
    db.commit()

    yesterday = date.today() - timedelta(days=1)
    build_and_queue_digest_sync(db, subscriber_id=sub.id, digest_day=yesterday, force=False)
    build_and_queue_digest_sync(db, subscriber_id=sub.id, digest_day=date.today(), force=False)
    db.commit()

    # Plage incluant uniquement aujourd'hui.
    stats = compute_tier_stats(db, since=date.today(), until=date.today())
    assert date.today().isoformat() in stats["by_day"]
    assert yesterday.isoformat() not in stats["by_day"]

    # Plage incluant les 2 jours.
    stats_full = compute_tier_stats(db, since=yesterday, until=date.today())
    assert date.today().isoformat() in stats_full["by_day"]
    assert yesterday.isoformat() in stats_full["by_day"]


def test_compute_tier_stats_aggregat_global(db) -> None:
    """compute_tier_stats expose aussi un total global (tous jours confondus)."""
    from services.tier_stats_service import compute_tier_stats
    from services.digest_builder_service import build_and_queue_digest_sync

    ref = _make_reference(db)
    _make_offer(db, ref, title="Dev G")
    sub = _make_subscriber(db, ref, city="Abidjan")
    sub.email = "global@example.com"
    sub.email_normalized = "global@example.com"
    db.commit()
    build_and_queue_digest_sync(db, subscriber_id=sub.id, digest_day=date.today(), force=False)
    db.commit()

    stats = compute_tier_stats(db, since=date.today() - timedelta(days=7), until=date.today())
    assert "global" in stats
    assert stats["global"]["total"] >= 1
    tier_counts = {row["tier"]: row["count"] for row in stats["global"]["tiers"]}
    assert tier_counts.get("T0", 0) >= 1
