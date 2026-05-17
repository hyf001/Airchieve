# recommendation 模块详细设计

## 功能

- 管理首页、分类页、绘本详情页、播放器结束页、生成入口等推荐位和运营专题。
- 推荐目标可以是故事、绘本、模板、画风、形象、声音、专题和外部活动配置。
- 根据用户状态、儿童档案、场景、权益状态返回推荐内容。
- 只保存推荐关系、排序和展示规则，不拥有被推荐内容。

## 接口

### 前台 API

- `GET /api/v1/recommendations/{slot_code}`：获取指定推荐位。
- `GET /api/v1/recommendations/home`：首页推荐聚合。
- `GET /api/v1/recommendations/book/{book_id}/related`：绘本详情相关推荐。

### 后台 API

- `POST /api/v1/admin/recommendation/slots`：创建推荐位。
- `PATCH /api/v1/admin/recommendation/slots/{slot_id}`：更新推荐位。
- `PUT /api/v1/admin/recommendation/slots/{slot_id}/items`：替换推荐项。
- `PATCH /api/v1/admin/recommendation/items/{item_id}/status`：启用/停用推荐项。

### Service

- `list_recommendations(slot, context) -> RecommendationSlotRead`
- `get_recommendation_slot(slot_code) -> RecommendationSlotRead`
- `upsert_recommendation_slot(payload) -> RecommendationSlotRead`
- `update_recommendation_items(slot_id, items) -> RecommendationSlotRead`
- `list_topics(filters) -> Page[RecommendationTopicRead]`

## 数据库定义

### recommendation_slots

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 推荐位 ID |
| code | string unique | 推荐位 code |
| name | string | 名称 |
| page | enum(`home`,`category`,`book_detail`,`player_end`,`creation_entry`) | 页面 |
| display_type | enum(`carousel`,`grid`,`list`,`topic`) | 展示类型 |
| rule_config | JSON | 用户状态、儿童档案、场景规则 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### recommendation_items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 推荐项 |
| slot_id | FK recommendation_slots.id indexed | 推荐位 |
| target_type | enum(`book`,`story`,`template`,`art_style`,`character`,`voice`,`topic`) | 目标类型 |
| target_id | string | 目标 ID |
| title_override | string nullable | 展示标题覆盖 |
| image_asset_id_override | string nullable | 展示图覆盖 |
| scene_ids | JSON array | 适用场景 |
| min_age | integer nullable | 最小年龄 |
| max_age | integer nullable | 最大年龄 |
| access_level_filter | enum(`all`,`free`,`vip`) | 权益过滤 |
| sort_weight | integer | 排序权重 |
| start_at | datetime nullable | 生效时间 |
| end_at | datetime nullable | 结束时间 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

### recommendation_topics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 专题 ID |
| title | string | 标题 |
| summary | text nullable | 简介 |
| cover_asset_id | string nullable | 封面 |
| topic_type | enum(`festival`,`new_books`,`emotion`,`culture`,`custom`) | 专题类型 |
| status | enum(`draft`,`published`,`unpublished`) | 状态 |
| sort_weight | integer | 排序 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `RecommendationContext`：登录状态、儿童档案、年龄、兴趣、阅读水平、场景、会员状态。
- `RecommendationSlotRead`：推荐位、展示类型、推荐项列表。
- `RecommendationItemRead`：目标引用、目标摘要、展示覆盖字段、权益状态。
- `RecommendationSlotUpsert`：推荐位基础信息和规则。
- `RecommendationItemsUpdate`：推荐项目标、排序、时间窗、展示覆盖。

