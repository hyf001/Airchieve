---
title: 创作生成与异步任务
created: 2026-05-19
updated: 2026-05-23
type: entity
tags: [creation, generation-task, ai-provider, module-design]
sources: [raw/articles/module-design/creation-generation.md, raw/articles/generation-task-execution-design.md, raw/articles/external/gemini-tts-speech-generation.md, raw/articles/external/volcengine-tts-http.md, raw/articles/external/kling-avatar-20-lip-sync.md]
---

# 创作生成与异步任务 (creation / generation_task / ai_provider)

## 概述

编排完整的绘本创作工作流：故事到绘本、基于模板创作、基于类似作品创作。管理创作会话（多步向导）、分镜编辑、AI 生成任务（文本、图片、音频、对口型）和异步任务生命周期（含重试）。`ai_provider` 层归一化外部模型调用并追踪用量/成本。

## 前端归属

- `features/creation`：创建向导、故事路径、模板路径、儿童档案选择、角色形象和声音选择、分镜编辑、生成任务状态、失败重试、播放预览
- `entities/generation-task`：任务进度、失败原因、重试控件

## 后端归属

- `creation`：创作会话、步骤状态、草稿配置、分镜、保存绘本
- `generation_task`：异步任务生命周期、进度、失败、重试、结果引用
- `ai_provider`：外部模型适配、供应商路由、错误映射、用量记录

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `creation_sessions` | 创作会话 |
| `creation_storyboard_pages` | 分镜页 |
| `generation_tasks` | 生成任务 |
| `generation_task_attempts` | 任务尝试 |
| `ai_provider_calls` | AI 供应商调用记录 |
| `ai_provider_usage_records` | AI 用量记录 |

## 核心接口

- 会话：`creation/sessions`、config patch、`generate-story`、`generate-storyboard`、分镜编辑、`generate-images`、`generate-audio`、`regenerate`、`save-book`
- 任务：`generation-tasks/{id}`、retry

## Generation Task Execution

[[generation-task-execution]] 定义统一的异步生成任务执行机制：API 只提交 task 并返回可轮询状态，worker 原子 claim `QUEUED` task 后按 `task_type` 分发 handler。handler 负责读取 owner、调用 AI provider 或生成服务、保存生成 asset，并回写业务对象与 task 结果。

该设计覆盖 `story`、`storyboard`、`image`、`audio`、`lip_sync`、`character_image`、`template_composite`、`pdf_export` 等任务类型。`creation` 相关 handler 归属创作模块；角色图、模板合成、PDF 导出分别回到 [[asset-storage]]、[[template]]、[[share-export-privacy]] 的业务边界内完成结果写入。

## 复用入口

- 前端：`CreationWizard`、`StoryboardEditor`、`GenerationTaskStatus`、`CreationPreviewPlayer`
- 后端：`create_session()`、`generate_story()`、`generate_storyboard()`、`generate_images()`、`generate_audio()`、`save_book()`

## 边界

- 基于模板创作不走普通画风/分镜编辑能力
- `creation` 不做素材 CRUD，不直接调用供应商 SDK
- `generation_task` 不做权益判断，不决定结果归属
- 创建类似作品只复用参考信息，不复制原文和图片

## AI Provider 语音生成参考

- Gemini TTS：官方接口以 `response_modalities=["AUDIO"]` 返回音频 inline data；Python 示例将 24k PCM 写入 WAV 容器。AIrchieve 中应由 `ai_provider` 适配为统一音频引用，再由 `creation` 写回分镜或保存后的绘本页。
- Volcengine / Doubao TTS：HTTP 非流式接口使用 `POST /api/v1/tts`，请求头为 `Authorization: Bearer;token`，响应 JSON 中音频为 base64；每次请求需使用唯一 `reqid`。AIrchieve 中应把 AppID、Token、Cluster、Voice Type 放在集中配置里。
- 两条 provider 路径都不拥有业务对象：它们只生成音频并记录调用，结果归属由 `creation` / `book` / `asset-storage` 的服务边界决定。

## AI Provider 对口型生成参考

- Kling Avatar 2.0：官方产品资料说明它可基于角色图片、语音内容和可选表演 prompt 生成动态 avatar 视频，适合绘本页插图 + 朗读音频的链路。
- AIrchieve 当前保留“图片 + 音频”对口型路径：输入要求是公网可访问的 `image_url` 和 `audio_url`；因此 provider 返回的 `data:` 图片/音频需要先通过 [[asset-storage]] 持久化。
- API 适配采用 Avatar 2.0 compatible async workflow：提交后返回 `task_id`，随后查询任务状态；完成后从 `files` 中取 `file_type=video` 的 URL。
- 生成结果写回 `CreationStoryboardPage.lip_sync_url`；保存绘本时作为 `BookPage.video_url` 输出，并将 `lip_sync_status` 标记为 `ready`。生产链路仍应把供应商临时结果落 OSS，形成稳定书页媒体。

## 完整来源

- 详细设计全文：`raw/articles/module-design/creation-generation.md`
- 任务执行设计全文：`raw/articles/generation-task-execution-design.md`
- Gemini TTS 官方参考摘要：`raw/articles/external/gemini-tts-speech-generation.md`
- Volcengine / Doubao TTS 官方参考摘要：`raw/articles/external/volcengine-tts-http.md`
- Kling Avatar 2.0 对口型参考摘要：`raw/articles/external/kling-avatar-20-lip-sync.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[story-library]] — 故事来源
- [[generation-task-execution]] — 异步生成任务执行机制
- [[template]] — 模板创作路径
- [[asset-storage]] — 角色形象和声音选择
- [[membership-payment]] — 生成额度
- [[book-player-reading]] — 保存后的绘本
