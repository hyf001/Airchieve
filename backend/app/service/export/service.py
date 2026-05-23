from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus
from app.model.export import ExportJob, ExportJobStatus, ExportQuality
from app.model.generation_task import GenerationTask
from app.model.privacy import PrivacyAction
from app.schema.entitlement import EntitlementQuotaKey
from app.schema.export import ExportFileUrlRead, ExportJobCreate, ExportJobListRead, ExportJobRead
from app.schema.generation_task import GenerationTaskCreate
from app.schema.membership import PdfExportQuality
from app.schema.privacy import PrivacyTarget
from app.service import entitlement as entitlement_service, membership as membership_service
from app.service.generation_task import service as generation_task_service
from app.service.privacy import service as privacy_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _assert_book_exportable(db: AsyncSession, user_id: int, book_id: int) -> Book:
    book = await db.get(Book, book_id)
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    if book.owner_user_id is not None and book.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return book


def _read_job(job: ExportJob) -> ExportJobRead:
    return ExportJobRead.model_validate(job)


async def create_export_job(db: AsyncSession, user_id: int, book_id: int, payload: ExportJobCreate) -> ExportJobRead:
    book = await _assert_book_exportable(db, user_id, book_id)
    if payload.idempotency_key:
        existing = await db.execute(
            select(ExportJob).where(
                ExportJob.user_id == user_id,
                ExportJob.idempotency_key == payload.idempotency_key,
            )
        )
        existing_job = existing.scalar_one_or_none()
        if existing_job is not None:
            return _read_job(existing_job)
    config = await membership_service.get_user_entitlement_config(db, user_id)
    if payload.quality == ExportQuality.HIGH and config.pdf_export_quality != PdfExportQuality.HD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="高清 PDF 导出需要会员权益")
    flags = await privacy_service.get_privacy_flags(
        db,
        PrivacyTarget(target_type="book", target_id=book_id),
        user_id=user_id,
        action=PrivacyAction.EXPORT,
    )
    if flags.requires_confirmation:
        await privacy_service.assert_privacy_confirmation(
            db,
            user_id=user_id,
            confirmation_id=payload.privacy_confirmation_id,
            action=PrivacyAction.EXPORT,
            target=PrivacyTarget(target_type="book", target_id=book_id),
        )
    quota = await entitlement_service.consume_quota(
        db,
        user_id,
        EntitlementQuotaKey.PDF_EXPORT_MONTHLY,
        idempotency_key=payload.idempotency_key,
    )
    job = ExportJob(
        user_id=user_id,
        book_id=book.id,
        export_type=payload.export_type,
        quality=payload.quality,
        status=ExportJobStatus.QUEUED,
        generation_task_id=None,
        file_url=None,
        idempotency_key=payload.idempotency_key,
        book_snapshot={
            "id": book.id,
            "title": book.title,
            "cover_url": book.cover_url,
            "page_count": book.page_count,
            "access_level": book.access_level.value,
        },
        privacy_confirmation_id=payload.privacy_confirmation_id,
        quota_reservation_id=None,
        expires_at=_now() + timedelta(days=30),
    )
    db.add(job)
    await db.flush()
    task = await generation_task_service.create_task(
        db,
        GenerationTaskCreate(
            task_type="pdf_export",
            owner_type="export_job",
            owner_id=job.id,
            user_id=user_id,
            input_payload={"book_id": book.id, "quality": payload.quality.value},
            provider="placeholder",
        ),
    )
    job.generation_task_id = task.id
    await db.commit()
    await db.refresh(job)
    _ = quota
    return _read_job(job)


async def run_pdf_export_task(db: AsyncSession, task: GenerationTask) -> None:
    if task.owner_type != "export_job":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF_EXPORT_OWNER_INVALID")
    job = await db.get(ExportJob, task.owner_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出任务不存在")
    job.status = ExportJobStatus.RUNNING
    job.file_url = f"/api/v1/export/jobs/{job.id}/file-download"
    job.status = ExportJobStatus.SUCCEEDED
    job.expires_at = job.expires_at or (_now() + timedelta(days=30))
    await generation_task_service.mark_task_succeeded(
        db,
        task.id,
        result_refs={"export_job_id": job.id, "file_url": job.file_url, "placeholder": True},
    )


async def mark_pdf_export_task_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    if task.owner_type != "export_job":
        return
    job = await db.get(ExportJob, task.owner_id)
    if job is not None:
        job.status = ExportJobStatus.FAILED
        job.error_message = (str(exc) or exc.__class__.__name__)[:500]


async def get_export_job(db: AsyncSession, user_id: int, export_id: int) -> ExportJobRead:
    job = await db.get(ExportJob, export_id)
    if job is None or job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出任务不存在")
    return _read_job(job)


async def list_export_jobs(db: AsyncSession, user_id: int, *, limit: int = 20, offset: int = 0) -> ExportJobListRead:
    conditions = [ExportJob.user_id == user_id]
    result = await db.execute(select(ExportJob).where(*conditions).order_by(ExportJob.created_at.desc()).offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(ExportJob).where(*conditions))
    return ExportJobListRead(items=[_read_job(job) for job in result.scalars().all()], total=total or 0, limit=limit, offset=offset)


async def get_export_file_url(db: AsyncSession, user_id: int, export_id: int) -> ExportFileUrlRead:
    job = await db.get(ExportJob, export_id)
    if job is None or job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出任务不存在")
    if job.status != ExportJobStatus.SUCCEEDED or job.file_url is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="导出文件尚未生成")
    if job.expires_at is not None and job.expires_at <= _now():
        job.status = ExportJobStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="导出文件已过期")
    return ExportFileUrlRead(export_id=job.id, file_url=job.file_url, expires_at=job.expires_at)
