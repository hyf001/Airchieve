# entitlement 模块详细设计

## 功能

- 统一处理会员权益、VIP 权限、数量上限和额度扣减。
- 被故事、绘本、素材、创作、模板、分享、导出、账号等模块同步调用。
- 支持额度预占、确认和释放，避免异步任务失败或重复点击造成重复扣减。
- 不创建业务对象，不处理支付回调，不保存业务内容。

## 接口

### Service

- `get_user_entitlements(user_id) -> UserEntitlementsRead`
- `can_access_book(user_id, book_id) -> AccessDecision`
- `can_use_asset(user_id, asset_ref) -> AccessDecision`
- `assert_can_create(user_id, resource_type) -> None`
- `assert_can_use_vip_resource(user_id, resource_type, resource_id) -> None`
- `reserve_quota(user_id, quota_key, amount=1, idempotency_key=None) -> QuotaReservationRead`
- `confirm_quota(reservation_id) -> None`
- `release_quota(reservation_id, reason) -> None`
- `consume_quota(user_id, quota_key, amount=1, idempotency_key=None) -> QuotaUsageRead`

## 数据库定义

### entitlement_quota_reservations

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 预占 ID |
| user_id | string indexed | 用户 ID |
| quota_key | string | 额度项 |
| amount | integer | 预占数量 |
| period_key | string | 计费/自然周期 |
| idempotency_key | string nullable | 幂等键 |
| status | enum(`reserved`,`confirmed`,`released`,`expired`) | 状态 |
| reason | string nullable | 释放或失败原因 |
| expires_at | datetime nullable | 预占过期时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, quota_key, idempotency_key` where `idempotency_key` not null。

## Schema 定义

- `UserEntitlementsRead`：`plan_code`、`membership_status`、`limits`、`usages`、`vip_permissions`。
- `AccessDecision`：`allowed`、`access_level`、`preview_pages?`、`reason_code?`、`upgrade_required`。
- `QuotaReservationRead`：`id`、`quota_key`、`amount`、`status`、`expires_at`。
- `QuotaUsageRead`：`quota_key`、`used_amount`、`limit_amount?`、`remaining_amount?`、`period_key`。

