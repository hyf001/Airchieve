---
title: 绘本内容、播放器与阅读状态
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [book, book-player, reading, module-design]
sources: [raw/articles/module-design/book-player-reading.md]
---

# 绘本内容、播放器与阅读状态 (book-player / book / reading)

## 概述

管理绘本作为可播放内容资产（页面结构、双语文本、对白、对口型数据、共读提示、学习卡片）和用户级阅读状态（进度、收藏、历史、播放事件）。播放器消费服务端组装的 `BookPlayerPayload`。

## 前端归属

- `features/book-player`：播放、暂停、翻页、进度条、语言切换、语速、音效、声音切换、共读提示、学习卡片、试看裁剪、举报入口
- `features/reading`：继续阅读、收藏、阅读进度、播放事件上报
- `entities/book`：播放器页面结构、学习卡片、共读提示展示组件

## 后端归属

- `book`：绘本详情、页��、媒体、双语文本、音频、对白、共读提示、学习卡片、播放器 payload
- `reading`：收藏、阅读进度、阅读历史、播放事件
- `moderation`：举报入口

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `books` | 绘本基础信息 |
| `book_pages` | 绘本页面 |
| `book_dialogues` | 对白 |
| `book_reading_prompts` | 共读提示 |
| `book_learning_cards` | 学习卡片 |
| `reading_progress` | 阅读进度 |
| `reading_favorites` | 收藏 |
| `reading_events` | 播放事件 |

## 核心接口

- 绘本：`books`、`books/{id}`、`books/{id}/player`
- 阅读：`reading/recent`、`reading/favorites`、`reading/progress`、`reading/events`

## 复用入口

- 前端：`BookPlayer`、`ReadonlyBookPlayer`、`VoiceSwitcher`、`FavoriteButton`
- 后端：`get_book_detail()`、`get_player_payload()`、`save_reading_progress()`、`toggle_favorite()`

## 边界

- `book_player_service` 是 `book` 内部服务，不是独立模块
- `reading` 不修改绘本正文、页面、音频和媒体
- 儿童播放主流程不展示商业购买入口

## 完整来源

- 详细设计全文：`raw/articles/module-design/book-player-reading.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[discovery-recommendation]] — 绘本详情与推荐
- [[creation-generation]] — 绘本生成
- [[membership-payment]] — 试看/VIP 裁剪
- [[analytics-domain-event]] — 播放事件统计
