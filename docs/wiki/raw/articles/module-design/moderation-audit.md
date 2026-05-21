---
source_url: file://docs/module-design/moderation-audit.md
ingested: 2026-05-20
sha256: a0af0b2d6bd0bf9a797628d6ec6cab1a59a56ab2eeb769a20fe7b9e10dc5ac58
---

# 审核、举报与审计详细设计

对应总览：`docs/module-design/module-design.md` 4.11 `moderation / audit`

总设计文档：[module-design.md](module-design.md)

前端原型：[player.html](../frontend/player.html)、[book-detail.html](../frontend/book-detail.html)。后台审核与审计暂无独立 HTML 原型，参考 [picture-book-website-prd.md](../picture-book-website-prd.md) 的后台与内容安全需求。

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 13 儿童安全与隐私，Story 14 绘本管理后台。

## 1. 模块目标

管理内容举报、审核记录、审核处理和后台审计日志。审核负责内容风险处理；审计负责记录后台写操作、支付关键状态和敏感配置变更。

## 2. 前端设计

### 功能模块

- `features/moderation`
  - 内容举报入口。
  - 举报表单。
  - 后台审核队列。
  - 审核处理详情。
- `entities/audit`
  - 审计日志表格。
  - 审计详情抽屉。
  - 目标对象跳转。

### 前端公开入口

- `ReportContentDialog`
- `ModerationQueue`
- `ModerationDecisionForm`
- `AuditLogTable`
- `AuditLogDetail`
- `AuditTargetLink`

## 3. 后端设计

### 后端归属

- `moderation`：内容审核、用户举报、处理状态。
- `audit`：后台写操作、支付关键状态、敏感配置变更日志。

### 前台 API

- `POST /api/v1/moderation/reports`

### 后台 API

- `GET /api/v1/admin/moderation/records`
- `GET /api/v1/admin/moderation/records/{record_id}`
- `POST /api/v1/admin/moderation/records/{record_id}/handle`
- `GET /api/v1/admin/audit/logs`
- `GET /api/v1/admin/audit/logs/{log_id}`

### Service

- `create_report(user_id, payload) -> ModerationReportRead`
- `list_moderation_records(filters) -> Page[ModerationRecordRead]`
- `handle_moderation_record(operator, record_id, payload) -> ModerationRecordRead`
- `write_audit_log(operator, action, target, before, after) -> AuditLogRead`
- `list_audit_logs(filters) -> Page[AuditLogRead]`
- `get_audit_log(log_id) -> AuditLogRead`

## 4. 数据库结构设计

### moderation 数据库定义

#### moderation_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 审核记录 |
| target_type | string indexed | 目标类型 |
| target_id | int indexed | 目标 ID |
| submitter_user_id | int nullable | 提交人 |
| status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| reason | text nullable | 原因 |
| reviewer_id | int nullable | 审核人 |
| reviewed_at | datetime nullable | 审核时间 |
| snapshot | JSON | 目标摘要快照 |
| created_at / updated_at | datetime | 时间戳 |

#### reports

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 举报 ID |
| reporter_user_id | int nullable indexed | 举报人 |
| target_type | string indexed | 目标类型 |
| target_id | int indexed | 目标 ID |
| reason_type | enum(`age_inappropriate`,`copyright`,`privacy`,`abnormal`,`other`) | 举报原因 |
| description | text nullable | 描述 |
| status | enum(`pending`,`processing`,`resolved`,`rejected`) | 处理状态 |
| handler_id | int nullable | 处理人 |
| result | text nullable | 处理结果 |
| created_at / updated_at | datetime | 时间戳 |

### audit 数据库定义

#### audit_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 日志 ID |
| operator_type | enum(`admin`,`system`,`payment_provider`) | 操作人类型 |
| operator_id | int nullable indexed | 操作人 ID |
| action | string indexed | 动作 |
| target_type | string indexed | 目标类型 |
| target_id | int indexed | 目标 ID |
| before_snapshot | JSON nullable | 变更前 |
| after_snapshot | JSON nullable | 变更后 |
| result | enum(`succeeded`,`failed`) | 结果 |
| reason | text nullable | 原因 |
| request_id | string nullable | 请求 ID |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| created_at | datetime indexed | 操作时间 |
## 5. 跨模块协作

- 审核处理需要调用目标模块 service 执行隐藏、下架、封禁等动作。
- 后台写操作必须写入 `audit`。
- 支付关键状态变化可写入审计或支付日志。

## 6. 边界规则

- 审核不替代隐私授权。
- 审计只记录事实，不执行目标业务动作。
- 前端不直接修改故事、绘本、素材状态。
- 审计日志不得提供删除或篡改入口。
