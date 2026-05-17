# 数据事件与统计详细设计

对应总览：`docs/module-design/module-design.md` 4.12 `analytics / domain_event`

总设计文档：[module-design.md](module-design.md)

前端原型：暂无独立 HTML 原型；数据来自 [player.html](../frontend/player.html)、[create.html](../frontend/create.html)、[membership.html](../frontend/membership.html)、[share.html](../frontend/share.html) 等用户行为，后台统计参考 [picture-book-website-prd.md](../picture-book-website-prd.md)。

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 14 绘本管理后台和运营统计需求，并支撑播放、创作、订阅、分享等转化分析。

## 1. 模块目标

统一记录业务事件、领域事件投递状态和统计聚合，避免播放量、完播率、生成转化、订阅转化等口径散落在各业务模块。

## 2. 前端设计

### 功能模块

- `shared/analytics`
  - 前端行为埋点封装。
  - 统一事件名、目标对象、payload 格式。
- `features/analytics` 或 `features/admin`
  - 运营仪表盘。
  - 绘本指标。
  - 创作漏斗。

### 前端公开入口

- `trackClientEvent(eventType, target, payload)`
- `AnalyticsDashboard`
- `BookMetricsPanel`
- `CreationFunnelChart`

## 3. 后端设计

### 后端归属

- `domain_event`：领域事件发布、持久化、投递状态和失败重试。
- `analytics`：业务事件记录、统计聚合和运营数据查询。

### 后台/内部 API

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/books/{book_id}`
- `GET /api/v1/admin/analytics/creation-funnel`

### Service

- `publish_event(event_type, actor, target, payload) -> DomainEventRead`
- `list_pending_events(consumer, limit) -> list[DomainEventRead]`
- `mark_event_consumed(event_id, consumer) -> None`
- `mark_event_failed(event_id, consumer, error) -> None`
- `track_event(event_type, actor, target, payload) -> AnalyticsEventRead`
- `get_book_metrics(book_id, range) -> BookMetricsRead`
- `get_creation_funnel_metrics(filters) -> CreationFunnelMetricsRead`
- `get_operation_dashboard(filters) -> OperationDashboardRead`
- `aggregate_events(range) -> None`

## 4. 数据库结构设计

### analytics 数据库定义

#### analytics_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 事件 ID |
| event_type | string indexed | 事件类型 |
| actor_type | enum(`anonymous`,`user`,`admin`,`system`) | 行为主体 |
| actor_id | int nullable | 主体 ID |
| target_type | string indexed | 目标类型 |
| target_id | int indexed | 目标 ID |
| session_id | int nullable | 会话 |
| payload | JSON | 扩展数据 |
| occurred_at | datetime indexed | 发生时间 |

#### analytics_daily_metrics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 聚合 ID |
| metric_date | date indexed | 日期 |
| target_type | string | 目标类型 |
| target_id | int | 目标 ID |
| metric_key | string | 指标，如 `play_count` |
| metric_value | numeric | 指标值 |
| dimensions | JSON | 维度 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`metric_date,target_type,target_id,metric_key,dimensions_hash`。

### domain_event 数据库定义

#### domain_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 事件 ID |
| event_type | string indexed | 事件类型 |
| actor_type | string | 主体类型 |
| actor_id | int nullable | 主体 ID |
| target_type | string indexed | 目标类型 |
| target_id | int indexed | 目标 ID |
| payload | JSON | 事件数据 |
| idempotency_key | string nullable | 幂等键 |
| occurred_at | datetime | 发生时间 |
| created_at | datetime | 入库时间 |

#### domain_event_deliveries

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 投递 ID |
| event_id | int FK domain_events.id indexed | 事件 |
| consumer | string indexed | 消费者 |
| status | enum(`pending`,`consumed`,`failed`) | 状态 |
| retry_count | integer | 重试次数 |
| last_error | text nullable | 最后错误 |
| consumed_at | datetime nullable | 消费时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`event_id,consumer`。
## 5. 跨模块协作

- `reading` 发布播放、收藏、完播事件。
- `creation` 发布生成流程转化事件。
- `share` 发布分享访问事件。
- `membership/payment` 发布订阅转化来源。
- `moderation` 发布举报和处理事件。

## 6. 边界规则

- `domain_event` 不替代同步 service 调用。
- `analytics` 不修改业务对象状态，不判断会员权益。
- 前端埋点只记录交互事实，最终统计口径以后端聚合为准。
- 新增事件必须定义事件名、actor、target、payload schema 和消费者幂等策略。
