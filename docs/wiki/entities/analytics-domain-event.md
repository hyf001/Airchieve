---
title: 数据事件与统计
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [analytics, domain-event, module-design]
sources: [raw/articles/module-design/analytics-domain-event.md]
---

# 数据事件与统计 (analytics / domain_event)

## 概述

提供统一的业务事件追踪和领域事件基础设施。`domain_event` 处理事件持久化、投递状态和异步消费重试。`analytics` 记录事件、计算每日指标聚合，并提供后台管理仪表盘。统计口径集中在 analytics，前端埋点为辅助。

## 前端归属

- `shared/analytics`：前端行为埋点封装
- 后台统计页面由 `features/admin` 或 `features/analytics` 展示

## 后端归属

- `domain_event`：领域事件发布、持久化、投递状态和失败重试
- `analytics`：业务事件记录、统计聚合、运营数据查询

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `analytics_events` | 分析事件 |
| `analytics_daily_metrics` | 每日指标聚合 |
| `domain_events` | 领域事件 |
| `domain_event_deliveries` | 事件投递状态 |

## 核心接口

- 后台仪表盘：`admin/analytics/dashboard`、`admin/analytics/books/{id}`、`admin/analytics/creation-funnel`

## 复用入口

- 前端：`trackClientEvent()`
- 后端：`publish_event()`、`track_event()`、`get_book_metrics()`、`get_creation_funnel_metrics()`

## 边界

- `domain_event` 不替代同步 service 调用
- `analytics` 不修改业务对象状态，不判断会员权益
- 播放量、完播率、生成转化、订阅来源等统计口径集中在 analytics

## 完整来源

- 详细设计全文：`raw/articles/module-design/analytics-domain-event.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[book-player-reading]] — 播放/收藏/完播事件
- [[creation-generation]] — 生成漏斗事件
- [[membership-payment]] — 订阅转化事件
- [[admin]] — 后台仪表盘
