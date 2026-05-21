---
title: 分类配置
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [taxonomy, module-design]
sources: [raw/articles/module-design/taxonomy.md]
---

# 分类配置 (taxonomy)

## 概述

提供单一、集中的分类系统，覆盖年龄段、主题、兴趣标签、教育目标、阅读水平、语言、叙事风格、场景、声音风格和素材分类。前端和后端必须使用相同的 taxonomy；不允许硬编码分类列表。

## 前端归属

- `entities/taxonomy`：年龄段、主题、兴趣标签等选择器组件

## 后端归属

- `taxonomy_api.py`、`schema/taxonomy.py`、`service/taxonomy_service.py`、`model/taxonomy.py`

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `taxonomy_items` | 分类项，包含 type、code、展示名称、排序、启用状态 |

分类类型：`age_range`、`theme`、`interest_tag`、`education_goal`、`reading_level`、`language`、`narrative_style`、`scene`、`voice_style`、`asset_category`

## 核心接口

- 公开：`taxonomy`、`taxonomy/{type}`
- 后台 CRUD：`admin/taxonomy/items`、排序、启用/禁用

## 复用入口

- 前端：`TaxonomySelect`、`TaxonomyMultiSelect`、`useTaxonomyGroup`
- 后端：`list_taxonomy()`、`validate_taxonomy_codes()`、`upsert_taxonomy_item()`

## 边界

- 不依赖故事、绘本、素材、会员
- 分类项用稳定 `code` 和展示名称，不在业务模块散落字符串常量

## 完整来源

- 详细设计全文：`raw/articles/module-design/taxonomy.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[discovery-recommendation]] — 首页筛选
- [[creation-generation]] — 创作配置
- [[account-profile]] — 儿童档案兴趣标签
