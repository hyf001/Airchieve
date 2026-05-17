# privacy 模块详细设计

## 功能

- 记录用户上传故事、图片、个人形象、个人声音前的权利确认。
- 记录分享、导出含个人形象或个人声音的绘本前的隐私风险确认。
- 管理个人素材默认私密、删除保留策略和隐私风险标记查询。
- 不上传或删除文件，不创建业务对象，不处理审核结论。

## 接口

### 前台 API

- `POST /api/v1/privacy/upload-consents`：记录上传授权确认。
- `POST /api/v1/privacy/confirmations`：记录分享/导出隐私确认。
- `GET /api/v1/privacy/flags`：查询目标隐私风险标记。

### Service

- `record_upload_consent(user_id, target, consent_payload) -> UploadConsentRead`
- `assert_upload_consent(user_id, target) -> None`
- `record_privacy_confirmation(user_id, action, target) -> PrivacyConfirmationRead`
- `get_privacy_flags(target) -> PrivacyFlagsRead`
- `has_personal_material(target) -> bool`

## 数据库定义

### privacy_upload_consents

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 授权确认 ID |
| user_id | string indexed | 用户 |
| target_type | enum(`story`,`character_reference_image`,`voice_sample`,`upload_file`) | 目标类型 |
| target_id | string nullable | 已有目标 ID |
| consent_text_version | string | 授权文案版本 |
| confirmed_rights | bool | 确认拥有使用权 |
| confirmed_privacy | bool | 确认隐私提示 |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| created_at | datetime | 确认时间 |

### privacy_confirmations

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 隐私确认 ID |
| user_id | string indexed | 用户 |
| action | enum(`share`,`export`) | 动作 |
| target_type | string | 目标类型 |
| target_id | string | 目标 ID |
| risk_flags | JSON array | `personal_character`,`personal_voice` 等 |
| confirmation_text_version | string | 文案版本 |
| created_at | datetime | 时间 |

### privacy_visibility_policies

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 策略 ID |
| target_type | string | 目标类型 |
| target_id | string | 目标 ID |
| owner_user_id | string indexed | 所属用户 |
| visibility | enum(`private`,`shared_link`,`public`,`system`) | 可见性 |
| deletion_policy | enum(`soft_delete`,`retain_snapshot`) | 删除保留策略 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `UploadConsentCreate`：目标类型、目标 ID、文案版本、权利确认、隐私确认。
- `UploadConsentRead`：授权确认 ID、目标、版本、确认时间。
- `PrivacyConfirmationCreate`：动作、目标引用、风险标记、文案版本。
- `PrivacyConfirmationRead`：确认 ID、动作、目标、风险标记、确认时间。
- `PrivacyFlagsRead`：目标引用、是否包含个人形象、是否包含个人声音、是否需要分享/导出确认。

