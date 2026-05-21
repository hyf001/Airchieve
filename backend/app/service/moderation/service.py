from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import AssetModerationStatus, Character, Voice
from app.model.audit import AuditOperatorType
from app.model.book import Book, BookModerationStatus
from app.model.moderation import ModerationRecord, ModerationStatus, Report, ReportStatus
from app.model.share import ShareLink, ShareLinkStatus
from app.model.story import Story, StoryModerationStatus
from app.schema.audit import AuditLogCreateInternal, AuditSnapshot
from app.schema.domain_event import DomainEventCreate
from app.schema.moderation import (
    ModerationHandleRequest,
    ModerationRecordCreateInternal,
    ModerationRecordListRead,
    ModerationRecordRead,
    ModerationReportRead,
    ModerationSnapshot,
    ReportCreate,
)
from app.service import audit as audit_service, domain_event


TARGET_MODELS = {
    "story": Story,
    "book": Book,
    "character": Character,
    "voice": Voice,
    "share_link": ShareLink,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _snapshot_from_row(row: object | None) -> ModerationSnapshot:
    if row is None:
        return ModerationSnapshot()
    return ModerationSnapshot(
        title=getattr(row, "title", None) or getattr(row, "name", None) or getattr(row, "title_snapshot", None),
        summary=getattr(row, "summary", None) or getattr(row, "description", None),
        owner_user_id=getattr(row, "owner_user_id", None) or getattr(row, "user_id", None),
        preview_url=getattr(row, "cover_url", None) or getattr(row, "image_url", None) or getattr(row, "sample_url", None),
        values={
            "publish_status": getattr(getattr(row, "publish_status", None), "value", getattr(row, "publish_status", None)),
            "moderation_status": getattr(getattr(row, "moderation_status", None), "value", getattr(row, "moderation_status", None)),
            "status": getattr(getattr(row, "status", None), "value", getattr(row, "status", None)),
        },
    )


def _record_read(record: ModerationRecord) -> ModerationRecordRead:
    return ModerationRecordRead(
        id=record.id,
        target_type=record.target_type,
        target_id=record.target_id,
        submitter_user_id=record.submitter_user_id,
        status=record.status,
        reason=record.reason,
        reviewer_id=record.reviewer_id,
        reviewed_at=record.reviewed_at,
        snapshot=ModerationSnapshot(**(record.snapshot or {})),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _report_read(report: Report) -> ModerationReportRead:
    return ModerationReportRead.model_validate(report)


async def _load_target(db: AsyncSession, target_type: str, target_id: int) -> object | None:
    model = TARGET_MODELS.get(target_type)
    if model is None:
        return None
    return await db.get(model, target_id)


async def _assert_report_target(db: AsyncSession, target_type: str, target_id: int) -> object:
    if target_type not in TARGET_MODELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的举报目标类型")
    target = await _load_target(db, target_type, target_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="举报目标不存在")
    return target


async def ensure_moderation_record(
    db: AsyncSession,
    payload: ModerationRecordCreateInternal,
) -> ModerationRecordRead:
    existing = await db.scalar(
        select(ModerationRecord).where(
            ModerationRecord.target_type == payload.target_type,
            ModerationRecord.target_id == payload.target_id,
            ModerationRecord.status == ModerationStatus.PENDING,
        )
    )
    if existing is not None:
        return _record_read(existing)
    record = ModerationRecord(
        target_type=payload.target_type,
        target_id=payload.target_id,
        submitter_user_id=payload.submitter_user_id,
        status=payload.status,
        reason=payload.reason,
        snapshot=payload.snapshot.model_dump(),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _record_read(record)


async def create_report(
    db: AsyncSession,
    *,
    user_id: int | None,
    payload: ReportCreate,
) -> ModerationReportRead:
    target = await _assert_report_target(db, payload.target_type, payload.target_id)
    report = Report(
        reporter_user_id=user_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason_type=payload.reason_type,
        description=payload.description,
    )
    db.add(report)
    await db.flush()
    await ensure_moderation_record(
        db,
        ModerationRecordCreateInternal(
            target_type=payload.target_type,
            target_id=payload.target_id,
            submitter_user_id=user_id,
            reason=payload.description,
            snapshot=_snapshot_from_row(target),
        ),
    )
    await domain_event.publish_event(
        db,
        DomainEventCreate(
            event_type="moderation.report_created",
            actor_type="user" if user_id else "anonymous",
            actor_id=user_id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            payload={"report_id": report.id, "reason_type": payload.reason_type.value},
            consumers=["analytics"],
        ),
    )
    await db.refresh(report)
    return _report_read(report)


async def list_moderation_records(
    db: AsyncSession,
    *,
    status_filter: ModerationStatus | None = None,
    target_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> ModerationRecordListRead:
    conditions = []
    if status_filter is not None:
        conditions.append(ModerationRecord.status == status_filter)
    if target_type:
        conditions.append(ModerationRecord.target_type == target_type)
    stmt = select(ModerationRecord).where(*conditions).order_by(ModerationRecord.created_at.desc())
    total = await db.scalar(select(func.count()).select_from(ModerationRecord).where(*conditions))
    result = await db.execute(stmt.offset(offset).limit(limit))
    return ModerationRecordListRead(
        items=[_record_read(record) for record in result.scalars().all()],
        total=int(total or 0),
        limit=limit,
        offset=offset,
    )


async def get_moderation_record(db: AsyncSession, record_id: int) -> ModerationRecordRead:
    record = await db.get(ModerationRecord, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="审核记录不存在")
    return _record_read(record)


def _target_before_after(target: object | None) -> AuditSnapshot | None:
    if target is None:
        return None
    return AuditSnapshot(values=_snapshot_from_row(target).model_dump())


def _apply_target_status(target: object | None, decision: ModerationStatus) -> None:
    if target is None:
        return
    if isinstance(target, Story):
        target.moderation_status = StoryModerationStatus(decision.value)
    elif isinstance(target, Book):
        target.moderation_status = BookModerationStatus(decision.value)
    elif isinstance(target, Character | Voice):
        target.moderation_status = AssetModerationStatus(decision.value)
    elif isinstance(target, ShareLink) and decision == ModerationStatus.HIDDEN:
        target.status = ShareLinkStatus.BANNED


async def handle_moderation_record(
    db: AsyncSession,
    *,
    operator_id: int,
    record_id: int,
    payload: ModerationHandleRequest,
) -> ModerationRecordRead:
    record = await db.get(ModerationRecord, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="审核记录不存在")
    target = await _load_target(db, record.target_type, record.target_id)
    before = _target_before_after(target)
    _apply_target_status(target, payload.status)
    record.status = payload.status
    record.reason = payload.reason
    record.reviewer_id = operator_id
    record.reviewed_at = _now()
    result_text = payload.report_result or payload.reason
    reports = await db.execute(
        select(Report).where(
            Report.target_type == record.target_type,
            Report.target_id == record.target_id,
            Report.status.in_([ReportStatus.PENDING, ReportStatus.PROCESSING]),
        )
    )
    for report in reports.scalars().all():
        report.mark_resolved(operator_id, result_text)
    await db.flush()
    after = _target_before_after(target)
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action="moderation.handle",
            target_type=record.target_type,
            target_id=record.target_id,
            before_snapshot=before,
            after_snapshot=after,
            reason=payload.reason,
        ),
        commit=False,
    )
    await domain_event.publish_event(
        db,
        DomainEventCreate(
            event_type="moderation.record_handled",
            actor_type="admin",
            actor_id=operator_id,
            target_type=record.target_type,
            target_id=record.target_id,
            payload={"record_id": record.id, "status": payload.status.value},
            consumers=["analytics"],
        ),
    )
    await db.refresh(record)
    return _record_read(record)
