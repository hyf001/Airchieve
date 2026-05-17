# 分类配置详细设计

对应总览：`docs/module-design/module-design.md` 4.4 `taxonomy`

总设计文档：[module-design.md](module-design.md)

前端原型：[index.html](../frontend/index.html)、[stories.html](../frontend/stories.html)、[create.html](../frontend/create.html)、[profile.html](../frontend/profile.html)、[characters.html](../frontend/characters.html)、[voices.html](../frontend/voices.html)、[artstyle.html](../frontend/artstyle.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 中涉及年龄段、主题、教育目标、阅读水平、语言、叙事风格、场景和素材分类的需求，主要覆盖 Story 1、5、6、7、9、10、11。

## 1. 模块目标

统一管理年龄段、主题、兴趣标签、教育目标、阅读水平、语言、叙事风格、推荐场景、声音风格、素材分类等配置。前台筛选、生成配置、后台配置必须使用同一套 taxonomy。

## 2. 前端设计

### 使用场景

- 首页和绘本列表筛选。
- 故事库筛选。
- 儿童档案兴趣、年龄、阅读水平、教育目标。
- 创作流程故事参数、语言、叙事风格、教育目标。
- 素材库分类和适用年龄。
- 后台分类配置。

### 领域组件

- `entities/taxonomy/TaxonomySelect`
- `entities/taxonomy/TaxonomyMultiSelect`
- `entities/taxonomy/TaxonomyFilterBar`
- `entities/taxonomy/useTaxonomyGroup(type)`

## 3. 后端设计

### 后端归属

- API：`taxonomy_api.py`
- Schema：`schema/taxonomy.py`
- Service：`taxonomy_service.py`
- Model：`taxonomy.py`

### 前台 API

- `GET /api/v1/taxonomy`
- `GET /api/v1/taxonomy/{type}`

### 后台 API

- `POST /api/v1/admin/taxonomy/items`
- `PATCH /api/v1/admin/taxonomy/items/{item_id}`
- `PATCH /api/v1/admin/taxonomy/items/{item_id}/status`
- `PATCH /api/v1/admin/taxonomy/items/reorder`

### Service

- `list_taxonomy(type, include_disabled=False) -> list[TaxonomyItemRead]`
- `get_taxonomy_item(id) -> TaxonomyItemRead`
- `validate_taxonomy_ids(type, ids) -> None`
- `upsert_taxonomy_item(payload) -> TaxonomyItemRead`
- `set_taxonomy_status(item_id, status) -> TaxonomyItemRead`

## 4. 数据库结构设计

### taxonomy 数据库定义

#### taxonomy_items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 分类项 ID |
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
## 5. 边界规则

- 前端不硬编码分类列表。
- 业务判断使用稳定 `code`，展示使用后端返回名称。
- taxonomy 不依赖故事、绘本、素材、会员。
- 业务模块只调用 taxonomy 校验和读取配置。
