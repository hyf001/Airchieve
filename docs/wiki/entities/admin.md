---
title: 后台运营
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [admin, module-design]
sources: [raw/articles/module-design/admin.md]
---

# 后台运营 (admin)

## 概述

提供后台应用壳、仪表盘和编排层。Admin 不拥有核心业务逻辑或数据表；所有写操作委托给目标模块 service，提供统一导航、权限守卫、审计日志和跨业务域聚合视图。

## 前端归属

- `features/admin`：后台首页、内容概览、用户摘要、各业务模块后台入口

## 后端归属

- `admin` 只做后台聚合和运营动作编排

## 核心接口

- 仪表盘：`admin/dashboard`、`admin/content/overview`
- 聚合视图：`admin/generation-tasks`、`admin/users/{id}/summary`、`admin/audit-logs`、`admin/analytics/operation-dashboard`
- 编排动作：`admin/stories/{id}/publish|unpublish`、`admin/books/{id}/publish|unpublish|delete`、`admin/templates/{id}/validate`、`admin/share-links/{id}/ban`、`admin/moderation/{id}/handle`

## 复用入口

- 前端：`AdminShell`、`AdminDashboard`、`AdminContentOverview`
- 后端：`get_admin_dashboard()`、`get_content_overview()`、`publish_story()`、`publish_book()`

## 边界

- 后台不绕过业务模块直接写核心数据
- 所有后台写操作必须写入 [[moderation-audit|audit]]
- 后台页面复用前台实体摘要组件时，只能依赖公开入口

## 完整来源

- 详细设计全文：`raw/articles/module-design/admin.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[moderation-audit]] — 审核与审计
- [[analytics-domain-event]] — 统计仪表盘
- [[project-overview]] — 所有业务模块
