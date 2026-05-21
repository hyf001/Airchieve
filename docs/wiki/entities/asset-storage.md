---
title: 素材库与存储
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [asset, storage, character, voice, art-style, module-design]
sources: [raw/articles/module-design/asset-storage.md]
---

# 素材库与存储 (character-library / voice-library / art-style-library / asset / storage)

## 概述

管理所有媒体素材（角色形象、画风、声音、参考图片）并抽象文件存储（上传会话、访问 URL、供应商差异）。角色形象必须通过 AI 任务生成；参考图片只是输入素材。存储层不理解业务语义。

## 前端归属

- `features/character-library`：我的角色形象、系统角色形象、创建形象、上传头像或参考图、选择画风、形象选择器
- `features/voice-library`：我的声音、系统声音、上传声音、试听、声音选择器
- `features/art-style-library`：系统画风、自定义画风描述、画风对比
- `entities/asset`：素材卡片、上传入口、素材选择器基础组件

## 后端归属

- `asset`：角色形象、画风、声音、参考图媒体资产引用和素材状态
- `storage`：上传会话、文件访问 URL、存储 provider 差异
- `privacy`：上传授权和个人素材隐私确认

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `assets` | 素材基础信息 |
| `characters` | 角色形象（绑定画风） |
| `art_styles` | 画风 |
| `voices` | 声音 |
| `storage_upload_sessions` | 上传会话 |

## 核心接口

- 角色形象：`assets/characters` CRUD
- 画风：`assets/art-styles`、自定义画风
- 声音：`assets/voices` CRUD
- 上传会话（内部）

## 复用入口

- 前端：`CharacterSelector`、`VoiceSelector`、`ArtStyleSelector`、`AssetUploadField`
- 后端：`list_characters()`、`list_voices()`、`list_art_styles()`、`create_upload_session()`

## 边界

- 素材库不编排绘本生成流程
- 画风是独立资源，但角色形象必须保存绑定画风
- 删除形象或声音不删除历史绘本中已生成内容
- `storage` 不理解业务语义，不判断会员权益

## 完整来源

- 详细设计全文：`raw/articles/module-design/asset-storage.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[creation-generation]] — 角色形象用于绘本生成
- [[account-profile]] — 儿童档案默认素材
- [[share-export-privacy]] — 上传隐私确认
- [[membership-payment]] — VIP 素材权益
