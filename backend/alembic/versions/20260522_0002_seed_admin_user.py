"""seed admin user

Revision ID: 20260522_0002
Revises: 20260522_0001
Create Date: 2026-05-22

"""
from collections.abc import Sequence
from datetime import datetime
import hashlib
import hmac
import secrets

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision: str = "20260522_0002"
down_revision: str | Sequence[str] | None = "20260522_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ADMIN_USERNAME = "毛毛虫"
ADMIN_PASSWORD = "maomaochong@aichi10"
TERMS_VERSION = "2026-05-16"
PRIVACY_VERSION = "2026-05-16"


users = sa.table(
    "users",
    sa.column("username", sa.String),
    sa.column("password_hash", sa.String),
    sa.column("display_name", sa.String),
    sa.column("role", sa.String),
    sa.column("status", sa.String),
    sa.column("terms_accepted_at", sa.DateTime),
    sa.column("privacy_accepted_at", sa.DateTime),
    sa.column("terms_version", sa.String),
    sa.column("privacy_version", sa.String),
    sa.column("created_at", sa.DateTime),
    sa.column("updated_at", sa.DateTime),
)


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        f"{settings.SECRET_KEY}:{salt}".encode(),
        120_000,
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def _verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, salt, digest = password_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    expected = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        f"{settings.SECRET_KEY}:{salt}".encode(),
        120_000,
    ).hex()
    return hmac.compare_digest(expected, digest)


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.utcnow()
    existing = bind.execute(
        sa.select(users.c.password_hash).where(users.c.username == ADMIN_USERNAME)
    ).scalar_one_or_none()

    if existing is None:
        bind.execute(
            users.insert().values(
                username=ADMIN_USERNAME,
                password_hash=_hash_password(ADMIN_PASSWORD),
                display_name=ADMIN_USERNAME,
                role="ADMIN",
                status="ACTIVE",
                terms_accepted_at=now,
                privacy_accepted_at=now,
                terms_version=TERMS_VERSION,
                privacy_version=PRIVACY_VERSION,
                created_at=now,
                updated_at=now,
            )
        )
        return

    values = {
        "display_name": ADMIN_USERNAME,
        "role": "ADMIN",
        "status": "ACTIVE",
        "updated_at": now,
    }
    if not _verify_password(ADMIN_PASSWORD, existing):
        values["password_hash"] = _hash_password(ADMIN_PASSWORD)

    bind.execute(
        users.update()
        .where(users.c.username == ADMIN_USERNAME)
        .values(**values)
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(users.delete().where(users.c.username == ADMIN_USERNAME))
