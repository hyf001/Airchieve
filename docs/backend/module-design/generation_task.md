# generation_task 模块详细设计

## 功能

- 管理 AI 生成和导出任务生命周期：创建、排队、运行、成功、失败、重试。
- 任务类型包括故事、分镜、插图、语音、对口型、模板头像/形象合成、PDF 导出。
- 保存输入摘要、输出引用、进度、失败原因和重试记录。
- 不判断权益，不决定结果归属，不写复杂业务规则。

## 接口

### 前台 API

- `GET /api/v1/generation-tasks/{task_id}`：查询任务状态。
- `POST /api/v1/generation-tasks/{task_id}/retry`：重试任务，需调用发起模块校验权限。

### Service

- `create_task(task_type, input_payload, owner) -> GenerationTaskRead`
- `get_task(task_id) -> GenerationTaskRead`
- `mark_running(task_id) -> None`
- `mark_succeeded(task_id, output_payload) -> None`
- `mark_failed(task_id, error) -> None`
- `retry_task(task_id) -> GenerationTaskRead`
- `list_tasks(filters) -> Page[GenerationTaskSummary]`

## 数据库定义

### generation_tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 任务 ID |
| task_type | enum(`story`,`storyboard`,`image`,`audio`,`lip_sync`,`template_composite`,`pdf_export`) | 类型 |
| owner_type | string | 发起模块，如 `creation` |
| owner_id | string | 发起对象 ID |
| user_id | string nullable indexed | 用户 |
| status | enum(`queued`,`running`,`succeeded`,`failed`,`canceled`) | 状态 |
| progress_percent | integer | 进度 |
| input_payload | JSON | 输入摘要 |
| output_payload | JSON nullable | 输出引用 |
| provider | string nullable | AI/导出 provider |
| error_code | string nullable | 错误码 |
| error_message | text nullable | 错误信息 |
| retry_count | integer | 重试次数 |
| started_at | datetime nullable | 开始时间 |
| finished_at | datetime nullable | 完成时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`owner_type,owner_id`、`user_id,status`、`task_type,status`。

### generation_task_attempts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 尝试 ID |
| task_id | FK generation_tasks.id indexed | 任务 |
| attempt_no | integer | 尝试次数 |
| status | enum(`running`,`succeeded`,`failed`) | 状态 |
| provider_request_id | string nullable | provider 请求 ID |
| error_payload | JSON nullable | 错误详情 |
| started_at | datetime | 开始时间 |
| finished_at | datetime nullable | 结束时间 |

## Schema 定义

- `GenerationTaskCreateInternal`：任务类型、owner、用户、输入摘要。
- `GenerationTaskRead`：任务 ID、类型、状态、进度、输出、错误、重试次数。
- `GenerationTaskSummary`：后台列表字段。
- `TaskOutputPayload`：按任务类型返回文件引用、文本结果、页面结果或导出文件引用。
- `TaskError`：`error_code`、`message`、`retryable`。

