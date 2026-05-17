# domain_event 模块详细设计

## 功能

- 负责领域事件发布、持久化、投递状态和失败重试。
- 用于统计、审计辅助、运营分析等非阻塞副作用。
- 不判断业务规则，不替代同步 service 调用，不直接修改业务对象。

## 接口

### Service

- `publish_event(event_type, actor, target, payload) -> DomainEventRead`
- `list_pending_events(consumer, limit) -> list[DomainEventRead]`
- `mark_event_consumed(event_id, consumer) -> None`
- `mark_event_failed(event_id, consumer, error) -> None`
- `retry_failed_deliveries(consumer, limit) -> int`

## 数据库定义

### domain_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 事件 ID |
| event_type | string indexed | 事件类型 |
| actor_type | string | 主体类型 |
| actor_id | string nullable | 主体 ID |
| target_type | string indexed | 目标类型 |
| target_id | string indexed | 目标 ID |
| payload | JSON | 事件数据 |
| idempotency_key | string nullable | 幂等键 |
| occurred_at | datetime | 发生时间 |
| created_at | datetime | 入库时间 |

### domain_event_deliveries

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 投递 ID |
| event_id | FK domain_events.id indexed | 事件 |
| consumer | string indexed | 消费者 |
| status | enum(`pending`,`consumed`,`failed`) | 状态 |
| retry_count | integer | 重试次数 |
| last_error | text nullable | 最后错误 |
| consumed_at | datetime nullable | 消费时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`event_id,consumer`。

## Schema 定义

- `DomainEventCreate`：事件类型、actor、target、payload、幂等键。
- `DomainEventRead`：事件完整字段。
- `DomainEventDeliveryRead`：消费者、状态、重试次数、错误。

