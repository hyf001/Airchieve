# analytics 模块详细设计

## 功能

- 统一记录业务事件和统计聚合，避免播放量、完播率、转化率散落在各业务模块。
- 事件来源包括阅读、收藏、分享访问、创建类似作品、生成转化、订阅来源、举报等。
- 为后台运营数据、推荐排序和内容详情统计提供查询接口。
- 不修改业务对象状态，不判断会员权益。

## 接口

### 后台/内部 API

- `GET /api/v1/admin/analytics/dashboard`：运营仪表盘。
- `GET /api/v1/admin/analytics/books/{book_id}`：绘本指标。
- `GET /api/v1/admin/analytics/creation-funnel`：创作漏斗。

### Service

- `track_event(event_type, actor, target, payload) -> AnalyticsEventRead`
- `get_book_metrics(book_id, range) -> BookMetricsRead`
- `get_creation_funnel_metrics(filters) -> CreationFunnelMetricsRead`
- `get_operation_dashboard(filters) -> OperationDashboardRead`
- `aggregate_events(range) -> None`

## 数据库定义

### analytics_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 事件 ID |
| event_type | string indexed | 事件类型 |
| actor_type | enum(`anonymous`,`user`,`admin`,`system`) | 行为主体 |
| actor_id | string nullable | 主体 ID |
| target_type | string indexed | 目标类型 |
| target_id | string indexed | 目标 ID |
| session_id | string nullable | 会话 |
| payload | JSON | 扩展数据 |
| occurred_at | datetime indexed | 发生时间 |

### analytics_daily_metrics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 聚合 ID |
| metric_date | date indexed | 日期 |
| target_type | string | 目标类型 |
| target_id | string | 目标 ID |
| metric_key | string | 指标，如 `play_count` |
| metric_value | numeric | 指标值 |
| dimensions | JSON | 维度 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`metric_date,target_type,target_id,metric_key,dimensions_hash`。

## Schema 定义

- `AnalyticsEventCreate`：事件类型、actor、target、payload、发生时间。
- `BookMetricsRead`：播放量、完播率、收藏量、分享量、创建类似次数、举报数。
- `CreationFunnelMetricsRead`：创建会话、故事确认、分镜生成、音频生成、保存绘本各阶段转化。
- `OperationDashboardRead`：内容消费、生成转化、订阅转化、举报审核摘要。

