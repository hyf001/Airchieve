# membership 模块详细设计

## 功能

- 管理会员计划、订阅状态、权益配置和用户当前会员摘要。
- 支持免费、月度、季度、年度等计划；具体价格和支付策略可配置。
- 会员权益配置包括绘本访问、生成次数、儿童档案数量、故事数量、形象数量、声音数量、分享数量、PDF 导出次数和导出清晰度。
- 接收 `payment` 的支付成功、退款、取消订阅等结果并更新订阅状态。
- 不做具体业务对象创建，不直接处理支付渠道回调。

## 接口

### 前台 API

- `GET /api/v1/membership/plans`：会员计划列表。
- `GET /api/v1/membership/me`：当前用户会员状态和权益摘要。
- `GET /api/v1/membership/entitlements`：当前用户权益明细。

### 后台 API

- `POST /api/v1/admin/membership/plans`：创建会员计划。
- `PATCH /api/v1/admin/membership/plans/{plan_id}`：更新计划、价格和权益。
- `PATCH /api/v1/admin/membership/plans/{plan_id}/status`：启用/停用计划。

### Service

- `list_membership_plans(filters) -> list[MembershipPlanRead]`
- `get_membership_plan(plan_id) -> MembershipPlanRead`
- `get_user_membership(user_id) -> UserMembershipRead`
- `get_user_entitlement_config(user_id) -> EntitlementConfigDTO`
- `apply_subscription_change(user_id, payload) -> UserMembershipRead`
- `cancel_membership(user_id, reason) -> UserMembershipRead`

## 数据库定义

### membership_plans

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 计划 ID |
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

### user_memberships

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 用户会员记录 |
| user_id | string indexed | 用户 ID |
| plan_id | FK membership_plans.id | 当前计划 |
| status | enum(`free`,`active`,`past_due`,`canceled`,`expired`) | 会员状态 |
| started_at | datetime nullable | 生效时间 |
| current_period_start | datetime nullable | 当前周期开始 |
| current_period_end | datetime nullable | 当前周期结束 |
| auto_renew | bool | 是否自动续费 |
| source | enum(`system`,`payment`,`admin`) | 来源 |
| created_at / updated_at | datetime | 时间戳 |

### membership_usage_counters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 计数 ID |
| user_id | string indexed | 用户 ID |
| quota_key | string | `book_generation_monthly` 等 |
| period_key | string | `2026-05` |
| used_amount | integer | 已使用 |
| reserved_amount | integer | 预占中 |
| reset_at | datetime nullable | 重置时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, quota_key, period_key`。

## Schema 定义

- `MembershipPlanRead`：`id`、`code`、`name`、`price_cents`、`billing_period`、`entitlement_config`、`status`。
- `MembershipPlanCreate`：计划基础字段、价格、周期、权益配置。
- `MembershipPlanUpdate`：计划基础字段、价格、权益、状态可选。
- `UserMembershipRead`：`user_id`、计划摘要、`status`、周期时间、`auto_renew`。
- `EntitlementConfigDTO`：访问等级、数量上限、月度额度、VIP 素材使用权限、导出清晰度。

