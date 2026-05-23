---
title: Source Inventory
created: 2026-05-20
updated: 2026-05-23
type: concept
tags: [module-design, frontend, backend, api, database]
sources: [raw/articles/module-design.md, raw/articles/generation-task-execution-design.md, raw/articles/picture-book-website-prd.md]
---

# Source Inventory

## 用途

本页是 wiki 的无损来源清单。后续如果要把 `docs/module-design/`、`docs/frontend/` 或 PRD 原文件归档，应先确认这里列出的 raw 文件都存在、sha256 校验通过，并且二层页面已链接到对应 raw 来源。

## Raw 文件清单

- `raw/articles/external-dependencies.md`
- `raw/articles/external/gemini-tts-speech-generation.md`
- `raw/articles/external/kling-avatar-20-lip-sync.md`
- `raw/articles/external/volcengine-tts-http.md`
- `raw/articles/generation-task-execution-design.md`
- `raw/articles/module-design.md`
- `raw/articles/module-design/account-profile.md`
- `raw/articles/module-design/admin.md`
- `raw/articles/module-design/analytics-domain-event.md`
- `raw/articles/module-design/asset-storage.md`
- `raw/articles/module-design/book-player-reading.md`
- `raw/articles/module-design/creation-generation.md`
- `raw/articles/module-design/discovery-recommendation.md`
- `raw/articles/module-design/membership-payment.md`
- `raw/articles/module-design/moderation-audit.md`
- `raw/articles/module-design/module-design.md`
- `raw/articles/module-design/share-export-privacy.md`
- `raw/articles/module-design/story-library.md`
- `raw/articles/module-design/taxonomy.md`
- `raw/articles/module-design/template.md`
- `raw/articles/picture-book-website-prd.md`
- `raw/prototypes/artstyle.html`
- `raw/prototypes/auth.html`
- `raw/prototypes/book-detail.html`
- `raw/prototypes/characters.html`
- `raw/prototypes/create.html`
- `raw/prototypes/index.html`
- `raw/prototypes/manifest.md`
- `raw/prototypes/membership.html`
- `raw/prototypes/player.html`
- `raw/prototypes/profile.html`
- `raw/prototypes/share.html`
- `raw/prototypes/stories.html`
- `raw/prototypes/voices.html`

## 使用原则

- 二层页面用于组织、摘要和跨模块导航。
- `raw/` 文件保存完整原文，是避免信息丢失的兜底层。
- 模块页按 [[module-contract-standard]] 组织，模块之间的允许依赖以 [[module-dependency-matrix]] 为准。
- 模块级详细字段、接口、契约、Service、数据库定义以 `raw/articles/module-design/*.md` 为准。
- 生成任务执行机制以 `raw/articles/generation-task-execution-design.md` 为准。
- 外部供应商接口参考以 `raw/articles/external/*.md` 为准；这些文件保存来源 URL、摄取日期、关键契约和 AIrchieve 实现映射，不复制完整第三方文档正文。
- PRD 验收标准以 `raw/articles/picture-book-website-prd.md` 为准。
- 前端 HTML 原型以 `raw/prototypes/*.html` 为准，来源和 sha256 以 `raw/prototypes/manifest.md` 为准。

## 相关页面

- [[product-requirements]]
- [[generation-task-execution]]
- [[frontend-prototypes]]
- [[architecture-and-layers]]
