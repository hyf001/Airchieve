from sqlalchemy.ext.asyncio import AsyncSession

from app.model.audit import AuditLog
from app.schema.audit import AuditLogCreateInternal, AuditLogRead, AuditSnapshot


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


async def write_audit_log(db: AsyncSession, payload: AuditLogCreateInternal) -> AuditLogRead:
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
    await db.commit()
    await db.refresh(log)
    return _read(log)
