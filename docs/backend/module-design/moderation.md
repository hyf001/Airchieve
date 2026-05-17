# moderation 模块详细设计

## 功能

- 管理故事、绘本、形象、声音、分享、导出的审核记录和用户举报。
- 支持通过、驳回、隐藏、下架、封禁分享链接等处理动作。
- 处理审核和举报结果时必须调用目标模块公开 service 执行业务状态变化。
- 不直接实现上下架、删除、生成等目标业务动作。

## 接口

### 前台 API

- `POST /api/v1/moderation/reports`：提交举报。

### 后台 API

- `GET /api/v1/admin/moderation/records`：审核记录列表。
- `PATCH /api/v1/admin/moderation/records/{record_id}`：处理审核记录。
- `GET /api/v1/admin/moderation/reports`：举报列表。
- `PATCH /api/v1/admin/moderation/reports/{report_id}`：处理举报。

### Service

- `create_moderation_record(target) -> ModerationRecordRead`
- `update_moderation_status(target, status, reason) -> ModerationRecordRead`
- `create_report(user_id, target, reason) -> ReportRead`
- `handle_report(report_id, result) -> ReportRead`
- `list_moderation_records(filters) -> Page[ModerationRecordRead]`
- `list_reports(filters) -> Page[ReportRead]`

## 数据库定义

### moderation_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 审核记录 |
| target_type | string indexed | 目标类型 |
| target_id | string indexed | 目标 ID |
| submitter_user_id | string nullable | 提交人 |
| status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| reason | text nullable | 原因 |
| reviewer_id | string nullable | 审核人 |
| reviewed_at | datetime nullable | 审核时间 |
| snapshot | JSON | 目标摘要快照 |
| created_at / updated_at | datetime | 时间戳 |

### reports

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 举报 ID |
| reporter_user_id | string nullable indexed | 举报人 |
| target_type | string indexed | 目标类型 |
| target_id | string indexed | 目标 ID |
| reason_type | enum(`age_inappropriate`,`copyright`,`privacy`,`abnormal`,`other`) | 举报原因 |
| description | text nullable | 描述 |
| status | enum(`pending`,`processing`,`resolved`,`rejected`) | 处理状态 |
| handler_id | string nullable | 处理人 |
| result | text nullable | 处理结果 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `ModerationRecordRead`：目标引用、状态、原因、审核人、快照、时间。
- `ModerationStatusUpdate`：`status`、`reason`。
- `ReportCreate`：目标引用、原因类型、描述。
- `ReportRead`：举报完整字段。
- `ReportHandleRequest`：处理状态、处理结果、目标动作建议。

