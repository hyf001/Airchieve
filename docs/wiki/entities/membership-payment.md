---
title: 会员、权益与支付
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [membership, entitlement, payment, module-design]
sources: [raw/articles/module-design/membership-payment.md]
---

# 会员、权益与支付 (membership / entitlement / payment)

## 概述

集中管理订阅计划、权益校验与额度扣减、支付订单生命周期和退款。其他模块不得自行实现 VIP 判断或额度限制逻辑。

## 前端归属

- `features/membership`：套餐展示、权益对比、当前权益摘要、升级提示、试看和额度限制提示
- `entities/membership`：计划卡片、权益 badge、访问状态组件

## 后端归属

- `membership`：会员计划、订阅状态、权益配置
- `entitlement`：统一权益校验和额度扣减（预留 reservation 语义）
- `payment`：订单、支付流水、支付渠道回调、退款、订阅账单

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `membership_plans` | 会员计划配置 |
| `user_memberships` | 用户订阅状态 |
| `membership_usage_counters` | 用量计数器 |
| `entitlement_quota_reservations` | ���度预留 |
| `payment_orders` | 支付订单 |
| `payment_records` | 支付流水 |
| `refund_records` | 退款记录 |

## 核心接口

- 计划查询：`membership/plans`、`membership/me`、`membership/entitlements`
- 订单：`payment/membership-orders`、`payment/orders`、`payment/records`
- 后台：`admin/membership/plans`、`admin/payment/orders`

## 复用入口

- 前端：`useEntitlements`、`EntitlementGate`、`AccessBadge`、`UpgradePrompt`
- 后端：`get_user_entitlements()`、`can_access_book()`、`assert_can_create()`、`consume_quota()`

## 边界

- 其他模块不得自行判断 VIP、试看页数、次数限制或数量上限
- `payment` 不判断内容访问权限，只把支付结果转换为订阅变更

## 完整来源

- 详细设计全文：`raw/articles/module-design/membership-payment.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[project-overview]] — 项目总览
- [[account-profile]] — 用户账号
- [[creation-generation]] — 创作额度消耗
