"""Bootstrap du premier administrateur (super_admin) du back-office.

Usage:
    python -m scripts.create_admin --email admin@jobalert.ci --password MonPass --name "Super Administrateur"

Idempotent : met a jour le compte si l'email existe deja (mot de passe,
nom, role, reactivation) ou le cree sinon.

Passe directement par SQLAlchemy (aucune validation Pydantic) : le mot de
passe est hache avec bcrypt avant insertion.
"""

from __future__ import annotations

import argparse

from sqlalchemy import select

from core.security import hash_password
from db.session import session_scope
from models.admin import Administrator
from models.enums import AdminRole


def upsert_admin(email: str, password: str, full_name: str, role: str = "super_admin") -> None:
    email = email.strip().lower()
    with session_scope() as db:
        admin = db.scalar(select(Administrator).where(Administrator.email == email))
        if admin is None:
            db.add(
                Administrator(
                    email=email,
                    password_hash=hash_password(password),
                    full_name=full_name.strip(),
                    role=AdminRole(role),
                    is_active=True,
                )
            )
            created_or_updated = "cree"
        else:
            admin.password_hash = hash_password(password)
            admin.full_name = full_name.strip()
            admin.role = AdminRole(role)
            admin.is_active = True
            created_or_updated = "mis a jour"
        print(f"Compte administrateur {created_or_updated} : {email} ({role})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cree ou met a jour un compte administrateur.")
    parser.add_argument("--email", required=True, help="Email du compte (minuscules appliquees).")
    parser.add_argument("--password", required=True, help="Mot de passe en clair (hache en bcrypt).")
    parser.add_argument("--name", default="Super Administrateur", help="Nom affiche dans le back-office.")
    parser.add_argument(
        "--role",
        default="super_admin",
        choices=[role.value for role in AdminRole],
        help="Role du compte.",
    )
    args = parser.parse_args()
    upsert_admin(args.email, args.password, args.name, args.role)


if __name__ == "__main__":
    main()