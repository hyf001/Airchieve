# template 模块详细设计

## 功能

- 将已有绘本标记为模板，管理可替换角色、角色出现页码、每页头像/形象替换区域和声音替换规则。
- 模板不维护独立页面内容；页面正文、插图背景、音效、互动提示、学习卡片和播放结构来自原绘本。
- 基于模板创作时只能替换已标注角色区域和朗读声音，不允许更换画风、背景、页面构图和正文。
- 头像/形象合成和音频重生成通过 `generation_task`。

## 接口

### 前台 API

- `GET /api/v1/templates`：模板列表。
- `GET /api/v1/templates/{template_id}`：模板详情和可替换角色。
- `POST /api/v1/templates/{template_id}/validate-replacements`：校验角色替换。
- `POST /api/v1/templates/{template_id}/preview`：生成替换预览。
- `POST /api/v1/templates/{template_id}/create-book`：基于模板保存个人绘本。

### 后台 API

- `POST /api/v1/admin/templates/from-book/{book_id}`：将绘本设为模板。
- `PATCH /api/v1/admin/templates/{template_id}`：更新模板基础信息。
- `POST /api/v1/admin/templates/{template_id}/characters`：添加模板角色。
- `PATCH /api/v1/admin/templates/{template_id}/characters/{character_id}`：更新角色。
- `POST /api/v1/admin/templates/{template_id}/regions`：添加页面替换区域。
- `PATCH /api/v1/admin/templates/{template_id}/regions/{region_id}`：更新区域。
- `POST /api/v1/admin/templates/{template_id}/validate`：模板配置校验。

### Service

- `get_template(template_id) -> TemplateRead`
- `list_templates(filters) -> Page[TemplateSummary]`
- `create_template_from_book(book_id, payload) -> TemplateRead`
- `mark_page_character(template_id, page_id, payload) -> TemplateCharacterRead`
- `update_page_character_region(template_id, region_id, payload) -> TemplateRegionRead`
- `validate_template_replacements(user_id, template_id, replacements) -> TemplateValidationResult`
- `preview_template_replacement(user_id, template_id, payload) -> GenerationTaskRead`
- `create_book_from_template(user_id, template_id, payload) -> BookRead`

## 数据库定义

### book_templates

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 模板 ID |
| source_book_id | string indexed | 原型绘本 |
| title | string | 模板标题 |
| summary | text nullable | 简介 |
| cover_asset_id | string nullable | 封面 |
| default_voice_id | string nullable | 默认声音 |
| access_level | enum(`free`,`preview`,`vip`) | 权益 |
| allow_voice_replacement | bool | 是否允许替换声音 |
| allowed_voice_scope | enum(`default_only`,`system`,`user_and_system`) | 可用声音范围 |
| status | enum(`draft`,`published`,`unpublished`,`deleted`) | 状态 |
| validation_status | enum(`unchecked`,`valid`,`invalid`) | 校验状态 |
| sort_order | integer | 排序 |
| created_at / updated_at | datetime | 时间戳 |

### template_characters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 模板角色 ID |
| template_id | FK book_templates.id indexed | 模板 |
| role_code | string | `hero`、`friend` 等 |
| name | string | 角色名 |
| description | text nullable | 角色说明 |
| required | bool | 是否必填 |
| default_character_id | string nullable | 默认形象 |
| allowed_replacement_sources | JSON array | `child_profile`,`user_character`,`system_character`,`upload`,`generated` |
| appear_page_nos | JSON array | 出现页码 |
| sort_order | integer | 排序 |

唯一约束：`template_id,role_code`。

### template_replace_regions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 区域 ID |
| template_id | FK book_templates.id indexed | 模板 |
| template_character_id | FK template_characters.id | 角色 |
| page_id | string | 原绘本页面 |
| page_no | integer | 页码 |
| x | numeric | 区域 x，0-1 |
| y | numeric | 区域 y，0-1 |
| width | numeric | 区域宽，0-1 |
| height | numeric | 区域高，0-1 |
| mask_asset_id | string nullable | 遮罩 |
| z_index | integer | 层级 |
| border_radius | numeric nullable | 圆角/裁切 |
| replacement_rule | JSON | 裁切、缩放、融合规则 |
| status | enum(`active`,`disabled`) | 状态 |

### template_creation_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 复用记录 |
| user_id | string indexed | 用户 |
| template_id | string indexed | 模板 |
| result_book_id | string nullable | 生成绘本 |
| replacements | JSON | 角色替换和声音替换 |
| status | enum(`previewing`,`generating`,`saved`,`failed`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `TemplateSummary`：封面、标题、适龄、主题、页数、角色数量、权益状态。
- `TemplateRead`：模板基础信息、原绘本摘要、角色、替换区域、声音规则。
- `TemplateCharacterCreate`：角色名称、说明、必填、默认形象、可用替换来源、出现页码。
- `TemplateRegionCreate`：角色、页码、坐标、尺寸、遮罩、层级、裁切规则。
- `TemplateReplacementRequest`：角色替换列表、声音替换、隐私确认 ID。
- `TemplateValidationResult`：是否通过、缺失必填角色、区域遮挡风险、不可用素材列表。
- `TemplatePreviewRead`：预览任务、预览页、替换效果 URL。

