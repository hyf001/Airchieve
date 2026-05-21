from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.audit import AuditLog
from app.schema.audit import AuditLogCreateInternal, AuditLogListRead, AuditLogRead, AuditSnapshot


def _snapshot_to_json(snapshot: AuditSnapshot | None) -> dict[str, object] | None:
    return snapshot.values if snapshot else None


def _read(log: AuditLog) -> AuditLogRead:
    return AuditLogRead(
        id=log.id,
        operator_type=log.operator_type,
        operator_id=log.operator_id,
        action=log.action,
        target_type=log.target_type,
        target_id=log.target_id,
        before_snapshot=AuditSnapshot(values=log.before_snapshot or {}) if log.before_snapshot is not None else None,
        after_snapshot=AuditSnapshot(values=log.after_snapshot or {}) if log.after_snapshot is not None else None,
        result=log.result,
        reason=log.reason,
        request_id=log.request_id,
        ip_hash=log.ip_hash,
        user_agent=log.user_agent,
        created_at=log.created_at,
    )


async def write_audit_log(db: AsyncSession, payload: AuditLogCreateInternal, *, commit: bool = True) -> AuditLogRead:
    log = AuditLog(
        operator_type=payload.operator_type,
        operator_id=payload.operator_id,
        action=payload.action,
        target_type=payload.target_type,
        target_id=payload.target_id,
        before_snapshot=_snapshot_to_json(payload.before_snapshot),
        after_snapshot=_snapshot_to_json(payload.after_snapshot),
        result=payload.result,
        reason=payload.reason,
        request_id=payload.request_id,
        ip_hash=payload.ip_hash,
        user_agent=payload.user_agent,
    )
    db.add(log)
    if commit:
        await db.commit()
    else:
        await db.flush()
    await db.refresh(log)
    return _read(log)


async def list_audit_logs(
    db: AsyncSession,
    *,
    action: str | None = None,
    target_type: str | None = None,
    operator_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> AuditLogListRead:
    conditions = []
    if action:
        conditions.append(AuditLog.action == action)
    if target_type:
        conditions.append(AuditLog.target_type == target_type)
    if operator_id is not None:
        conditions.append(AuditLog.operator_id == operator_id)
    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*conditions))
    result = await db.execute(
        select(AuditLog)
        .where(*conditions)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return AuditLogListRead(
        items=[_read(log) for log in result.scalars().all()],
        total=int(total or 0),
        limit=limit,
        offset=offset,
    )


async def get_audit_log(db: AsyncSession, log_id: int) -> AuditLogRead:
    log = await db.get(AuditLog, log_id)
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="审计日志不存在")
    return _read(log)
