# 发现、推荐与绘本详情详细设计

对应总览：`docs/module-design/module-design.md` 4.3 `discovery / recommendation`

总设计文档：[module-design.md](module-design.md)

前端原型：[index.html](../frontend/index.html)、[book-detail.html](../frontend/book-detail.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 1 首页发现与快速开始，Story 8 基于绘本创建类似作品。

## 1. 模块目标

负责首页发现、绘本搜索、分类浏览、推荐位、运营专题、绘本详情和创建类似作品入口。它只做内容发现和入口编排，不实现播放器和生成流程。

## 2. 前端设计

### 页面

- `pages/home`
- `pages/book-detail`

### 功能模块

- `features/discovery`
  - 首页推荐内容展示。
  - 精选、新上架、热门播放、免费可读、会员精选、睡前推荐、中英双语推荐。
  - 搜索入口和分类筛选。
  - 继续阅读入口。
  - 按场景开始入口。
  - 绘本详情页主体。
  - 相关绘本推荐。
  - 创建类似作品入口。
- `features/recommendation`
  - 推荐位渲染。
  - 专题展示。
  - 后台推荐位配置入口可由 `admin` 组合。

### 领域组件

- `entities/book`：`BookCard`、`BookGrid`、`BookDetailPanel`。
- `entities/recommendation`：`RecommendationSlot`、`TopicCard`、`RecommendationItemRenderer`。

### 前端公开入口

- `BookCard`
- `BookGrid`
- `BookDetailPanel`
- `RecommendationSlot`
- `StartSimilarCreationButton`

## 3. 后端设计

### 后端归属

- `book`：绘本列表和详情。
- `recommendation`：推荐位、专题、排序和展示规则。
- `taxonomy`：筛选条件。
- `reading`：继续阅读数据。

### 前台 API

- `GET /api/v1/books`
- `GET /api/v1/books/{book_id}`
- `POST /api/v1/books/{book_id}/similar-creation-session`
- `GET /api/v1/recommendations/{slot_code}`
- `GET /api/v1/recommendations/home`
- `GET /api/v1/recommendations/book/{book_id}/related`
- `GET /api/v1/reading/recent`

### 后台 API

- `POST /api/v1/admin/recommendation/slots`
- `PATCH /api/v1/admin/recommendation/slots/{slot_id}`
- `PUT /api/v1/admin/recommendation/slots/{slot_id}/items`
- `PATCH /api/v1/admin/recommendation/items/{item_id}/status`

### Service

- `list_books(filters) -> Page[BookSummary]`
- `get_book_detail(user_id, book_id) -> BookDetailRead`
- `create_session_from_book_reference(user_id, book_id, payload) -> CreationSessionRead`
- `list_recommendations(slot, context) -> RecommendationSlotRead`
- `get_recommendation_slot(slot_code) -> RecommendationSlotRead`
- `update_recommendation_items(slot_id, items) -> RecommendationSlotRead`
- `list_recent_reads(user_id, profile_id=None) -> list[RecentReadSummary]`

## 4. 数据库结构设计

### recommendation 数据库定义

#### recommendation_slots

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 推荐位 ID |
| code | string unique | 推荐位 code |
| name | string | 名称 |
| page | enum(`home`,`category`,`book_detail`,`player_end`,`creation_entry`) | 页面 |
| display_type | enum(`carousel`,`grid`,`list`,`topic`) | 展示类型 |
| rule_config | JSON | 用户状态、儿童档案、场景规则 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### recommendation_items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 推荐项 |
| slot_id | int FK recommendation_slots.id indexed | 推荐位 |
| target_type | enum(`book`,`story`,`template`,`art_style`,`character`,`voice`,`topic`) | 目标类型 |
| target_id | int | 目标 ID |
| title_override | string nullable | 展示标题覆盖 |
| image_asset_id_override | string nullable | 展示图覆盖 |
| scene_codes | JSON array | 适用场景 |
| min_age | integer nullable | 最小年龄 |
| max_age | integer nullable | 最大年龄 |
| access_level_filter | enum(`all`,`free`,`vip`) | 权益过滤 |
| sort_weight | integer | 排序权重 |
| start_at | datetime nullable | 生效时间 |
| end_at | datetime nullable | 结束时间 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### recommendation_topics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 专题 ID |
| title | string | 标题 |
| summary | text nullable | 简介 |
| cover_asset_id | int nullable | 封面 |
| topic_type | enum(`festival`,`new_books`,`emotion`,`culture`,`custom`) | 专题类型 |
| status | enum(`draft`,`published`,`unpublished`) | 状态 |
| sort_weight | integer | 排序 |
| created_at / updated_at | datetime | 时间戳 |
## 5. 跨模块协作

- 调用 `profile-management/account` 获取当前儿童档案上下文。
- 调用 `membership/entitlement` 展示免费、试看、VIP 状态。
- 调用 `creation` 创建类似作品会话。
- 跳转 `book-player` 播放。

## 6. 边界规则

- 不实现播放器控制。
- 不保存阅读进度。
- 不直接处理会员扣减。
- 不管理故事正文编辑。
- 推荐模块不拥有被推荐内容，只保存推荐关系和展示规则。
