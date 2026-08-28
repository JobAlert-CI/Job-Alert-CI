"""Statistiques de distribution des paliers de matching (T0-T5) sur les digests.

Fournit `compute_tier_stats(db, since, until)` qui agrege, pour chaque
date de digest dans la plage [since, until]:
- le nombre de digests par `match_tier` (T0, T1, ..., T5, T5_INSUFFICIENT)
- le nombre de skipped_empty (digest sans offre, status=skipped_empty)
- un aggregat global (tous jours confondus)

Utilise par l'endpoint admin `/api/admin/sending/tier-stats` pour
permettre a l'equipe ops de suivre la qualite du matching dans le
temps et d'identifier quand trop de digests basculent en T2+ (signe
que le tagging de filiere ou le referentiel de villes est trop
strict, cf. cahier des charges).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from models import DigestStatus, EmailDigest


def compute_tier_stats(
    db: Session,
    *,
    since: date,
    until: date,
) -> dict[str, Any]:
    """Calcule la distribution des `match_tier` par date de digest.

    Format retourne:
    ```
    {
        "since": "2026-08-21",
        "until": "2026-08-28",
        "by_day": {
            "2026-08-28": {
                "tiers": [{"tier": "T0", "count": 120}, ...],
                "skipped_empty": 8,
                "total": 128,
            },
            ...
        },
        "global": {
            "tiers": [{"tier": "T0", "count": 800}, ...],
            "skipped_empty": 50,
            "total": 850,
        },
    }
    ```
    """
    # Une seule requete groupee par (digest_date, status, match_tier).
    # On distingue skipped_empty via status, pas match_tier.
    skipped_label = "__skipped_empty__"
    # CASE: si status='skipped_empty' on utilise un label sentinelle, sinon match_tier.
    bucket = case(
        (EmailDigest.status == DigestStatus.SKIPPED_EMPTY, skipped_label),
        else_=EmailDigest.match_tier,
    )
    stmt = (
        select(
            EmailDigest.digest_date,
            bucket.label("bucket"),
            func.count(EmailDigest.id).label("count"),
        )
        .where(EmailDigest.digest_date >= since, EmailDigest.digest_date <= until)
        .group_by(EmailDigest.digest_date, bucket)
        .order_by(EmailDigest.digest_date, bucket)
    )
    rows = db.execute(stmt).all()

    by_day: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"tiers": [], "skipped_empty": 0, "total": 0}
    )
    global_tiers: dict[str, int] = defaultdict(int)
    global_skipped = 0

    for digest_date, bucket_value, count in rows:
        day_key = digest_date.isoformat()
        if bucket_value == skipped_label:
            by_day[day_key]["skipped_empty"] += count
            global_skipped += count
        else:
            by_day[day_key]["tiers"].append({"tier": bucket_value, "count": count})
            global_tiers[bucket_value] += count
        by_day[day_key]["total"] += count

    # Tri des tiers par ordre canonique T0, T1, T2, T3, T4, T5.
    def _tier_sort_key(entry: dict[str, Any]) -> str:
        return entry["tier"]

    for day_stats in by_day.values():
        day_stats["tiers"].sort(key=_tier_sort_key)

    return {
        "since": since.isoformat(),
        "until": until.isoformat(),
        "by_day": dict(by_day),
        "global": {
            "tiers": [
                {"tier": tier, "count": global_tiers[tier]}
                for tier in sorted(global_tiers)
            ],
            "skipped_empty": global_skipped,
            "total": sum(global_tiers.values()) + global_skipped,
        },
    }


def compute_match_kind_stats(
    db: Session,
    *,
    since: date,
    until: date,
) -> dict[str, Any]:
    """Calcule la distribution des `match_kind` (au niveau offre) par date.

    Complement de `compute_tier_stats` qui agrege au niveau digest. Ici on
    regarde chaque `EmailDigestOffer.match_kind` dans la plage [since, until]
    pour identifier combien d'offres envoyees sont en primary/secondary/
    fallback_*.

    Format retourne:
    ```
    {
        "since": "2026-08-21",
        "until": "2026-08-28",
        "by_day": {
            "2026-08-28": {
                "kinds": {"primary": 120, "secondary": 30, "fallback_contract": 5},
                "total": 155,
            },
        },
        "global": {
            "kinds": {"primary": 800, "secondary": 200, "fallback_contract": 30},
            "total": 1030,
        },
    }
    ```
    """
    from models import EmailDigestOffer

    stmt = (
        select(
            EmailDigest.digest_date,
            EmailDigestOffer.match_kind,
            func.count(EmailDigestOffer.id).label("count"),
        )
        .join(EmailDigest, EmailDigest.id == EmailDigestOffer.digest_id)
        .where(EmailDigest.digest_date >= since, EmailDigest.digest_date <= until)
        .group_by(EmailDigest.digest_date, EmailDigestOffer.match_kind)
        .order_by(EmailDigest.digest_date, EmailDigestOffer.match_kind)
    )
    rows = db.execute(stmt).all()

    by_day: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"kinds": defaultdict(int), "total": 0}
    )
    global_kinds: dict[str, int] = defaultdict(int)

    for digest_date, match_kind, count in rows:
        day_key = digest_date.isoformat()
        by_day[day_key]["kinds"][match_kind] += count
        by_day[day_key]["total"] += count
        global_kinds[match_kind] += count

    # Convertir les defaultdict en dict plats pour la serialisation JSON.
    by_day_plain: dict[str, dict[str, Any]] = {}
    for day_key, day_stats in by_day.items():
        by_day_plain[day_key] = {
            "kinds": dict(day_stats["kinds"]),
            "total": day_stats["total"],
        }

    return {
        "since": since.isoformat(),
        "until": until.isoformat(),
        "by_day": by_day_plain,
        "global": {
            "kinds": dict(global_kinds),
            "total": sum(global_kinds.values()),
        },
    }
