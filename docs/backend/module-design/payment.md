# payment 模块详细设计

## 功能

- 管理会员订单、支付流水、渠道回调、退款记录和订阅账单。
- 将支付结果转换为 `membership` 可消费的订阅变更。
- 关键状态变化写入 `audit` 或支付日志。
- 不判断绘本、故事、素材访问权益，不创建内容业务对象。

## 接口

### 前台 API

- `POST /api/v1/payment/membership-orders`：创建会员订单。
- `GET /api/v1/payment/orders/{order_id}`：查询订单状态。
- `GET /api/v1/payment/records`：当前用户支付记录。

### 渠道回调 API

- `POST /api/v1/payment/callbacks/{provider}`：支付渠道回调。

### Service

- `create_membership_order(user_id, plan_id, payload) -> PaymentOrderRead`
- `get_payment_order(user_id, order_id) -> PaymentOrderRead`
- `handle_payment_callback(provider, payload) -> PaymentCallbackResult`
- `list_user_payment_records(user_id, filters) -> list[PaymentRecordRead]`
- `create_refund(order_id, payload) -> RefundRecordRead`

## 数据库定义

### payment_orders

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 订单 ID |
| order_no | string unique | 业务订单号 |
| user_id | string indexed | 用户 ID |
| plan_id | string | 会员计划 |
| amount_cents | integer | 订单金额 |
| currency | string | 币种 |
| provider | enum(`wechat`,`alipay`,`app_store`,`manual`) | 支付渠道 |
| status | enum(`pending`,`paid`,`failed`,`canceled`,`refunded`) | 状态 |
| provider_order_id | string nullable | 渠道订单号 |
| paid_at | datetime nullable | 支付时间 |
| expired_at | datetime nullable | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |

### payment_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 流水 ID |
| order_id | FK payment_orders.id | 订单 |
| provider | string | 渠道 |
| event_type | string | `paid`、`failed`、`refunded` |
| amount_cents | integer | 金额 |
| raw_payload | JSON | 回调原文摘要 |
| occurred_at | datetime | 发生时间 |

### refund_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 退款 ID |
| order_id | FK payment_orders.id | 订单 |
| refund_no | string unique | 退款单号 |
| amount_cents | integer | 退款金额 |
| reason | string nullable | 原因 |
| status | enum(`pending`,`succeeded`,`failed`) | 状态 |
| provider_refund_id | string nullable | 渠道退款号 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `CreateMembershipOrderRequest`：`plan_id`、`provider`、`return_url?`、`idempotency_key?`。
- `PaymentOrderRead`：订单号、金额、币种、渠道、状态、支付参数、过期时间。
- `PaymentRecordRead`：流水类型、金额、渠道、发生时间。
- `PaymentCallbackResult`：`handled`、`order_id?`、`status`、`message?`。
- `RefundCreate`：`amount_cents`、`reason`。

