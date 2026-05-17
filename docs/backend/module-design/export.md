# export 模块详细设计

## 功能

- 管理绘本 PDF 导出任务、导出文件、导出状态和导出记录。
- 导出前调用 `entitlement` 校验导出次数和清晰度；含个人形象或声音时调用 `privacy` 记录确认。
- PDF 生成通过 `generation_task`，导出文件通过 `storage`。
- 不负责分享链接，不修改绘本内容。

## 接口

### 前台 API

- `POST /api/v1/exports/book/{book_id}`：发起 PDF 导出。
- `GET /api/v1/exports/{export_id}`：查询导出状态。
- `GET /api/v1/exports`：导出记录列表。
- `GET /api/v1/exports/{export_id}/file-url`：获取导出文件地址。

### Service

- `create_export_job(user_id, book_id, payload) -> ExportJobRead`
- `get_export_job(user_id, export_id) -> ExportJobRead`
- `list_export_jobs(user_id, filters) -> Page[ExportJobSummary]`
- `get_export_file_url(user_id, export_id) -> str`
- `mark_export_succeeded(export_id, file_asset_id) -> ExportJobRead`
- `mark_export_failed(export_id, error) -> ExportJobRead`

## 数据库定义

### export_jobs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 导出 ID |
| user_id | string indexed | 用户 |
| book_id | string indexed | 绘本 |
| export_type | enum(`pdf`) | 类型 |
| quality | enum(`standard`,`high`) | 清晰度 |
| status | enum(`queued`,`running`,`succeeded`,`failed`,`expired`) | 状态 |
| generation_task_id | string nullable | 任务 |
| file_asset_id | string nullable | 导出文件 |
| book_snapshot | JSON | 导出时绘本摘要 |
| privacy_confirmation_id | string nullable | 隐私确认 |
| quota_reservation_id | string nullable | 额度预占 |
| error_message | text nullable | 失败原因 |
| expires_at | datetime nullable | 文件有效期 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `ExportJobCreate`：`quality`、`privacy_confirmation_id?`、`idempotency_key?`。
- `ExportJobRead`：导出 ID、绘本摘要、状态、清晰度、任务进度、文件状态、过期时间。
- `ExportJobSummary`：列表字段。
- `ExportFileUrlRead`：`url`、`expires_at`。

