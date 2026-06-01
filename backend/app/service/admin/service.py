from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import BackgroundMusic, Character, Voice
from app.model.audit import AuditLog
from app.model.book import Book
from app.model.export import ExportJob
from app.model.moderation import ModerationRecord, ModerationStatus, Report
from app.model.share import ShareLink
from app.model.story import Story
from app.model.template import BookTemplate
from app.schema.admin import AdminContentOverviewRead, AdminDashboardRead
from app.service import analytics


async def _count(db: AsyncSession, model: type[object], *conditions: object) -> int:
    value = await db.scalar(select(func.count()).select_from(model).where(*conditions))
    return int(value or 0)


async def get_admin_dashboard(db: AsyncSession) -> AdminDashboardRead:
    operation_dashboard = await analytics.get_operation_dashboard(db)
    return AdminDashboardRead(
        pending_moderation_count=await _count(db, ModerationRecord, ModerationRecord.status == ModerationStatus.PENDING),
        report_count=await _count(db, Report),
        audit_log_count=await _count(db, AuditLog),
        analytics=operation_dashboard,
    )


async def get_content_overview(db: AsyncSession) -> AdminContentOverviewRead:
    return AdminContentOverviewRead(
        stories=await _count(db, Story),
        books=await _count(db, Book),
        templates=await _count(db, BookTemplate),
        characters=await _count(db, Character),
        voices=await _count(db, Voice),
        background_music=await _count(db, BackgroundMusic),
        share_links=await _count(db, ShareLink),
        export_jobs=await _count(db, ExportJob),
    )
