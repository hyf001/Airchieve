# 素材库与存储详细设计

对应总览：`docs/module-design/module-design.md` 4.8 `character-library / voice-library / art-style-library / asset / storage`

总设计文档：[module-design.md](module-design.md)

前端原型：[characters.html](../frontend/characters.html)、[voices.html](../frontend/voices.html)、[artstyle.html](../frontend/artstyle.html)、[create.html](../frontend/create.html)、[profile.html](../frontend/profile.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 9 画风管理，Story 10 形象管理，Story 11 我的声音管理，并支撑 Story 6 绘本生成和 Story 13 隐私授权。

## 1. 模块目标

统一管理系统素材和用户素材，包括角色形象、画风、声音、头像/参考图和媒体文件引用；封装上传、文件访问和存储 provider 差异。

## 2. 前端设计

### 页面

- `pages/characters`
- `pages/voices`
- `pages/art-styles`

### 功能模块

- `features/character-library`
  - 我的角色形象、系统角色形象、创建形象、文字生成形象、上传头像或参考图、选择画风、输入生成指令、重命名、删除、默认形象。
- `features/voice-library`
  - 我的声音、系统声音、上传声音、处理状态、试听、重命名、删除、默认声音。
- `features/art-style-library`
  - 系统画风、自定义画风描述、画风筛选、画风对比、角色形象生成中的画风选择器。

### 领域组件

- `entities/asset/AssetCard`
- `entities/asset/AssetPreview`
- `entities/asset/AssetUploadField`
- `entities/asset/AssetAccessBadge`
- `CharacterSelector`
- `CharacterCreateForm`
- `VoiceSelector`
- `ArtStyleSelector`

## 3. 后端设计

### 后端归属

- `asset`：角色形象、画风、声音、头像/参考图媒体资产引用和素材状态。
- `storage`：上传会话、文件访问 URL、存储 provider 差异。
- `privacy`：上传授权和个人素材隐私确认。

### 前台 API

- `GET /api/v1/assets/characters`
- `POST /api/v1/assets/characters`
- `PATCH /api/v1/assets/characters/{character_id}`
- `DELETE /api/v1/assets/characters/{character_id}`
- `POST /api/v1/assets/characters/{character_id}/default`
- `GET /api/v1/assets/art-styles`
- `POST /api/v1/assets/custom-art-styles`
- `GET /api/v1/assets/voices`
- `POST /api/v1/assets/voices`
- `PATCH /api/v1/assets/voices/{voice_id}`
- `DELETE /api/v1/assets/voices/{voice_id}`
- `POST /api/v1/assets/voices/{voice_id}/default`

### Service

- `get_asset(asset_id) -> AssetRead`
- `get_asset_url(asset_id) -> str`
- `list_characters(user_id, filters) -> list[CharacterSummary]`
- `get_character(character_id) -> CharacterRead`
- `create_character(user_id, payload) -> CharacterRead`
- `list_art_styles(filters) -> list[ArtStyleRead]`
- `get_art_style(style_id) -> ArtStyleRead`
- `list_voices(user_id, filters) -> list[VoiceSummary]`
- `get_voice(voice_id) -> VoiceRead`
- `assert_asset_usable(user_id, asset_type, asset_id) -> AssetInternalDTO`
- `create_upload_session(user_id, payload) -> UploadSessionRead`
- `complete_upload(upload_session_id, payload) -> AssetStorageDTO`
- `get_file_url(storage_key, expires_in=None) -> str`

## 4. 关键契约与校验规则

### CharacterCreateRequest

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 角色形象名称 |
| identity_tag | string nullable | 女儿、儿子、妈妈等 |
| description | text nullable | 描述 |
| reference_asset_id | int nullable | 用户上传头像或参考图 |
| art_style_id | int nullable | 系统画风 ID |
| custom_art_style_prompt | text nullable | 自定义画风描述 |
| generation_prompt | text | 形象生成指令 |

校验：

- `art_style_id` 和 `custom_art_style_prompt` 必须至少提供一个。
- `reference_asset_id` 只能作为生成参考素材，不能直接写入 `characters.image_asset_id`。
- 创建角色形象必须触发 `generation_task.task_type=character_image`，任务成功后写入生成后的 `image_asset_id`。
- 使用 VIP 画风或超过个人角色形象数量上限时必须由 `entitlement` 拦截。

## 5. 数据库结构设计

### asset 数据库定义

#### assets

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 文件/媒体资产 ID |
| owner_user_id | int nullable indexed | 所属用户；系统素材为空 |
| asset_kind | enum(`image`,`audio`,`video`,`pdf`,`other`) | 文件类型 |
| storage_key | string | 存储 key |
| mime_type | string | MIME |
| byte_size | integer nullable | 大小 |
| checksum | string nullable | 校验 |
| visibility | enum(`private`,`public`,`system`) | 可见性 |
| status | enum(`uploading`,`ready`,`deleted`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### characters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 角色形象 ID |
| owner_user_id | int nullable indexed | 用户角色形象所属人；系统形象为空 |
| name | string | 名称 |
| identity_tag | string nullable | 女儿、儿子、妈妈等 |
| description | text nullable | 描述 |
| image_asset_id | int nullable | AI 生成后的角色形象主图；生成任务完成前为空 |
| reference_asset_id | int nullable | 用户上传头像或参考图 |
| art_style_id | int nullable FK art_styles.id | 绑定画风；系统存量形象可为空但必须有等价 code |
| art_style_code | string nullable | 绑定系统画风 code |
| custom_art_style_prompt | text nullable | 自定义画风描述 |
| generation_prompt | text nullable | 形象生成指令 |
| category_code | string nullable | taxonomy:asset_category |
| age_range_codes | JSON array | 适用年龄 |
| access_level | enum(`free`,`vip`) | 系统素材权益 |
| source_type | enum(`system`,`ai_generated`) | 来源 |
| is_default | bool | 用户默认 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| status | enum(`active`,`deleted`,`disabled`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### art_styles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 画风 ID |
| owner_user_id | int nullable | 自定义画风所属人；系统画风为空 |
| code | string nullable unique | 系统画风 code |
| name | string | 名称 |
| description | text | 描述 |
| prompt | text nullable | 生成提示词 |
| example_asset_id | int nullable | 示例图 |
| age_range_codes | JSON array | 适用年龄 |
| access_level | enum(`free`,`vip`) | 权益 |
| sort_order | integer | 排序 |
| status | enum(`active`,`inactive`,`deleted`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### voices

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 声音 ID |
| owner_user_id | int nullable indexed | 用户声音所属人；系统声音为空 |
| name | string | 名称 |
| voice_style_code | string nullable | taxonomy:voice_style |
| sample_asset_id | int nullable | 试听样本 |
| source_sample_asset_id | int nullable | 用户原始样本 |
| supported_languages | JSON array | 支持语言 |
| duration_seconds | integer nullable | 样本时长 |
| access_level | enum(`free`,`vip`) | 系统声音权益 |
| source_type | enum(`system`,`user_upload`,`voice_clone`) | 来源 |
| processing_status | enum(`pending`,`processing`,`ready`,`failed`) | 处理状态 |
| failure_reason | string nullable | 失败原因 |
| is_default | bool | 用户默认 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| status | enum(`active`,`deleted`,`disabled`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### storage 数据库定义

#### storage_upload_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 上传会话 |
| user_id | int nullable indexed | 上传用户 |
| purpose | enum(`character`,`voice`,`story_file`,`book_media`,`export`,`task_result`) | 用途 |
| filename | string | 原始文件名 |
| mime_type | string | MIME |
| max_byte_size | integer | 最大大小 |
| storage_key | string | 目标 key |
| status | enum(`created`,`completed`,`expired`,`failed`) | 状态 |
| expires_at | datetime | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |
## 6. 跨模块协作

- 调用 `entitlement` 校验 VIP 素材和个人素材数量上限。
- 调用 `privacy` 记录上传授权和个人素材隐私状态。
- 调用 `storage` 处理文件上传和访问 URL。
- 调用 `generation_task` / `ai_provider` 生成角色形象主图，并将结果写回 `characters.image_asset_id`。
- 被 `creation`、`profile-management`、`book-player`、`template` 复用选择器。

## 7. 边界规则

- 素材库不编排绘本生成流程。
- 画风是独立资源，但角色形象必须保存生成时绑定的画风；绘本插图画风以所选角色形象为准。
- 用户头像或参考图不直接进入绘本生成结果，只作为角色形象生成素材。
- 删除形象或声音不删除历史绘本中的已生成媒体。
- `storage` 不理解业务语义，不判断会员权益，不记录授权。
