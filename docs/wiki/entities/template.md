---
title: 绘本模板
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [template, module-design]
sources: [raw/articles/module-design/template.md]
---

# 绘本模板 (template)

## 概述

将已有绘本标记为可复用模板，定义可替换角色区域和声音替换规则。基于模板创作只替换标注的角色形象区域和朗读声音，其他内容（文字、布局、背景、结构）全部锁定。

## 前端归属

- `features/creation` 内的模板创作路径
- `entities/template`：模板卡片、模板详情、可替换角色列表、区域预览

## 后端归属

- `template_api.py`、`schema/template.py`、`service/template_service.py`、`model/template.py`

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `book_templates` | 模板基础信息 |
| `template_characters` | 可替换角色 |
| `template_replace_regions` | 角色形象替换区域 |
| `template_creation_records` | 模板创作记录 |

## 核心接口

- 公开：`templates`、`templates/{id}`、`validate-replacements`、`preview`、`create-book`
- 后台：`admin/templates/from-book`、角色/区域管理、校验

## 复用入口

- 前端：`TemplateSelector`、`TemplateReplacementForm`、`TemplatePreview`
- 后端：`list_templates()`、`validate_template_replacements()`、`create_book_from_template()`

## 边界

- 模板不维护独立页面内容，页面结构来自原绘本
- 基于模板创作只能替换已标注角色形象区域和朗读声音
- 不允许更换画风、背景、页面构图、正文、音效、互动提示、学习卡片和播放节奏

## 完整来源

- 详细设计全文：`raw/articles/module-design/template.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[book-player-reading]] — 原型绘本
- [[creation-generation]] — 模板创作流程
- [[asset-storage]] — 角色形象选择
