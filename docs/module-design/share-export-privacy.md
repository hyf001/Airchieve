# 分享、导出与隐私详细设计

对应总览：`docs/module-design/module-design.md` 4.10 `share / export / privacy`

总设计文档：[module-design.md](module-design.md)

前端原型：[share.html](../frontend/share.html)、[player.html](../frontend/player.html)、[create.html](../frontend/create.html)、[characters.html](../frontend/characters.html)、[voices.html](../frontend/voices.html)、[stories.html](../frontend/stories.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 12 分享与导出，Story 13 儿童安全与隐私，并支撑 Story 7、10、11 中的上传授权确认。

## 1. 模块目标

管理个人绘本分享链接、公开访问、PDF 导出任务、导出文件、上传授权和分享/导出隐私确认。含个人角色形象或个人声音的分享和导出必须先记录隐私确认。

## 2. 前端设计

### 页面

- `pages/share`

### 功能模块

- `features/share`
  - 分享链接创建、复制、二维码、访问范围、关闭/恢复、重新生成、分享记录。
  - 公开分享页。
- `features/export`
  - PDF 导出入口、导出状态、导出记录、导出文件访问。
- `features/privacy`
  - 上传授权确认。
  - 分享/导出隐私确认。
  - 个人素材风险提示。

### 前端公开入口

- `ShareDialog`
- `ShareLinkList`
- `SharedBookPage`
- `SharePrivacyConfirm`
- `ExportButton`
- `ExportJobStatus`
- `ExportHistoryList`
- `UploadConsentDialog`
- `PrivacyConfirmDialog`
- `PrivacyRiskBadge`

## 3. 后端设计

### 后端归属

- `share`：分享链接、访问范围、分享页只读播放器数据、访问日志。
- `export`：PDF 导出任务、导出文件、导出状态。
- `privacy`：上传授权、个人素材默认私密策略、分享/导出风险确认。

### 前台 API

- `POST /api/v1/share/book/{book_id}`
- `GET /api/v1/share/links`
- `PATCH /api/v1/share/links/{share_id}`
- `POST /api/v1/share/links/{share_id}/close`
- `POST /api/v1/share/links/{share_id}/regenerate-token`
- `GET /api/v1/share/public/{token}`
- `GET /api/v1/share/public/{token}/player`
- `POST /api/v1/export/book/{book_id}`
- `GET /api/v1/export/jobs/{export_id}`
- `GET /api/v1/export/jobs`
- `GET /api/v1/export/jobs/{export_id}/file-url`
- `POST /api/v1/privacy/upload-consents`
- `POST /api/v1/privacy/confirmations`
- `GET /api/v1/privacy/flags`

### Service

- `create_share_link(user_id, book_id, payload) -> ShareLinkRead`
- `get_share_link(token) -> ShareLinkRead`
- `get_shared_player_payload(token, options) -> BookPlayerPayload`
- `close_share_link(user_id, share_id) -> ShareLinkRead`
- `regenerate_share_token(user_id, share_id) -> ShareLinkRead`
- `list_user_share_links(user_id, filters) -> Page[ShareLinkSummary]`
- `create_export_job(user_id, book_id, payload) -> ExportJobRead`
- `get_export_job(user_id, export_id) -> ExportJobRead`
- `list_export_jobs(user_id, filters) -> Page[ExportJobSummary]`
- `get_export_file_url(user_id, export_id) -> str`
- `record_upload_consent(user_id, target, consent_payload) -> UploadConsentRead`
- `record_privacy_confirmation(user_id, action, target) -> PrivacyConfirmationRead`
- `get_privacy_flags(target) -> PrivacyFlagsRead`

## 4. 数据库结构设计

### share 数据库定义

#### share_links

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 分享 ID |
| user_id | int indexed | 创建用户 |
| book_id | int indexed | 绘本 |
| token_hash | string unique | token hash |
| title_snapshot | string | 标题快照 |
| cover_asset_id_snapshot | string nullable | 封面快照 |
| access_scope | enum(`public`,`password`,`specified`) | 访问范围 |
| password_hash | string nullable | 访问密码 |
| status | enum(`active`,`closed`,`banned`,`expired`) | 状态 |
| privacy_confirmation_id | int nullable | 隐私确认 |
| expires_at | datetime nullable | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |

#### share_access_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 访问日志 |
| share_id | int FK share_links.id indexed | 分享 |
| visitor_id | string nullable | 访问者标识 |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| occurred_at | datetime | 访问时间 |

### export 数据库定义

#### export_jobs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 导出 ID |
| user_id | int indexed | 用户 |
| book_id | int indexed | 绘本 |
| export_type | enum(`pdf`) | 类型 |
| quality | enum(`standard`,`high`) | 清晰度 |
| status | enum(`queued`,`running`,`succeeded`,`failed`,`expired`) | 状态 |
| generation_task_id | int nullable | 任务 |
| file_asset_id | int nullable | 导出文件 |
| book_snapshot | JSON | 导出时绘本摘要 |
| privacy_confirmation_id | int nullable | 隐私确认 |
| quota_reservation_id | int nullable | 额度预占 |
| error_message | text nullable | 失败原因 |
| expires_at | datetime nullable | 文件有效期 |
| created_at / updated_at | datetime | 时间戳 |

### privacy 数据库定义

#### privacy_upload_consents

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 授权确认 ID |
| user_id | int indexed | 用户 |
| target_type | enum(`story`,`character_reference_image`,`voice_sample`,`upload_file`) | 目标类型 |
| target_id | int nullable | 已有目标 ID |
| consent_text_version | string | 授权文案版本 |
| confirmed_rights | bool | 确认拥有使用权 |
| confirmed_privacy | bool | 确认隐私提示 |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| created_at | datetime | 确认时间 |

#### privacy_confirmations

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 隐私确认 ID |
| user_id | int indexed | 用户 |
| action | enum(`share`,`export`) | 动作 |
| target_type | string | 目标类型 |
| target_id | int | 目标 ID |
| risk_flags | JSON array | `personal_character`,`personal_voice` 等 |
| confirmation_text_version | string | 文案版本 |
| created_at | datetime | 时间 |

#### privacy_visibility_policies

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 策略 ID |
| target_type | string | 目标类型 |
| target_id | int | 目标 ID |
| owner_user_id | int indexed | 所属用户 |
| visibility | enum(`private`,`shared_link`,`public`,`system`) | 可见性 |
| deletion_policy | enum(`soft_delete`,`retain_snapshot`) | 删除保留策略 |
| created_at / updated_at | datetime | 时间戳 |
## 5. 跨模块协作

- 调用 `book` 获取绘本详情和播放器 payload。
- 调用 `entitlement` 校验分享数量、导出次数和导出清晰度。
- 调用 `privacy` 做个人素材风险确认。
- 调用 `generation_task` 管理导出任务。
- 调用 `analytics` 记录分享访问事件。

## 6. 边界规则

- 分享页只读播放，不开放编辑。
- 导出不管理分享链接。
- 隐私模块不上传文件、不审核内容、不修改业务对象。
- 前端不生成 PDF，不自行拼接绘本页面媒体。
