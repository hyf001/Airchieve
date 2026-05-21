---
title: 故事库
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [story, story-library, module-design]
sources: [raw/articles/module-design/story-library.md]
---

# 故事库 (story-library / story)

## 概述

管理故事作为纯文本资产，区分系统故事和用户故事。支持创建、编辑、上传/粘贴、删除、筛选，并作为绘本生成的素材来源。故事不包含页面、插图、音频或播放结构。

## 前端归属

- `features/story-library`：我的故事、系统故事、故事详情、创建/编辑/删除/上传/粘贴、从故事发起生成
- `entities/story`：故事卡片、故事摘要、故事选择器

## 后端归属

- `story_api.py`、`schema/story.py`、`service/story_service.py`、`model/story.py`

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `stories` | 故事（标题、正文、适龄范围、主题标签、教育目标、来源、权益状态） |

## 核心接���

- 故事 CRUD：`stories`、`stories/{id}`
- 发起创作：`stories/{id}/start-creation`

## 复用入口

- 前端：`StorySelector`、`StoryCard`、`StoryEditor`
- 后端：`get_story()`、`list_stories()`、`create_user_story()`、`assert_story_usable()`

## 边界

- 故事只保存纯文本和文本元数据
- 故事不是模板；复用完整绘本并替换角色归 [[template]]
- 上传或粘贴故事必须走 [[share-export-privacy|隐私授权确认]]

## 完整来源

- 详细设计全文：`raw/articles/module-design/story-library.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[creation-generation]] — 绘本生成
- [[template]] — 绘本模板
- [[taxonomy]] — 分类筛选
