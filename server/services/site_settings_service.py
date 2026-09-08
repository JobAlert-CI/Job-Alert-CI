"""Resolution des parametres du site au runtime (cycle 18).

La table `site_settings` etait editable via /api/admin/settings (CRUD
complet) mais AUCUN service ne la lisait : le runtime resolvait tout
par `get_settings()` (variables d'environnement). Modifier une valeur
dans l'admin ne changeait donc RIEN au comportement du site.

Ce service fait le pont : `resolve_runtime_settings(db)` construit un
objet `Settings` (dataclass frozen) identique a la config env, avec
les cles PRESENTES dans la table qui previennent. Priorite :
    site_settings (valeur admin valide) > variable d'environnement.

Regle de robustesse : une valeur invalide en base (mauvais type,
hors bornes) ne doit JAMAIS faire echouer l'operation metier qui la
lit (une inscription ne doit pas crasher parce qu'un admin a tape
"vingt-quatre" dans le TTL). Une valeur invalide est IGNOREE avec un
warning — on retombe sur la valeur d'environnement.

Les cles de la table SANS champ Settings correspondant (ex: futures
cles documentaires) sont ignorees au runtime : elles restent
editables dans l'admin, simplement non consommees.
"""

from __future__ import annotations

import logging
from dataclasses import fields, replace

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import Settings, get_settings
from models.admin import SiteSetting

logger = logging.getLogger("jobalert.site_settings")

# ─── Spec des cles runtime connues ─────────────────────────────────────
# Cle site_settings -> (champ Settings, borne min, borne max) pour les
# entiers. Les bornes protegent contre une valeur absurde tapee en base
# (TTL de 100000 heures, heure de digest a 99...). None = pas de borne.
RUNTIME_SETTING_SPECS: dict[str, tuple[str, int | None, int | None]] = {
    "email_confirmation_required": ("email_confirmation_required", None, None),
    "confirm_email_token_ttl_hours": ("confirm_email_token_ttl_hours", 1, 720),
    "email_from_name": ("email_from_name", None, None),
    "support_email": ("support_email", None, None),
    # Sujet du mail de confirmation : n'a pas de champ Settings (constante
    # DEFAULT_SUBJECT dans services/email/templates.py). Consomme par le
    # service de confirmation au moment du rendu, cf. plus bas.
    "email_confirmation_subject": ("__subject__", None, None),
}


def _coerce_bool(raw: str | None) -> bool | None:
    """Convertit la valeur texte en bool ; None si incomprehensible."""
    if raw is None:
        return None
    valeur = raw.strip().lower()
    if valeur in ("true", "1", "yes", "oui", "vrai"):
        return True
    if valeur in ("false", "0", "no", "non", "faux"):
        return False
    return None


def _coerce_int(raw: str | None, minimum: int | None, maximum: int | None) -> int | None:
    """Convertit la valeur texte en int borne ; None si invalide/hors bornes."""
    if raw is None:
        return None
    try:
        valeur = int(raw.strip())
    except (TypeError, ValueError):
        return None
    if minimum is not None and valeur < minimum:
        return None
    if maximum is not None and valeur > maximum:
        return None
    return valeur


def _coerce_str(raw: str | None) -> str | None:
    """Convertit la valeur texte en str non vide ; None si vide."""
    if raw is None:
        return None
    valeur = raw.strip()
    return valeur or None


def _type_du_champ(nom_champ: str) -> type:
    """Retourne le type annote du champ Settings (bool/int/str)."""
    for champ in fields(Settings):
        if champ.name == nom_champ:
            texte = str(champ.type)
            if "bool" in texte:
                return bool
            if "int" in texte:
                return int
            return str
    return str


def resolve_runtime_settings(db: Session, settings: Settings | None = None) -> Settings:
    """Construit un Settings patche par les valeurs admin de site_settings.

    Ne leve JAMAIS : toute erreur (base indisponible, valeur invalide)
    retombe sur les valeurs d'environnement. Appele par les points de
    consommation metier (inscription, envoi de confirmation, digest).
    """
    base = settings or get_settings()

    try:
        lignes = {ligne.key: ligne.value for ligne in db.scalars(select(SiteSetting)).all()}
    except Exception:  # noqa: BLE001 - robustesse : la metier ne doit pas echouer
        logger.warning("site_settings illisible, utilisation de la config d'environnement")
        return base

    patch: dict[str, object] = {}
    for cle, (nom_champ, minimum, maximum) in RUNTIME_SETTING_SPECS.items():
        brute = lignes.get(cle)
        if brute is None:
            continue
        if nom_champ == "__subject__":
            continue  # consomme separement (cf. get_confirmation_subject)
        if nom_champ == "email_confirmation_required":
            valeur = _coerce_bool(brute)
        elif minimum is not None or maximum is not None:
            valeur = _coerce_int(brute, minimum, maximum)
        else:
            valeur = _coerce_str(brute)
        if valeur is None:
            logger.warning(
                "site_settings[%r] = %r invalide pour %s — valeur d'environnement conservee",
                cle, brute, nom_champ,
            )
            continue
        patch[nom_champ] = valeur

    if not patch:
        return base
    return replace(base, **patch)


def get_confirmation_subject(db: Session, settings: Settings | None = None) -> str:
    """Sujet de l'email de confirmation : site_settings puis constante.

    Champ dedie car `Settings` n'a pas de champ sujet (constante
    DEFAULT_SUBJECT historique) : la cle admin prevaut sur la constante,
    une valeur vide retombe sur la constante.
    """
    base = settings or get_settings()
    try:
        ligne = db.scalar(select(SiteSetting).where(SiteSetting.key == "email_confirmation_subject"))
    except Exception:  # noqa: BLE001
        return base.email_from_name and "Confirmez votre inscription à JobAlert CI"
    if ligne is None or not (ligne.value or "").strip():
        from services.email.templates import DEFAULT_SUBJECT

        return DEFAULT_SUBJECT
    return ligne.value.strip()
