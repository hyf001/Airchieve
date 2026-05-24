---
title: 分类配置
created: 2026-05-19
updated: 2026-05-24
type: entity
tags: [taxonomy, module-design]
sources: [raw/articles/module-design/taxonomy.md, raw/articles/external/aliyun-speech-synthesis-overview.md]
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

## Voice Style 用法

- `voice_style` 不再表示抽象风格（如“温柔姐姐”），而是可以承载 TTS provider 的稳定音色 code。
- Aliyun TTS 系统声音使用 `voice_style` seed 官方音色，例如 `zhimiao_emo`、`zhimi_emo`、`zhiyan_emo`、`xiaoyun`、`xiaogang`、`aiqi`。
- 多情感音色 taxonomy metadata 应包含 `provider=aliyun` 和明确的 `supported_emotions` 数组，供 [[asset-storage]] 和 [[creation-generation]] 判断能力。
- 当前 seed 的多情感 emotion 范围：`zhimiao_emo` 支持 `serious/sad/disgust/jealousy/embarrassed/happy/fear/surprise/neutral/frustrated/affectionate/gentle/angry/newscast/customer-service/story/living`；`zhimi_emo` 支持 `angry/fear/happy/hate/neutral/sad/surprise`；`zhiyan_emo` 支持 `neutral/happy/angry/sad/fear/hate/surprise/arousal`。

## TODO

- [ ] 周期性复核 Aliyun 官方音色列表，新增、下线或改名时同步 taxonomy seed 和前端受控下拉。
- [ ] 为 `voice_style` metadata 定义稳定 schema：`provider`、`supported_emotions`、`language_scope`、`scene`。

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
- [[asset-storage]] — 系统声音使用 voice_style code
