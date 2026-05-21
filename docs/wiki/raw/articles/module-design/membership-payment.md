---
source_url: file://docs/module-design/membership-payment.md
ingested: 2026-05-20
sha256: 680e54af53ec16f9d49254b5faecab866dfefdc5423eac0e74530f55adc52335
---

# 会员、权益与支付详细设计

对应总览：`docs/module-design/module-design.md` 4.2 `membership / entitlement / payment`

总设计文档：[module-design.md](module-design.md)

前端原型：[membership.html](../frontend/membership.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 15 会员订阅，并支撑 Story 3、6、7、9、10、11、12 中的 VIP、试看和额度限制。

## 1. 模块目标

统一管理会员套餐、订阅状态、权益判断、额度扣减、支付订单、支付回调和账单记录。其他模块只消费权益结果，不自行计算套餐规则。

## 2. 前端设计

### 页面

- `pages/membership`：套餐展示、权益对比、订阅入口、支付状态、当前会员摘要。

### 功能模块

- `features/membership`
  - 会员套餐展示。
  - 权益对比。
  - 当前权益摘要。
  - 试看、生成次数、素材使用、分享、导出等限制提示。
  - 升级引导。
  - 支付入口和支付结果状态。

### 领域组件

- `entities/membership`：`MembershipPlanCard`、`EntitlementList`、`AccessBadge`、`UpgradePrompt`。
- `entities/payment`：`PaymentButton`、`PaymentStatusPanel`、`PaymentRecordList`。

### 前端公开入口

- `useEntitlements()`
- `EntitlementGate`
- `AccessBadge`
- `UpgradePrompt`
- `MembershipPlans`
- `CurrentMembershipSummary`
- `PaymentButton`

## 3. 后端设计

### 后端归属

- `membership`：会员计划、订阅状态、权益配置。
- `entitlement`：权益判断、额度扣减、访问决策。
- `payment`：订单、支付记录、支付渠道回调、退款、订阅账单。

### 前台 API

- `GET /api/v1/membership/plans`
- `GET /api/v1/membership/me`
- `GET /api/v1/membership/entitlements`
- `POST /api/v1/payment/membership-orders`
- `GET /api/v1/payment/orders/{order_id}`
- `GET /api/v1/payment/records`

### 后台 API

- `POST /api/v1/admin/membership/plans`
- `PATCH /api/v1/admin/membership/plans/{plan_id}`
- `PATCH /api/v1/admin/membership/plans/{plan_id}/status`
- `GET /api/v1/admin/payment/orders`
- `GET /api/v1/admin/payment/orders/{order_id}`

### Service

- `list_membership_plans() -> list[MembershipPlanRead]`
- `get_user_membership(user_id) -> UserMembershipRead`
- `get_user_entitlements(user_id) -> EntitlementSummary`
- `can_access_book(user_id, book_id) -> AccessDecision`
- `can_use_asset(user_id, asset_ref) -> AccessDecision`
- `assert_can_create(user_id, resource_type) -> None`
- `consume_quota(user_id, quota_key, amount=1) -> QuotaConsumeResult`
- `create_membership_order(user_id, plan_id, payload) -> PaymentOrderRead`
- `get_payment_order(user_id, order_id) -> PaymentOrderRead`
- `handle_payment_callback(provider, payload) -> None`
- `list_user_payment_records(user_id) -> Page[PaymentRecordRead]`

## 4. 数据库结构设计

### membership 数据库定义

#### membership_plans

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 计划 ID |
| code | string unique | `free`、`monthly`、`quarterly`、`yearly` |
| name | string | 计划名 |
| description | text nullable | 描述 |
| price_cents | integer | 价格，分 |
| currency | string | 默认 `CNY` |
| billing_period | enum(`none`,`month`,`quarter`,`year`) | 订阅周期 |
| entitlement_config | JSON | 权益配置快照 |
| sort_order | integer | 排序 |
| status | enum(`active`,`inactive`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

#### user_memberships

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 用户会员记录 |
| user_id | int indexed | 用户 ID |
| plan_id | int FK membership_plans.id | 当前计划 |
| status | enum(`free`,`active`,`past_due`,`canceled`,`expired`) | 会员状态 |
| started_at | datetime nullable | 生效时间 |
| current_period_start | datetime nullable | 当前周期开始 |
| current_period_end | datetime nullable | 当前周期结束 |
| auto_renew | bool | 是否自动续费 |
| source | enum(`system`,`payment`,`admin`) | 来源 |
| created_at / updated_at | datetime | 时间戳 |

#### membership_usage_counters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 计数 ID |
| user_id | int indexed | 用户 ID |
| quota_key | string | `book_generation_monthly` 等 |
| period_key | string | `2026-05` |
| used_amount | integer | 已使用 |
| reserved_amount | integer | 预占中 |
| reset_at | datetime nullable | 重置时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, quota_key, period_key`。

### entitlement 数据库定义

#### entitlement_quota_reservations

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 预占 ID |
| user_id | int indexed | 用户 ID |
| quota_key | string | 额度项 |
| amount | integer | 预占数量 |
| period_key | string | 计费/自然周期 |
| idempotency_key | string nullable | 幂等键 |
| status | enum(`reserved`,`confirmed`,`released`,`expired`) | 状态 |
| reason | string nullable | 释放或失败原因 |
| expires_at | datetime nullable | 预占过期时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, quota_key, idempotency_key` where `idempotency_key` not null。

### payment 数据库定义

#### payment_orders

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 订单 ID |
| order_no | string unique | 业务订单号 |
| user_id | int indexed | 用户 ID |
| plan_id | int | 会员计划 |
| amount_cents | integer | 订单金额 |
| currency | string | 币种 |
| provider | enum(`wechat`,`alipay`,`app_store`,`manual`) | 支付渠道 |
| status | enum(`pending`,`paid`,`failed`,`canceled`,`refunded`) | 状态 |
| provider_order_id | string nullable | 渠道订单号 |
| paid_at | datetime nullable | 支付时间 |
| expired_at | datetime nullable | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |

#### payment_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 流水 ID |
| order_id | int FK payment_orders.id | 订单 |
| provider | string | 渠道 |
| event_type | string | `paid`、`failed`、`refunded` |
| amount_cents | integer | 金额 |
| raw_payload | JSON | 回调原文摘要 |
| occurred_at | datetime | 发生时间 |

#### refund_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 退款 ID |
| order_id | int FK payment_orders.id | 订单 |
| refund_no | string unique | 退款单号 |
| amount_cents | integer | 退款金额 |
| reason | string nullable | 原因 |
| status | enum(`pending`,`succeeded`,`failed`) | 状态 |
| provider_refund_id | string nullable | 渠道退款号 |
| created_at / updated_at | datetime | 时间戳 |
## 5. 跨模块协作

- `book` 调用权益判断决定绘本访问和试看。
- `creation` 调用权益判断和额度扣减。
- `asset` 调用权益判断 VIP 素材和个人素材数量。
- `story` 调用权益判断 VIP 故事和个人故事数量。
- `share`、`export` 调用额度判断。
- `payment` 只把支付结果转成订阅变化，不参与内容访问。

## 6. 边界规则

- 前端只展示后端返回的权益状态，不自行计算。
- 后端其他模块不得散写 VIP、试看、额度、数量上限规则。
- 支付成功以后端回调和订单查询为准，不能信任前端本地支付结果。
- 儿童播放主流程不得直接弹出购买流程。
