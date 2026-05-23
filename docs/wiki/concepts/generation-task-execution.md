---
title: Generation Task Execution
created: 2026-05-23
updated: 2026-05-23
type: concept
tags: [generation-task, creation, backend, storage]
sources: [raw/articles/generation-task-execution-design.md]
---

# Generation Task Execution

## 定义

Generation task execution 是 AIrchieve 后端统一的异步生成任务执行机制。API 和业务 service 负责校验输入、创建业务草稿对象并提交 `generation_tasks`；worker 负责 claim 任务、分发 handler、调用 AI provider 或生成服务，并把结果回写到业务对象。

完整设计原文保存在 `raw/articles/generation-task-execution-design.md`，本页只做结构化索引和跨模块摘要。

## 设计目标

- 统一 `story`、`storyboard`、`image`、`audio`、`lip_sync`、`character_image`、`template_composite`、`pdf_export` 等生成任务的执行方式。
- HTTP API 只提交任务并返回可轮询状态，避免在请求内等待长耗时外部调用。
- 保持任务生命周期、业务对象写入、AI provider、文件存储之间的边界清晰。
- 支持本地单进程 worker、独立 worker 进程，以及按 task type 拆分的分布式 worker 部署。
- 为失败、重试、幂等、进度更新和超时恢复提供一致语义。

## 核心架构

- `generation_task.service`：任务生命周期，包括 create、claim、running、progress、success、failure、retry。
- `worker`：轮询、claim、dispatch、错误兜底和 worker 生命周期。
- 业务 handler：读取 owner、调用 provider 或业务生成服务、保存结果并回写业务对象。
- `ai_provider`：外部 AI 调用、provider 路由、调用记录和错误标准化。
- `storage`：保存生成文件并返回稳定 URL。

## Task 类型

| Task type | Owner | 结果归属 |
| --- | --- | --- |
| `character_image` | `character` | [[asset-storage]] 中的角色图 asset 和 `characters.image_url` |
| `story` | `creation` | [[creation-generation]] 的创作 session 故事草稿 |
| `storyboard` | `creation` | [[creation-generation]] 的分镜页 |
| `image` | `creation` | 分镜页图片 asset 和 page image 字段 |
| `audio` | `creation` | 分镜页音频 asset 和 page audio 字段 |
| `lip_sync` | `creation` | 分镜页对口型视频 URL 或视频 asset |
| `template_composite` | `template_creation_record` | [[template]] 的模板替换预览或个人绘本结果 |
| `pdf_export` | `export_job` | [[share-export-privacy]] 的导出文件 asset 和下载 URL |

## 执行规则

- worker 原子 claim `QUEUED` task，并将其标记为 `RUNNING` 后提交事务。
- 外部 AI 或长耗时生成服务调用不应发生在长事务内。
- handler 成功后回写业务对象并标记 task `SUCCEEDED`。
- handler 失败时写入明确 error code，并同步更新业务对象失败状态。
- retry 不重新创建业务对象，只重跑同一个 owner；handler 必须幂等。
- 长时间停留在 `RUNNING` 的任务需要 watchdog 标记失败或重新入队。

## API 交互

生成 API 返回 task 状态而不是等待生成结果。前端通过 `/generation-tasks/{id}` 轮询，完成后刷新对应业务详情：

- 角色：`GET /assets/characters/{id}`
- 创作：`GET /creation/sessions/{id}`
- 导出：`GET /export/jobs/{id}`

## 相关页面

- [[creation-generation]] — 创作向导、分镜编辑、AI 生成任务和 provider 适配。
- [[asset-storage]] — 角色图、绘本页图片、音频、视频、PDF 等生成文件的保存和稳定 URL。
- [[template]] — 模板替换和个人绘本生成。
- [[share-export-privacy]] — PDF 导出、分享和隐私约束。
