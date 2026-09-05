from __future__ import annotations

import argparse
import sys

from sqlalchemy import select

from core.security import hash_password
from db.session import session_scope
from models.admin import Administrator, AdminRole

"""Cree ou met a jour un compte administrateur pour tester le back-office
en local.

Idempotent:
- si l'email n'existe pas -> creation;
- si l'email existe deja -> mise a jour du mot de passe, du role et du
  statut actif (utile pour reinitialiser un compte de test sans
  supprimer/recreer).

Exemples:
    python -m scripts.seed_admin
    python -m scripts.seed_admin --email demo@jobalert.ci --password demo1234 --role moderateur
    python -m scripts.seed_admin --full-name "Alice Demo" --inactive

Le mot de passe n'est JAMAIS affiche en clair dans les logs, seulement
hache (bcrypt) en base, via core.security.hash_password.
"""

ROLES_VALIDES = [role.value for role in AdminRole]

VALEURS_DEFAUT = {
    "email": "admin@jobalert.ci",
    "password": "admin1234",
    "full_name": "Admin Demo",
    "role": AdminRole.SUPER_ADMIN.value,
}


def seed_admin(
    email: str,
    password: str,
    full_name: str,
    role: str,
    inactive: bool = False,
) -> tuple[Administrator, bool]:
    """Cree ou met a jour l'admin. Retourne (admin, cree)."""

    with session_scope() as db:
        admin = db.scalar(select(Administrator).where(Administrator.email == email.strip().lower()))

        if admin is None:
            admin = Administrator(
                email=email.strip().lower(),
                password_hash=hash_password(password),
                full_name=full_name,
                role=AdminRole(role),
                is_active=not inactive,
            )
            db.add(admin)
            cree = True
        else:
            # Mise a jour d'un compte existant (reinitialisation de test).
            admin.password_hash = hash_password(password)
            admin.full_name = full_name
            admin.role = AdminRole(role)
            admin.is_active = not inactive
            cree = False

    return admin, cree


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Cree ou met a jour un compte administrateur local.",
    )
    parser.add_argument(
        "--email",
        default=VALEURS_DEFAUT["email"],
        help=f"Email du compte (defaut: {VALEURS_DEFAUT['email']})",
    )
    parser.add_argument(
        "--password",
        default=VALEURS_DEFAUT["password"],
        help="Mot de passe en clair (sera hache en base, jamais affiche)",
    )
    admin_role_names = " | ".join(ROLES_VALIDES)
    parser.add_argument(
        "--role",
        default=VALEURS_DEFAUT["role"],
        choices=ROLES_VALIDES,
        help=f"Role du compte (defaut: super_admin ; valeurs: {admin_role_names})",
    )
    parser.add_argument(
        "--full-name",
        default=VALEURS_DEFAUT["full_name"],
        help=f"Nom affiche (defaut: {VALEURS_DEFAUT['full_name']})",
    )
    parser.add_argument(
        "--inactive",
        action="store_true",
        help="Cree le compte comme inactif (pour tester le message 403)",
    )

    args = parser.parse_args()

    if len(args.password) < 8:
        print("ERREUR: le mot de passe doit faire au moins 8 caracteres.", file=sys.stderr)
        return 1

    admin, cree = seed_admin(
        email=args.email,
        password=args.password,
        full_name=args.full_name,
        role=args.role,
        inactive=args.inactive,
    )

    action = "cree" if cree else "mis a jour"
    print(
        f"Admin {action} : {admin.email} (role: {admin.role.value}, actif: {admin.is_active})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
