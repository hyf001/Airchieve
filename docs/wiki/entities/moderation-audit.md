---
title: 审核、举报与审计
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [moderation, audit, module-design]
sources: [raw/articles/module-design/moderation-audit.md]
---

# 审核、举报与审计 (moderation / audit)

## 概述

处理内容举报（用户提交）、审核队列（通过/驳回/隐藏/下架）和不可变审计日志（后台写操作、支付关键状态、敏感配置变更）。审计日志不得暴露删除或篡改接口。

## 前端归属

- `features/moderation`：播放器举报入口、举报表单、后台审核处理页面
- `entities/audit`：后台审计日志列表和详情展示

## 后端归属

- `moderation`：内容审核、用户举报、处理状态
- `audit`：后台写操作、支付关键状态、敏感配置变更日志

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `moderation_records` | 审核记录 |
| `reports` | 用户举报 |
| `audit_logs` | 审计日志 |

## 核心接口

- 举报：`moderation/reports`（公开提交）
- 后台审核：`admin/moderation/records`、`handle`
- 审计：`admin/audit/logs`

## 复用入口

- 前端：`ReportContentDialog`、`ModerationQueue`、`AuditLogTable`
- 后端：`create_report()`、`list_moderation_records()`、`handle_moderation_record()`、`write_audit_log()`

## 边界

- 审核不替代隐私确认
- 审计只记录事实，不执行目标业务动作
- 后台写操作必须调用对应业务模块 service，再写入审计日志

## 完整来源

- 详细设计全文：`raw/articles/module-design/moderation-audit.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[admin]] — 后台运营
- [[share-export-privacy]] — 隐私确认
- [[book-player-reading]] — 播放器举报入口
