# asset 模块详细设计

## 功能

- 统一管理系统素材和用户素材：形象、画风、声音、媒体文件引用。
- 支持用户形象创建、上传参考图、重命名、删除、设为默认；系统形象列表和权益标记。
- 支持系统画风列表、自定义画风描述保存。
- 支持用户声音上传、处理状态、试听、删除、设为默认；系统声音列表和权益标记。
- 文件上传和访问 URL 通过 `storage_service`；上传授权和个人素材隐私通过 `privacy_service`。

## 接口

### 前台 API

- `GET /api/v1/assets/characters`：形象列表，合并我的和系统。
- `POST /api/v1/assets/characters`：创建/生成个人形象。
- `PATCH /api/v1/assets/characters/{character_id}`：重命名、推荐画风、身份标签。
- `DELETE /api/v1/assets/characters/{character_id}`：软删除个人形象。
- `POST /api/v1/assets/characters/{character_id}/default`：设为默认形象。
- `GET /api/v1/assets/art-styles`：系统画风和可用自定义画风。
- `POST /api/v1/assets/custom-art-styles`：保存自定义画风描述。
- `GET /api/v1/assets/voices`：声音列表，合并我的和系统。
- `POST /api/v1/assets/voices`：上传/创建个人声音。
- `PATCH /api/v1/assets/voices/{voice_id}`：重命名。
- `DELETE /api/v1/assets/voices/{voice_id}`：软删除声音。
- `POST /api/v1/assets/voices/{voice_id}/default`：设为默认声音。

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

## 数据库定义

### assets

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 文件/媒体资产 ID |
| owner_user_id | string nullable indexed | 所属用户；系统素材为空 |
| asset_kind | enum(`image`,`audio`,`video`,`pdf`,`other`) | 文件类型 |
| storage_key | string | 存储 key |
| mime_type | string | MIME |
| byte_size | integer nullable | 大小 |
| checksum | string nullable | 校验 |
| visibility | enum(`private`,`public`,`system`) | 可见性 |
| status | enum(`uploading`,`ready`,`deleted`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### characters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 形象 ID |
| owner_user_id | string nullable indexed | 用户形象所属人；系统形象为空 |
| name | string | 名称 |
| identity_tag | string nullable | 女儿、儿子、妈妈等 |
| description | text nullable | 描述 |
| image_asset_id | string | 主图 |
| reference_asset_id | string nullable | 参考图 |
| recommended_art_style_id | string nullable | 推荐画风 |
| category_id | string nullable | taxonomy:asset_category |
| age_range_ids | JSON array | 适用年龄 |
| access_level | enum(`free`,`vip`) | 系统素材权益 |
| source_type | enum(`system`,`user_upload`,`ai_generated`) | 来源 |
| is_default | bool | 用户默认 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| status | enum(`active`,`deleted`,`disabled`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### art_styles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 画风 ID |
| owner_user_id | string nullable | 自定义画风所属人；系统画风为空 |
| code | string nullable unique | 系统画风 code |
| name | string | 名称 |
| description | text | 描述 |
| prompt | text nullable | 生成提示词 |
| example_asset_id | string nullable | 示例图 |
| age_range_ids | JSON array | 适用年龄 |
| access_level | enum(`free`,`vip`) | 权益 |
| sort_order | integer | 排序 |
| status | enum(`active`,`inactive`,`deleted`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### voices

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 声音 ID |
| owner_user_id | string nullable indexed | 用户声音所属人；系统声音为空 |
| name | string | 名称 |
| voice_style_id | string nullable | taxonomy:voice_style |
| sample_asset_id | string nullable | 试听样本 |
| source_sample_asset_id | string nullable | 用户原始样本 |
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

## Schema 定义

- `AssetRead`：文件 ID、类型、URL、大小、状态、可见性。
- `CharacterCreate`：名称、身份标签、描述、生成提示/上传文件引用、推荐画风、授权确认 ID。
- `CharacterRead`：形象完整字段、图片 URL、权益状态、可用状态。
- `ArtStyleRead`：名称、描述、示例图、适龄、免费/VIP、状态。
- `CustomArtStyleCreate`：`name?`、`description`、`prompt`。
- `VoiceCreate`：名称、样本文件引用、授权确认 ID、语言。
- `VoiceRead`：声音完整字段、试听 URL、处理状态、权益状态。
- `AssetInternalDTO`：跨模块使用的 `asset_type`、`id`、`owner_user_id?`、`access_level`、`status`、展示摘要。

