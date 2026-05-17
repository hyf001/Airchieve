# taxonomy 模块详细设计

## 功能

- 统一管理年龄段、主题、兴趣标签、教育目标、阅读水平、语言、叙事风格、推荐场景、声音风格等配置。
- 前台筛选、生成配置、后台配置共用同一套 taxonomy。
- 提供 code、展示名、排序、启用状态和适用范围。
- 不依赖故事、绘本、素材、会员等业务模块。

## 接口

### 前台 API

- `GET /api/v1/taxonomy`：按类型批量获取分类。
- `GET /api/v1/taxonomy/{type}`：获取指定类型分类。

### 后台 API

- `POST /api/v1/admin/taxonomy/items`：创建分类项。
- `PATCH /api/v1/admin/taxonomy/items/{item_id}`：更新分类项。
- `PATCH /api/v1/admin/taxonomy/items/{item_id}/status`：启用/停用。
- `PATCH /api/v1/admin/taxonomy/items/reorder`：排序。

### Service

- `list_taxonomy(type, include_disabled=False) -> list[TaxonomyItemRead]`
- `get_taxonomy_item(id) -> TaxonomyItemRead`
- `validate_taxonomy_ids(type, ids) -> None`
- `upsert_taxonomy_item(payload) -> TaxonomyItemRead`
- `set_taxonomy_status(item_id, status) -> TaxonomyItemRead`

## 数据库定义

### taxonomy_items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 分类项 ID |
| type | enum | `age_range`,`theme`,`interest_tag`,`education_goal`,`reading_level`,`language`,`narrative_style`,`scene`,`voice_style`,`asset_category` |
| code | string | 稳定 code |
| name | string | 中文展示名 |
| name_en | string nullable | 英文名 |
| description | text nullable | 描述 |
| metadata | JSON | 扩展配置，如年龄上下限 |
| sort_order | integer | 排序 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`type, code`。

## Schema 定义

- `TaxonomyItemCreate`：`type`、`code`、`name`、`name_en?`、`description?`、`metadata={}`、`sort_order=0`。
- `TaxonomyItemUpdate`：展示字段、metadata、排序、状态可选。
- `TaxonomyItemRead`：完整字段。
- `TaxonomyGroupRead`：`type`、`items`。

