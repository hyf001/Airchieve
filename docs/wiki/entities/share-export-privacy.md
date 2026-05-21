---
title: 分享、导出与隐私
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [share, export, privacy, module-design]
sources: [raw/articles/module-design/share-export-privacy.md]
---

# 分享、导出与隐私 (share / export / privacy)

## 概述

管理分享链接生命周期（创建、关闭、重新生成、公开只读播放）、PDF 导出任务、上传授权追踪和隐私确认。分享或导出包含个人角色形象/声音的内容前必须完成隐私确认。

## 前端归属

- `features/share`：分享链接、复制、二维码、访问范围、关闭/恢复/重新生成、分享记录、隐私确认
- `features/export`：PDF 导出、导出状态、下载入口、导出记录
- `features/privacy`：上传授权、分享/导出隐私确认、风险提示弹窗

## 后端归属

- `share`：分享链接、访问范围、分享页只读播放器数据、访问日志
- `export`：PDF 导出任务、导出文件、导出状态
- `privacy`：上传授权、个人素材默认私密策略、分享/导出风险确认

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `share_links` | 分享链接 |
| `share_access_logs` | 分享访问日志 |
| `export_jobs` | 导出任务 |
| `privacy_upload_consents` | 上传授权 |
| `privacy_confirmations` | 隐私确认 |
| `privacy_visibility_policies` | 可见性策略 |

## 核心接口

- 分享：`share/book/{id}`、链接管理、公开访问 via token
- 导出：`export/book/{id}`、任务状态、文件 URL
- 隐私：`privacy/upload-consents`、`privacy/confirmations`、`privacy/flags`

## 复用入口

- 前端：`ShareDialog`、`ShareLinkList`、`ExportButton`、`PrivacyConfirmDialog`
- 后端：`create_share_link()`、`get_shared_player_payload()`、`create_export_job()`、`record_upload_consent()`

## 边界

- 分享复用只读播放器，不编辑绘本内容
- 导出不管理分享链接
- 隐私模块不上传文件、不审核内容、不修改业务对象

## 完整来源

- 详细设计全文：`raw/articles/module-design/share-export-privacy.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[book-player-reading]] — 只读播放器 payload
- [[asset-storage]] — 个人素材隐私
- [[membership-payment]] — 分享/导出额度
- [[moderation-audit]] — 内容审核
