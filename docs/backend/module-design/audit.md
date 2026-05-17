# audit 模块详细设计

## 功能

- 记录后台写操作、支付关键状态变化和敏感配置变更。
- 保存操作人、动作、目标引用、变更前后快照、请求上下文和结果。
- 审计日志是历史事实，不随业务对象删除而物理删除。
- 不执行目标业务动作，不替代 moderation。

## 接口

### 后台 API

- `GET /api/v1/admin/audit/logs`：审计日志列表。
- `GET /api/v1/admin/audit/logs/{log_id}`：审计日志详情。

### Service

- `write_audit_log(operator, action, target, before, after) -> AuditLogRead`
- `list_audit_logs(filters) -> Page[AuditLogRead]`
- `get_audit_log(log_id) -> AuditLogRead`

## 数据库定义

### audit_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 日志 ID |
| operator_type | enum(`admin`,`system`,`payment_provider`) | 操作人类型 |
| operator_id | string nullable indexed | 操作人 ID |
| action | string indexed | 动作 |
| target_type | string indexed | 目标类型 |
| target_id | string indexed | 目标 ID |
| before_snapshot | JSON nullable | 变更前 |
| after_snapshot | JSON nullable | 变更后 |
| result | enum(`succeeded`,`failed`) | 结果 |
| reason | text nullable | 原因 |
| request_id | string nullable | 请求 ID |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| created_at | datetime indexed | 操作时间 |

## Schema 定义

- `AuditLogCreateInternal`：操作人、动作、目标、前后快照、结果、原因、请求上下文。
- `AuditLogRead`：日志完整字段。
- `AuditLogFilters`：操作人、动作、目标、结果、时间范围。

