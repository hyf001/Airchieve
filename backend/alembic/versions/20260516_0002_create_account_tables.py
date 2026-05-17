"""create account tables

Revision ID: 20260516_0002
Revises: 20260516_0001
Create Date: 2026-05-16 13:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260516_0002"
down_revision: str | Sequence[str] | None = "20260516_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("avatar_asset_id", sa.String(length=64), nullable=True),
        sa.Column("role", sa.Enum("PARENT", "TEACHER", "ADMIN", name="userrole"), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DISABLED", name="userstatus"), nullable=False),
        sa.Column("default_child_profile_id", sa.String(length=36), nullable=True),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terms_version", sa.String(length=64), nullable=True),
        sa.Column("privacy_version", sa.String(length=64), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.create_table(
        "account_auth_identities",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.Enum("WECHAT", "PHONE", "EMAIL", name="authprovider"), nullable=False),
        sa.Column("provider_app_id", sa.String(length=120), nullable=True),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("union_id", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bound_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "UNBOUND", name="authidentitystatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_app_id", "provider_user_id", name="uq_auth_identity_provider_user"),
    )
    op.create_index(op.f("ix_account_auth_identities_union_id"), "account_auth_identities", ["union_id"], unique=False)
    op.create_index(op.f("ix_account_auth_identities_user_id"), "account_auth_identities", ["user_id"], unique=False)

    op.create_table(
        "sms_verification_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column(
            "scene",
            sa.Enum("REGISTER", "PHONE_LOGIN", "BIND_PHONE", "CHANGE_PHONE", "UNBIND_PHONE", name="smsscene"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("send_ip", sa.String(length=64), nullable=True),
        sa.Column("device_id", sa.String(length=120), nullable=True),
        sa.Column("captcha_ticket", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "VERIFIED", "EXPIRED", "BLOCKED", name="smscodestatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sms_verification_codes_expires_at"), "sms_verification_codes", ["expires_at"], unique=False)
    op.create_index(op.f("ix_sms_verification_codes_phone"), "sms_verification_codes", ["phone"], unique=False)
    op.create_index(op.f("ix_sms_verification_codes_user_id"), "sms_verification_codes", ["user_id"], unique=False)

    op.create_table(
        "account_risk_challenges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column(
            "action",
            sa.Enum(
                "SEND_SMS",
                "PHONE_LOGIN",
                "WECHAT_LOGIN",
                "BIND_PHONE",
                "BIND_WECHAT",
                "UPLOAD_CHARACTER",
                "CREATE_VOICE",
                "EXPORT_PDF",
                "SHARE_PERSONAL_ASSET",
                name="riskaction",
            ),
            nullable=False,
        ),
        sa.Column("provider", sa.Enum("SLIDER", "IMAGE", "SILENT", "THIRD_PARTY", name="captchaprovider"), nullable=False),
        sa.Column("ticket_hash", sa.String(length=128), nullable=False),
        sa.Column("device_id", sa.String(length=120), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PASSED", "FAILED", "EXPIRED", name="riskchallengestatus"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_hash"),
    )
    op.create_index(op.f("ix_account_risk_challenges_expires_at"), "account_risk_challenges", ["expires_at"], unique=False)
    op.create_index(op.f("ix_account_risk_challenges_user_id"), "account_risk_challenges", ["user_id"], unique=False)

    op.create_table(
        "account_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
        sa.Column("login_method", sa.Enum("PHONE_CODE", "PASSWORD", "WECHAT", "REGISTER", name="loginmethod"), nullable=False),
        sa.Column("device_id", sa.String(length=120), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("return_to", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index(op.f("ix_account_sessions_expires_at"), "account_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_account_sessions_user_id"), "account_sessions", ["user_id"], unique=False)

    op.create_table(
        "child_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("nickname", sa.String(length=80), nullable=False),
        sa.Column("age_range_id", sa.String(length=64), nullable=True),
        sa.Column("reading_level_id", sa.String(length=64), nullable=True),
        sa.Column("interest_tag_ids", sa.JSON(), nullable=False),
        sa.Column("education_goal_ids", sa.JSON(), nullable=False),
        sa.Column("default_character_id", sa.String(length=64), nullable=True),
        sa.Column("default_voice_id", sa.String(length=64), nullable=True),
        sa.Column("default_art_style_id", sa.String(length=64), nullable=True),
        sa.Column("visibility", sa.Enum("PRIVATE", name="childprofilevisibility"), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DELETED", name="childprofilestatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_child_profiles_user_id"), "child_profiles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_child_profiles_user_id"), table_name="child_profiles")
    op.drop_table("child_profiles")
    op.drop_index(op.f("ix_account_sessions_user_id"), table_name="account_sessions")
    op.drop_index(op.f("ix_account_sessions_expires_at"), table_name="account_sessions")
    op.drop_table("account_sessions")
    op.drop_index(op.f("ix_account_risk_challenges_user_id"), table_name="account_risk_challenges")
    op.drop_index(op.f("ix_account_risk_challenges_expires_at"), table_name="account_risk_challenges")
    op.drop_table("account_risk_challenges")
    op.drop_index(op.f("ix_sms_verification_codes_user_id"), table_name="sms_verification_codes")
    op.drop_index(op.f("ix_sms_verification_codes_phone"), table_name="sms_verification_codes")
    op.drop_index(op.f("ix_sms_verification_codes_expires_at"), table_name="sms_verification_codes")
    op.drop_table("sms_verification_codes")
    op.drop_index(op.f("ix_account_auth_identities_user_id"), table_name="account_auth_identities")
    op.drop_index(op.f("ix_account_auth_identities_union_id"), table_name="account_auth_identities")
    op.drop_table("account_auth_identities")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_table("users")
