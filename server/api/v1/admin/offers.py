from __future__ import annotations

import csv
import io
import json
import logging
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from api.v1.public.offers import _load_offer_relations
from models.admin import AdminAction, Administrator
from models.jobs import JobOffer, JobOfferStatus
from schemas.offers import (
    DuplicateMarkRequest,
    JobOfferRead,
    OfferBulkStatusUpdate,
    OfferCreate,
    OfferStatusUpdate,
    OfferUpdate,
    OfferVisibilityUpdate,
    PotentialDuplicateRead,
    RejectRequest,
)
from services.audit import log_admin_action
from services.duplicates import (
    DuplicateServiceError,
    find_potential_duplicates,
    mark_duplicate,
    reject_duplicate_pair,
)
from services.offers import create_offer as create_offer_service
from services.offers import update_offer as update_offer_service
from services.search_utils import safe_ilike

logger = logging.getLogger(__name__)

IMPORT_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo (audit P0 #2)
IMPORT_CHUNK_SIZE = 50
ALLOWED_EXTENSIONS = {".csv", ".json"}
ALLOWED_MIME_TYPES = {"text/csv", "application/json", "application/octet-stream"}

# Gestionnaire d'offres au quotidien; super_admin garde l'acces partout.
router = APIRouter(
    prefix="/api/admin/offers",
    tags=["admin-offers"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_offres"))],
)


def _require_offer(db: Session, offer_id: str, *, with_relations: bool = False) -> JobOffer:
    stmt = select(JobOffer).where(JobOffer.id == offer_id)
    if with_relations:
        stmt = select(JobOffer).options(*_load_offer_relations()).where(JobOffer.id == offer_id)
    offer = db.scalar(stmt)
    if not offer:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    return offer


@router.get("", response_model=list[JobOfferRead])
async def list_offers_admin(
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=120, description="Recherche dans le titre"),
    filiere_id: str | None = Query(None, description="ID de filiere"),
    source_id: str | None = Query(None, description="ID de source"),
    status: JobOfferStatus | None = Query(None, description="Statut exact de l'offre"),
    visible_site: bool | None = Query(None, description="Visibilite publique"),
    origin: str | None = Query(None, description="Origine (scraping, manuel, import)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Liste complete (y compris masquees/archivees). LIKE echappe (audit P0 #4)."""
    stmt = select(JobOffer).options(*_load_offer_relations())

    if q:
        stmt = stmt.where(safe_ilike(JobOffer.title, q))
    if filiere_id:
        stmt = stmt.where(JobOffer.primary_filiere_id == filiere_id)
    if source_id:
        stmt = stmt.where(JobOffer.source_id == source_id)
    if status is not None:
        stmt = stmt.where(JobOffer.status == status)
    if visible_site is not None:
        stmt = stmt.where(JobOffer.visible_site == visible_site)
    if origin:
        stmt = stmt.where(JobOffer.origin == origin)

    stmt = stmt.order_by(JobOffer.created_at.desc())
    return list(db.scalars(stmt.limit(limit).offset(offset)).unique())


@router.get("/{offer_id}", response_model=JobOfferRead)
async def get_offer_admin(offer_id: str, db: Session = Depends(get_db)):
    """Detail complet admin (y compris masque/archive)."""
    return _require_offer(db, offer_id, with_relations=True)


@router.post("", status_code=201, response_model=JobOfferRead)
async def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Ajout manuel d'une offre (origin=manuel)."""
    try:
        offer = create_offer_service(db, payload, admin_id=admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="job_offers", target_id=offer.id)
    db.commit()
    return _require_offer(db, offer.id, with_relations=True)


@router.put("/{offer_id}", response_model=JobOfferRead)
async def update_offer(
    offer_id: str,
    payload: OfferUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Edition d'une offre."""
    offer = _require_offer(db, offer_id)
    try:
        update_offer_service(db, offer, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="job_offers", target_id=offer.id)
    db.commit()
    return _require_offer(db, offer_id, with_relations=True)


@router.patch("/{offer_id}/visibility")
async def toggle_offer_visibility(
    offer_id: str,
    payload: OfferVisibilityUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Active/desactive visible_site."""
    offer = _require_offer(db, offer_id)
    offer.visible_site = payload.visible_site
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        target_id=offer.id,
        details={"visible_site": payload.visible_site},
    )
    db.commit()
    return {"message": "Visibilite mise a jour", "visible_site": offer.visible_site}


@router.patch("/{offer_id}/status")
async def update_offer_status(
    offer_id: str,
    payload: OfferStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Change le statut (valide contre l'enum JobOfferStatus)."""
    offer = _require_offer(db, offer_id)
    offer.status = JobOfferStatus(payload.status)
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        target_id=offer.id,
        details={"status": payload.status},
    )
    db.commit()
    return {"message": "Statut mis a jour", "status": offer.status.value}


@router.delete("/{offer_id}", status_code=204)
async def delete_offer(
    offer_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Suppression logique (soft delete)."""
    offer = _require_offer(db, offer_id)
    offer.deleted_at = datetime.now(UTC)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="job_offers", target_id=offer.id)
    db.commit()


@router.post("/bulk-status")
async def bulk_update_status(
    payload: OfferBulkStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Changement de statut en masse (audit P1 #30: plafond a 500 IDs, statut valide)."""
    if len(payload.offer_ids) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 IDs par requete")
    stmt = (
        update(JobOffer)
        .where(JobOffer.id.in_(payload.offer_ids))
        .values(status=JobOfferStatus(payload.status))
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        logger.warning("bulk-status: aucun ID trouve dans %s IDs soumis", len(payload.offer_ids))
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        details={"offer_ids": payload.offer_ids, "status": payload.status, "count": result.rowcount},
    )
    db.commit()
    return {"message": f"{result.rowcount} offres mises a jour"}


# ─── Doublons proches (section 3 du document 8) ─────────────────────────


@router.get("/duplicates/candidates", response_model=list[PotentialDuplicateRead])
async def list_duplicate_candidates(
    response: Response,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
    company_id: str | None = Query(None, description="Filtre par entreprise (normalisee)"),
    min_similarity: int = Query(80, ge=1, le=100, description="Seuil de similarite minimale (0-100)"),
):
    """Liste des offres potentiellement doublons.

    Audit 2, R2: l'avertissement de scan tronque passe en header HTTP
    (plus de dict `_warning` qui violait le response_model).
    """
    candidates, truncated = find_potential_duplicates(db, company_id=company_id, min_similarity=min_similarity)
    if truncated:
        response.headers["X-Scan-Truncated"] = "true"
    return candidates


@router.post("/{offer_b_id}/mark-duplicate")
async def mark_offer_duplicate(
    offer_b_id: str,
    payload: DuplicateMarkRequest,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Marque l'offre B comme doublon de A (refuse cycles + a==b)."""
    try:
        return mark_duplicate(
            db,
            offer_b_id=offer_b_id,
            duplicate_of_id=payload.duplicate_of_id,
            reason=payload.duplicate_reason,
            admin_id=admin.id,
        )
    except DuplicateServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/duplicates/reject")
async def reject_duplicate(
    payload: RejectRequest,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Indique explicitement que la paire (A, B) n'est pas un doublon."""
    try:
        return reject_duplicate_pair(
            db,
            offer_a_id=payload.offer_a_id,
            offer_b_id=payload.offer_b_id,
            reason=payload.reason,
            admin_id=admin.id,
        )
    except DuplicateServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ─── Import en masse (document 8 — 2.9) — version durcie audit P0 #2 ──


def _validate_upload(file: UploadFile, content_bytes: bytes) -> None:
    """Leve HTTPException 400/413 si l'upload ne respecte pas les bornes."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extension non supportee ({ext!r}). Autorisees: {sorted(ALLOWED_EXTENSIONS)}",
        )
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Type MIME non supporte ({file.content_type!r}).",
        )
    if len(content_bytes) > IMPORT_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({len(content_bytes)} octets > {IMPORT_MAX_BYTES}).",
        )


def _parse_payload(content_bytes: bytes, filename: str) -> list[dict[str, Any]]:
    """Decode CSV ou JSON. Renvoie toujours une liste de dicts."""
    text = content_bytes.decode("utf-8", errors="replace")
    if filename.lower().endswith(".json"):
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"JSON invalide: {exc}") from exc
    else:
        try:
            reader = csv.DictReader(io.StringIO(text))
            data = list(reader)
        except (csv.Error, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=400, detail=f"CSV invalide: {exc}") from exc
    if isinstance(data, dict):
        data = data.get("offers", [])
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Le fichier doit contenir une liste d'offres")
    return data


def _row_to_payload(row: dict[str, Any]) -> dict[str, Any]:
    """Filtre aux colonnes connues (defense contre colonnes surprises)."""
    allowed_keys = {
        "title",
        "company_name",
        "source_code",
        "source_url",
        "source_reference",
        "canonical_url",
        "filiere_code",
        "location_label",
        "contract_type_code",
        "experience_level_code",
        "education_level_code",
        "published_at",
        "expires_at",
        "intro",
        "missions",
    }
    return {k: (v or None) for k, v in row.items() if k in allowed_keys}


def _chunks(items: list, size: int) -> Iterable[list]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_offers_bulk(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Import d'offres depuis CSV ou JSON avec bornes strictes (audit P0 #2).

    Garanties:
    - Taille max 5 Mo.
    - Extensions/MIME valides.
    - Transaction par chunk de 50: une erreur sur une offre n'annule pas tout.
    - Audit log obligatoire.
    """
    content_bytes = await file.read()
    _validate_upload(file, content_bytes)
    rows = _parse_payload(content_bytes, file.filename or "")

    results = {"created": 0, "ignored": 0, "errors": []}

    for chunk in _chunks(rows, IMPORT_CHUNK_SIZE):
        chunk_created = 0
        chunk_failed = 0
        for offset, row in enumerate(chunk):
            try:
                payload_dict = _row_to_payload(row)
                payload = OfferCreate(**payload_dict)
                create_offer_service(db, payload, admin_id=admin.id)
                chunk_created += 1
            except Exception as exc:
                chunk_failed += 1
                results["errors"].append(
                    {"line": offset + 1, "error": str(exc), "data": row}
                )
        try:
            db.commit()
            results["created"] += chunk_created
            results["ignored"] += chunk_failed
        except Exception as exc:
            db.rollback()
            logger.exception("Rollback du chunk d'import (%s offres)", len(chunk))
            results["ignored"] += len(chunk)
            results["errors"].append(
                {"chunk_error": str(exc), "chunk_size": len(chunk)}
            )

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.CREATE,
        target_table="job_offers",
        details={
            "source": "bulk_import",
            "filename": file.filename,
            "created": results["created"],
            "ignored": results["ignored"],
        },
    )
    db.commit()

    return {
        "message": f"Import termine: {results['created']} creees, {results['ignored']} ignorees",
        **results,
    }
