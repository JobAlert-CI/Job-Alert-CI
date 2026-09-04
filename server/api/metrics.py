"""Endpoint /metrics pour Prometheus (audit 1, P1 #32 ; durci audit 2, R8/R9).

Implementation minimaliste (sans dependance `prometheus-fastapi-instrumentator`)
qui expose les compteurs utiles a un dashboard de production:
- Compteurs de requetes par (methode, path-template, status).
- Duree cumulee par (methode, path-template).

Corrections audit 2:
- R8: cardinalite bornee (top N+purge) — plus de defaultdict qui croit
  indefiniment avec des paths/status divers.
- R9: en production, l'acces exige la cle admin (header X-Admin-API-Key)
  ou vient de loopback. Le simple WARNING n'acceptait rien.

Format texte Prometheus 0.0.4.
"""
from __future__ import annotations

import logging
from threading import Lock

from fastapi import APIRouter, Header, HTTPException, Request, Response
from sqlalchemy import text

from core.config import get_settings
from db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["metrics"])

# ─── Compteurs partages (verrou: plusieurs threads Uvicorn) ─────────────
_lock = Lock()
_request_count: dict[tuple[str, str, int], int] = {}
_request_duration_sum: dict[tuple[str, str], float] = {}

# Audit 2, R8: borne de cardinalite. Au-dela, on supprime les 20% les moins
# sollicites (approximation simple et sure: on ne perd que du signal, pas la
# disponibilite du process).
MAX_METRICS_CARDINALITY = 2000
_PURGE_FRACTION = 0.2


def _purge_if_needed() -> None:
    """Maintient la cardinalite sous MAX_METRICS_CARDINALITY (R8)."""
    if len(_request_count) < MAX_METRICS_CARDINALITY:
        return
    keep = int(MAX_METRICS_CARDINALITY * (1 - _PURGE_FRACTION))
    sorted_keys = sorted(_request_count.items(), key=lambda kv: kv[1], reverse=True)
    survivors = {key for key, _count in sorted_keys[:keep]}
    for key in list(_request_count.keys()):
        if key not in survivors:
            _request_count.pop(key, None)
            _request_duration_sum.pop((key[0], key[1]), None)
    logger.info("Purge des compteurs metrics (cardinalite bornee a %d)", MAX_METRICS_CARDINALITY)


def observe_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    """Hook appele par le middleware HTTP (cf. main.py)."""
    with _lock:
        key_count = (method, path, status_code)
        key_duration = (method, path)
        _request_count[key_count] = _request_count.get(key_count, 0) + 1
        _request_duration_sum[key_duration] = _request_duration_sum.get(key_duration, 0.0) + duration_seconds
        _purge_if_needed()


def _format_prometheus() -> str:
    lines = [
        "# HELP http_requests_total Total HTTP requests served.",
        "# TYPE http_requests_total counter",
    ]
    with _lock:
        for (method, path, status_code), count in sorted(_request_count.items()):
            # Path issu du template de route FastAPI, jamais l'URL brute: pas de PII.
            lines.append(f'http_requests_total{{method="{method}",path="{path}",status="{status_code}"}} {count}')
        lines.append("# HELP http_request_duration_seconds_sum Cumulative request duration.")
        lines.append("# TYPE http_request_duration_seconds_sum counter")
        for (method, path), duration in sorted(_request_duration_sum.items()):
            lines.append(f'http_request_duration_seconds_sum{{method="{method}",path="{path}"}} {duration:.6f}')
    return "\n".join(lines) + "\n"


def _is_authorized(request: Request, x_admin_api_key: str | None) -> bool:
    """Audit 2, R9: en prod, loopback OU cle admin valide; en dev, libre."""
    settings = get_settings()
    if not settings.is_production:
        return True
    client_ip = request.client.host if request.client else ""
    if client_ip in {"127.0.0.1", "::1"}:
        return True
    if settings.admin_api_key and x_admin_api_key:
        import secrets

        return secrets.compare_digest(x_admin_api_key, settings.admin_api_key)
    return False


@router.get("/metrics")
def metrics(request: Request, x_admin_api_key: str | None = Header(default=None)) -> Response:
    """Endpoint Prometheus (scrape par Prom / VictoriaMetrics / etc.).

    En production: refuse (403) si l'appel ne vient ni de loopback ni avec
    la cle admin — l'ancien comportement se contentait d'un WARNING.
    """
    if not _is_authorized(request, x_admin_api_key):
        logger.warning("Metrics scrape refuse (IP non autorisee)")
        raise HTTPException(status_code=403, detail="Acces refuse")

    return Response(
        content=_format_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/health/db-deep")
def health_db_deep() -> Response:
    """Healthcheck DB rapide (blackbox_exporter)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        return Response(
            content=f"database unavailable: {exc}",
            status_code=503,
            media_type="text/plain",
        )
    return Response(content="ok", media_type="text/plain")


__all__ = ["observe_request", "router"]
