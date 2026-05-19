"""g group membership payment share export

Revision ID: 20260519_0007
Revises: 20260519_0006
Create Date: 2026-05-19
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260519_0007"
down_revision = "20260519_0006"
branch_labels = None
depends_on = None

_now = datetime.now(timezone.utc)


def upgrade() -> None:
    op.create_table(
        "membership_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("billing_period", sa.Enum("NONE", "MONTH", "QUARTER", "YEAR", name="billingperiod"), nullable=False),
        sa.Column("entitlement_config", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "INACTIVE", name="membershipplanstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    for column in ("code", "sort_order", "status"):
        op.create_index(op.f(f"ix_membership_plans_{column}"), "membership_plans", [column], unique=False)

    membership_plans = sa.table(
        "membership_plans",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("price_cents", sa.Integer),
        sa.column("currency", sa.String),
        sa.column("billing_period", sa.String),
        sa.column("entitlement_config", sa.JSON),
        sa.column("sort_order", sa.Integer),
        sa.column("status", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        membership_plans,
        [
            {
                "code": "free",
                "name": "免费版",
                "description": "基础阅读和少量分享能力",
                "price_cents": 0,
                "currency": "CNY",
                "billing_period": "NONE",
                "entitlement_config": {
                    "access_level": "free",
                    "book_access_level": "free",
                    "child_profile_limit": 1,
                    "story_limit": 20,
                    "character_limit": 3,
                    "voice_limit": 1,
                    "share_monthly_limit": 5,
                    "book_generation_monthly_limit": 0,
                    "pdf_export_monthly_limit": 0,
                    "vip_asset_enabled": False,
                    "pdf_export_quality": "standard",
                },
                "sort_order": 1,
                "status": "ACTIVE",
                "created_at": _now,
                "updated_at": _now,
            },
            {
                "code": "monthly",
                "name": "月度会员",
                "description": "开放会员绘本、生成额度、分享和高清导出",
                "price_cents": 2900,
                "currency": "CNY",
                "billing_period": "MONTH",
                "entitlement_config": {
                    "access_level": "member",
                    "book_access_level": "member",
                    "child_profile_limit": 5,
                    "story_limit": 200,
                    "character_limit": 30,
                    "voice_limit": 10,
                    "share_monthly_limit": 9999,
                    "book_generation_monthly_limit": 20,
                    "pdf_export_monthly_limit": 10,
                    "vip_asset_enabled": True,
                    "pdf_export_quality": "hd",
                },
                "sort_order": 2,
                "status": "ACTIVE",
                "created_at": _now,
                "updated_at": _now,
            },
        ],
    )

    op.create_table(
        "user_memberships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("FREE", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED", name="usermembershipstatus"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_renew", sa.Boolean(), nullable=False),
        sa.Column("source", sa.Enum("SYSTEM", "PAYMENT", "ADMIN", name="membershipsource"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["membership_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("plan_id", "status", "user_id"):
        op.create_index(op.f(f"ix_user_memberships_{column}"), "user_memberships", [column], unique=False)

    op.create_table(
        "membership_usage_counters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("quota_key", sa.String(length=80), nullable=False),
        sa.Column("period_key", sa.String(length=32), nullable=False),
        sa.Column("used_amount", sa.Integer(), nullable=False),
        sa.Column("reserved_amount", sa.Integer(), nullable=False),
        sa.Column("reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "quota_key", "period_key", name="uq_membership_usage_user_quota_period"),
    )
    op.create_index(op.f("ix_membership_usage_counters_user_id"), "membership_usage_counters", ["user_id"], unique=False)

    op.create_table(
        "entitlement_quota_reservations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("quota_key", sa.String(length=80), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("period_key", sa.String(length=32), nullable=False),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("status", sa.Enum("RESERVED", "CONFIRMED", "RELEASED", "EXPIRED", name="quotareservationstatus"), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "quota_key", "idempotency_key", name="uq_entitlement_reservation_idempotency"),
    )
    for column in ("quota_key", "status", "user_id"):
        op.create_index(op.f(f"ix_entitlement_quota_reservations_{column}"), "entitlement_quota_reservations", [column], unique=False)

    op.create_table(
        "payment_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_no", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("provider", sa.Enum("WECHAT", "ALIPAY", "APP_STORE", "MANUAL", name="paymentprovider"), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "PAID", "FAILED", "CANCELED", "REFUNDED", name="paymentorderstatus"), nullable=False),
        sa.Column("provider_order_id", sa.String(length=120), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("return_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_no"),
    )
    for column in ("idempotency_key", "order_no", "plan_id", "provider_order_id", "status", "user_id"):
        op.create_index(op.f(f"ix_payment_orders_{column}"), "payment_orders", [column], unique=False)

    op.create_table(
        "payment_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.Enum("WECHAT", "ALIPAY", "APP_STORE", "MANUAL", name="paymentprovider"), nullable=False),
        sa.Column("event_type", sa.Enum("PAID", "FAILED", "REFUNDED", "CANCELED", name="paymenteventtype"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["payment_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("event_type", "occurred_at", "order_id"):
        op.create_index(op.f(f"ix_payment_records_{column}"), "payment_records", [column], unique=False)

    op.create_table(
        "refund_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("refund_no", sa.String(length=64), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "SUCCEEDED", "FAILED", name="refundstatus"), nullable=False),
        sa.Column("provider_refund_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["payment_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refund_no"),
    )
    for column in ("order_id", "refund_no"):
        op.create_index(op.f(f"ix_refund_records_{column}"), "refund_records", [column], unique=False)

    op.create_table(
        "share_links",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("title_snapshot", sa.String(length=160), nullable=False),
        sa.Column("cover_asset_id_snapshot", sa.Integer(), nullable=True),
        sa.Column("cover_url_snapshot", sa.String(length=500), nullable=True),
        sa.Column("access_scope", sa.Enum("PUBLIC", "PASSWORD", "SPECIFIED", name="shareaccessscope"), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("status", sa.Enum("ACTIVE", "CLOSED", "BANNED", "EXPIRED", name="sharelinkstatus"), nullable=False),
        sa.Column("privacy_confirmation_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_share_links_user_idempotency"),
        sa.UniqueConstraint("token_hash"),
    )
    for column in ("access_scope", "book_id", "expires_at", "idempotency_key", "privacy_confirmation_id", "status", "token_hash", "user_id"):
        op.create_index(op.f(f"ix_share_links_{column}"), "share_links", [column], unique=False)

    op.create_table(
        "share_access_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("share_id", sa.Integer(), nullable=False),
        sa.Column("visitor_id", sa.String(length=120), nullable=True),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["share_id"], ["share_links.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("occurred_at", "share_id", "visitor_id"):
        op.create_index(op.f(f"ix_share_access_logs_{column}"), "share_access_logs", [column], unique=False)

    op.create_table(
        "export_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("export_type", sa.Enum("PDF", name="exporttype"), nullable=False),
        sa.Column("quality", sa.Enum("STANDARD", "HIGH", name="exportquality"), nullable=False),
        sa.Column("status", sa.Enum("QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "EXPIRED", name="exportjobstatus"), nullable=False),
        sa.Column("generation_task_id", sa.Integer(), nullable=True),
        sa.Column("file_asset_id", sa.Integer(), nullable=True),
        sa.Column("file_url", sa.String(length=500), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("book_snapshot", sa.JSON(), nullable=False),
        sa.Column("privacy_confirmation_id", sa.Integer(), nullable=True),
        sa.Column("quota_reservation_id", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_export_jobs_user_idempotency"),
    )
    for column in ("book_id", "export_type", "expires_at", "generation_task_id", "idempotency_key", "privacy_confirmation_id", "quota_reservation_id", "status", "user_id"):
        op.create_index(op.f(f"ix_export_jobs_{column}"), "export_jobs", [column], unique=False)


def downgrade() -> None:
    op.drop_table("export_jobs")
    op.drop_table("share_access_logs")
    op.drop_table("share_links")
    op.drop_table("refund_records")
    op.drop_table("payment_records")
    op.drop_table("payment_orders")
    op.drop_table("entitlement_quota_reservations")
    op.drop_table("membership_usage_counters")
    op.drop_table("user_memberships")
    op.drop_table("membership_plans")
    if op.get_bind().dialect.name == "postgresql":
        for enum_name in (
            "exportjobstatus",
            "exportquality",
            "exporttype",
            "sharelinkstatus",
            "shareaccessscope",
            "refundstatus",
            "paymenteventtype",
            "paymentorderstatus",
            "paymentprovider",
            "quotareservationstatus",
            "membershipsource",
            "usermembershipstatus",
            "membershipplanstatus",
            "billingperiod",
        ):
            op.execute(sa.text(f"DROP TYPE IF EXISTS {enum_name}"))
