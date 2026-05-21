---
title: 发现、推荐与绘本详情
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [discovery, recommendation, module-design]
sources: [raw/articles/module-design/discovery-recommendation.md]
---

# 发现、推荐与绘本详情 (discovery / recommendation)

## 概述

处理首页发现体验、绘本搜索分类浏览、推荐位（精选轮播/主题）、绘本详情页和"创建类似作品"入口。不实现播放器控制、阅读进度保存或内容生成。

## 前端归属

- `features/discovery`：首页推荐、搜索入口、分类浏览、继续阅读入口、绘本详情、相关绘本、创建类似作品入口
- `entities/book`：绘本卡片、绘本摘要、标签、免费/VIP 状态

## 后端归属

- `book`：绘本列表和详情
- `recommendation`：首页、详情页、播放器结束页、创作入口等推荐位
- `taxonomy`：筛选条件

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `recommendation_slots` | 推荐位配置 |
| `recommendation_items` | 推荐条目 |
| `recommendation_topics` | 推荐主题 |

## 核心接口

- 绘本：`books`、`books/{id}`
- 创建类似：`books/{id}/similar-creation-session`
- 推荐：`recommendations/{slot_code}`、`recommendations/home`、`recommendations/book/{id}/related`
- 后台：推荐 slot/item 管理

## 复用入口

- 前端：`BookCard`、`BookGrid`、`RecommendationSlot`、`BookDetailPanel`
- 后端：`list_books()`、`get_book_detail()`、`list_recommendations()`

## 完整来源

- 详细设计全文：`raw/articles/module-design/discovery-recommendation.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[book-player-reading]] — 播放器与阅读状态
- [[creation-generation]] — 创建类似作品流程
- [[taxonomy]] — 分类筛选
- [[membership-payment]] — 免费/VIP 状态
