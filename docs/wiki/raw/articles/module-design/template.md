---
source_url: file://docs/module-design/template.md
ingested: 2026-05-20
sha256: e1e89589a78b7e344d6acd4325a8a697839e9f91b7f2deac23bb8ed72dcdb28a
---

# 绘本模板详细设计

对应总览：`docs/module-design/module-design.md` 4.7 `template`

总设计文档：[module-design.md](module-design.md)

前端原型：[create.html](../frontend/create.html)、[book-detail.html](../frontend/book-detail.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 6 绘本生成中“基于绘本模板创作绘本”的能力。

## 1. 模块目标

将已有绘本标记为可复用模板，管理可替换角色、角色出现页码、每页角色形象替换区域和声音替换规则。基于模板创作只能替换已标注角色形象区域和朗读声音。

## 2. 前端设计

### 使用场景

- `features/creation` 的模板创作路径。
- `features/admin` 的模板标注和校验后台。

### 领域组件

- `entities/template/TemplateCard`
- `entities/template/TemplateSelector`
- `entities/template/TemplateDetail`
- `entities/template/TemplateReplacementForm`
- `entities/template/TemplateRegionPreview`
- `features/admin/TemplateAdminEditor`

## 3. 后端设计

### 后端归属

- API：`template_api.py`
- Schema：`schema/template.py`
- Service：`template_service.py`
- Model：`template.py`

### 前台 API

- `GET /api/v1/templates`
- `GET /api/v1/templates/{template_id}`
- `POST /api/v1/templates/{template_id}/validate-replacements`
- `POST /api/v1/templates/{template_id}/preview`
- `POST /api/v1/templates/{template_id}/create-book`

### 后台 API

- `POST /api/v1/admin/templates/from-book/{book_id}`
- `PATCH /api/v1/admin/templates/{template_id}`
- `POST /api/v1/admin/templates/{template_id}/characters`
- `PATCH /api/v1/admin/templates/{template_id}/characters/{character_id}`
- `POST /api/v1/admin/templates/{template_id}/regions`
- `PATCH /api/v1/admin/templates/{template_id}/regions/{region_id}`
- `POST /api/v1/admin/templates/{template_id}/validate`

### Service

- `get_template(template_id) -> TemplateRead`
- `list_templates(filters) -> Page[TemplateSummary]`
- `create_template_from_book(book_id, payload) -> TemplateRead`
- `mark_page_character(template_id, page_id, payload) -> TemplateCharacterRead`
- `update_page_character_region(template_id, region_id, payload) -> TemplateRegionRead`
- `validate_template_replacements(user_id, template_id, replacements) -> TemplateValidationResult`
- `preview_template_replacement(user_id, template_id, payload) -> GenerationTaskRead`
- `create_book_from_template(user_id, template_id, payload) -> BookRead`

## 4. 数据库结构设计

### template 数据库定义

#### book_templates

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 模板 ID |
| source_book_id | int indexed | 原型绘本 |
| title | string | 模板标题 |
| summary | text nullable | 简介 |
| cover_asset_id | int nullable | 封面 |
| default_voice_id | int nullable | 默认声音 |
| access_level | enum(`free`,`preview`,`vip`) | 权益 |
| allow_voice_replacement | bool | 是否允许替换声音 |
| allowed_voice_scope | enum(`default_only`,`system`,`user_and_system`) | 可用声音范围 |
| status | enum(`draft`,`published`,`unpublished`,`deleted`) | 状态 |
| validation_status | enum(`unchecked`,`valid`,`invalid`) | 校验状态 |
| sort_order | integer | 排序 |
| created_at / updated_at | datetime | 时间戳 |

#### template_characters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 模板角色 ID |
| template_id | int FK book_templates.id indexed | 模板 |
| role_code | string | `hero`、`friend` 等 |
| name | string | 角色名 |
| description | text nullable | 角色说明 |
| required | bool | 是否必填 |
| default_character_id | int nullable | 默认角色形象 |
| allowed_replacement_sources | JSON array | `child_profile`,`user_character`,`system_character`,`generated` |
| appear_page_nos | JSON array | 出现页码 |
| sort_order | integer | 排序 |

唯一约束：`template_id,role_code`。

#### template_replace_regions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 区域 ID |
| template_id | int FK book_templates.id indexed | 模板 |
| template_character_id | int FK template_characters.id | 角色 |
| page_id | int | 原绘本页面 |
| page_no | integer | 页码 |
| x | numeric | 区域 x，0-1 |
| y | numeric | 区域 y，0-1 |
| width | numeric | 区域宽，0-1 |
| height | numeric | 区域高，0-1 |
| mask_asset_id | int nullable | 遮罩 |
| z_index | integer | 层级 |
| border_radius | numeric nullable | 圆角/裁切 |
| replacement_rule | JSON | 裁切、缩放、融合规则 |
| status | enum(`active`,`disabled`) | 状态 |

#### template_creation_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 复用记录 |
| user_id | int indexed | 用户 |
| template_id | int indexed | 模板 |
| result_book_id | int nullable | 生成绘本 |
| replacements | JSON | 角色替换和声音替换 |
| status | enum(`previewing`,`generating`,`saved`,`failed`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |
## 5. 跨模块协作

- 调用 `book` 读取原绘本、页面和媒体，并创建最终个人绘本。
- 调用 `asset` 读取用户角色形象、系统角色形象、角色形象绑定画风和声音。
- 调用 `entitlement` 校验模板、角色形象、声音权益。
- 调用 `generation_task` 触发替换合成或音频重生成任务。

## 6. 边界规则

- 不创建新的故事、分镜或页面内容。
- 不允许更换画风、插图背景、视频素材、页面构图、正文、互动提示、学习卡片和播放节奏。
- 前端模板创作不得暴露普通创作流程中的画风选择和分镜编辑。
- 用于替换的角色形象必须与模板画风保持一致；需要新画风时必须先生成符合模板画风的角色形象。
