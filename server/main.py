from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.metrics import observe_request
from api.metrics import router as metrics_router
from api.system import routerSys
from api.v1.router import api_router
from core.config import get_settings
from db.session import init_db

settings = get_settings()

_INSECURE_DEFAULT_JWT_SECRET = "dev-insecure-secret-change-me"

# Audit 4, J.4 : longueur minimale des secrets au boot. Un secret de 8
# caracteres est signable/force en minutes ; 32 caracteres est le seuil
# standard du projet (cf. refresh tokens du projet soeur).
_MIN_SECRET_LENGTH = 32


@asynccontextmanager
async def lifespan(app: FastAPI):
    # En production, un secret JWT par defaut permettrait de forger des tokens
    # admin: on refuse de demarrer plutot que de le faire silencieusement.
    if settings.is_production and settings.admin_jwt_secret == _INSECURE_DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "ADMIN_JWT_SECRET doit etre defini explicitement en production (APP_ENV=production)."
        )

    # Audit 4, J.4 : garde de longueur — un ADMIN_JWT_SECRET court mais
    # explicite (ex. "abc") demarrait sans avertissement ; en production
    # c'est un secret force-brute bien plus vite. 32 chars minimum.
    if settings.is_production and len(settings.admin_jwt_secret) < _MIN_SECRET_LENGTH:
        raise RuntimeError(
            f"ADMIN_JWT_SECRET doit faire au moins {_MIN_SECRET_LENGTH} caracteres en production "
            f"(longueur actuelle: {len(settings.admin_jwt_secret)})."
        )

    # Audit 4, B.7 : pipeline IA actif en production sans secret de
    # chiffrement = chaque tache IA levera AIConfigurationError au premier
    # decrypt. Mieux vaut un boot rouge qu'un service "sain" au pipeline
    # mort (on exige la non-nullite, jamais la valeur).
    if settings.is_production and settings.ai_enabled and not settings.ai_key_encryption_secret:
        raise RuntimeError(
            "AI_KEY_ENCRYPTION_SECRET doit etre defini en production quand AI_ENABLED=true "
            "(chiffrement des cles IA en base)."
        )

    # Audit 4, J.4 (suite) : le secret Fernet doit lui aussi etre robuste —
    # il protege les cles API IA stockees en base.
    if (
        settings.is_production
        and settings.ai_enabled
        and settings.ai_key_encryption_secret
        and len(settings.ai_key_encryption_secret) < _MIN_SECRET_LENGTH
    ):
        raise RuntimeError(
            f"AI_KEY_ENCRYPTION_SECRET doit faire au moins {_MIN_SECRET_LENGTH} caracteres en production "
            f"(longueur actuelle: {len(settings.ai_key_encryption_secret)})."
        )

    # En production, Alembic doit piloter le schema. Ce flag reste pratique pour
    # un dev local ou une CI ephemere sans migration prealable.
    if settings.auto_create_tables:
        init_db()
    yield


# Audit P1 #27: en prod on durcit methodes/headers (evite le wildcard large).
_cors_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] if settings.is_production else ["*"]
_cors_headers = ["Authorization", "Content-Type", "X-Requested-With", "X-Scraper-Token", "X-Internal-Token"] if settings.is_production else ["*"]

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend robuste et evolutif pour JobAlert CI.",
    lifespan=lifespan,
)


# Audit P1 #32: middleware metriques pour Prometheus.
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    route = request.scope.get("route")
    # Audit 3, W3 : sur 404 (route non resolue), le path URL brut deviendrait
    # une cle de metrique unique par requete — un flood d'URLs inexistantes
    # evincerait les vraies routes du top. On normalise vers "unmatched".
    path_template = getattr(route, "path", None) or "unmatched"
    observe_request(
        method=request.method,
        path=path_template,
        status_code=response.status_code,
        duration_seconds=duration,
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)

app.include_router(routerSys)
app.include_router(metrics_router)

# Toutes les routes passent par le router v1.
app.include_router(api_router)

