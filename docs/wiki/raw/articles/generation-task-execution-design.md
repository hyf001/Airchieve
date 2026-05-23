---
source_url: docs/generation-task-execution-design.md
ingested: 2026-05-23
sha256: 43b4e6263035b30e37c223e9b5b7db850ab7e92e5de39b7437a7b7b5e884b1e2
---

# Generation Task Execution Design

## 设计目标

`generation_tasks` 是后端统一的异步生成任务抽象。业务服务负责校验输入、创建业务草稿对象和提交任务；后台 worker 负责领取任务、分发到对应 handler、调用 AI provider 或生成服务，并把结果回写到业务对象。

设计目标：

- 统一 story、storyboard、image、audio、lip_sync、character_image、template_composite、pdf_export 等生成任务的执行方式。
- 让 HTTP API 只提交任务并返回可轮询状态，避免在请求内等待长耗时外部调用。
- 保持任务生命周期、业务对象写入、AI provider、文件存储之间的边界清晰。
- 支持本地单进程 worker、独立 worker 进程，以及按 task type 拆分的分布式 worker 部署。
- 保证失败、重试、幂等、进度更新和超时恢复具备一致语义。

## 目标架构

```text
API / service
  -> validate permission, entitlement, privacy, input
  -> create domain draft object when needed
  -> create generation task with owner_type / owner_id / input_payload
  -> commit
  -> return task id and current domain snapshot

generation task worker
  -> claim next QUEUED task
  -> mark task RUNNING and commit
  -> dispatch by task_type
  -> handler loads owner object
  -> handler calls ai_provider / export / template service as needed
  -> handler persists assets and updates owner object
  -> mark task SUCCEEDED or FAILED
  -> commit
```

模块边界：

- `generation_task.service` 负责任务生命周期：create、claim、running、progress、success、failure、retry。
- `worker` 负责轮询、claim、dispatch、错误兜底和 worker 生命周期；目录命名保持通用，可承载 PDF、批处理、导入导出、通知等长任务。
- 业务 handler 放在业务模块，或由 `worker.registry` 薄分发后调用业务 service。业务对象的写入逻辑归属业务模块。
- `ai_provider` 负责外部 AI 调用、provider 路由、调用记录和错误标准化，不拥有业务对象。
- `storage` 负责保存生成文件和返回稳定 URL，不理解角色、绘本、导出语义。

## 任务生命周期

### 任务 claim

worker 通过原子 claim 获取待执行任务，避免多个 worker 同时执行同一条 task。

建议接口：

```python
async def claim_next_task(
    db: AsyncSession,
    *,
    task_types: set[GenerationTaskType] | None = None,
) -> GenerationTask | None:
    ...
```

行为：

- 只选择 `status = QUEUED` 的 task。
- 按 `created_at asc, id asc` 取最早任务。
- 成功 claim 后立刻写成 `RUNNING`，创建 `GenerationTaskAttempt`，设置 `started_at`。
- 提交事务后再执行外部 AI。
- 生产数据库使用 `SELECT ... FOR UPDATE SKIP LOCKED` 保证并发安全。

### 任务进度

长任务可以更新 `progress_percent`：

```python
async def update_task_progress(db: AsyncSession, task_id: int, progress_percent: int) -> None:
    ...
```

适用场景包括多页图片、音频批量生成、PDF 导出、模板合成等。任务查询 API 返回 `progress_percent`，前端据此展示进度。

### Retry 语义

retry 将 `FAILED` task 改回 `QUEUED` 并递增 `retry_count`。约束：

- retry 不重新创建业务对象，只重跑同一个 owner。
- handler 必须幂等：
  - 已有成功结果时，避免重复生成或明确覆盖。
  - 保存新 asset 后失败的情况，要允许下一次 retry 覆盖 owner 的 `image_asset_id` / `image_url`。
  - PDF 导出可以复用已有 file asset，或重新生成并更新 job。
- 对不可重试错误，task 可以失败但 API 层应根据 `retryable` 返回 false。

## Worker 设计

`backend/app/worker/` 提供通用 worker 能力：

- 循环拉取 `QUEUED` task。
- 根据 `task_type` 调 handler。
- handler 抛错时统一 mark failed。
- 支持 graceful shutdown。
- 支持一次只跑一个 task，并预留并发数扩展。
- 支持按 task type 启动不同 worker。

开发环境可以在 FastAPI lifespan 中启动：

```python
if settings.WORKER_ENABLED:
    app.state.generation_worker = asyncio.create_task(run_worker())
```

独立进程入口：

```bash
uv run python -m app.worker.main
```

按 task type 启动：

```bash
uv run python -m app.worker.main --task-source generation_task --types image,character_image
uv run python -m app.worker.main --task-source generation_task --types audio
uv run python -m app.worker.main --task-source generation_task --types pdf_export
```

分布式部署要求：

- API 服务和 worker 服务共享同一个数据库、对象存储、配置和密钥管理。
- claim 必须是原子操作，多 worker 并发时使用 PostgreSQL `FOR UPDATE SKIP LOCKED`。
- worker 生成的图片、音频、视频、PDF 必须保存到 OSS/S3 等共享对象存储，再把稳定 `asset_id` / `file_url` 回写数据库。
- 每台 worker 通过配置声明自身支持的 task type。
- handler 必须能承受进程崩溃、超时重试和重复执行。
- 需要超时恢复机制，将长时间停留在 `RUNNING` 的任务标记 `FAILED` 或重新入队，并避免误判仍在执行的任务。

## Handler Registry

`worker.registry` 只负责路由，不承载业务实现：

```python
HANDLERS = {
    GenerationTaskType.CHARACTER_IMAGE: run_character_image_task,
    GenerationTaskType.STORY: run_story_task,
    GenerationTaskType.STORYBOARD: run_storyboard_task,
    GenerationTaskType.IMAGE: run_creation_image_task,
    GenerationTaskType.AUDIO: run_creation_audio_task,
    GenerationTaskType.LIP_SYNC: run_creation_lip_sync_task,
    GenerationTaskType.TEMPLATE_COMPOSITE: run_template_composite_task,
    GenerationTaskType.PDF_EXPORT: run_pdf_export_task,
}
```

registry 调用 handler 时传入 task、数据库会话和必要运行上下文。handler 返回后由 runner 统一处理任务成功或失败；需要回写业务对象的细节留在业务模块内。

## 各 Task 执行方案

### character_image

目标：创建角色后，后台生成角色图，保存为 asset，并回写角色。

输入：

- `owner_type = "character"`
- `owner_id = characters.id`
- `input_payload.reference_asset_id`
- `input_payload.art_style_id`
- `input_payload.custom_art_style_prompt`
- `input_payload.generation_prompt`

Handler 流程：

1. 读取 `Character`，校验仍然 active，且 owner 与 task.user_id 一致。
2. 如有 `reference_asset_id`，通过 `storage.get_asset_url()` 获取公网可访问参考图。
3. 读取 `ArtStyle`，组合角色 prompt：
   - 角色名称、身份标签、描述。
   - 用户 `generation_prompt`。
   - 系统画风 prompt 或自定义画风 prompt。
   - 参考图说明。
   - 输出限制：单个角色形象、儿童友好、无文字、透明或简洁背景可选。
4. 调用 `ai_provider.generate_character_image()`。
5. 如果返回 `data:`，调用 `storage.save_generated_data_url()` 保存到 OSS。
6. 回写：
   - `characters.image_asset_id`
   - `characters.image_url`
7. `mark_task_succeeded(result_refs={"character_id", "image_asset_id", "image_url"})`。

角色图 provider 接口：

```python
async def generate_character_image(
    db: AsyncSession,
    *,
    task_id: int,
    prompt: str,
    reference_image_url: str | None = None,
) -> str:
    ...
```

### story

目标：异步生成故事文本。

输入：

- `owner_type = "creation"`
- `owner_id = creation_sessions.id`
- `input_payload.idea_prompt`

Handler 流程：

1. 读取 `CreationSession`。
2. 调用 `ai_provider.generate_text()`。
3. 回写 session：
   - `idea_prompt`
   - `status = DRAFT`
   - `current_step = CHARACTER`
4. task result 写 `story_preview`。

### storyboard

目标：异步生成分镜并替换 `creation_storyboard_pages`。

输入：

- `owner_type = "creation"`
- `owner_id = creation_sessions.id`
- `input_payload.target_page_count`
- `input_payload.story_id`

Handler 流程：

1. 读取 session 和 story。
2. 调用 `ai_provider.generate_structured()`。
3. 删除旧分镜，写入新分镜。
4. session 设置为 `PREVIEW`、`current_step = STORYBOARD`。
5. task result 写 `storyboard_page_count`。

### image

目标：异步生成绘本页图片。

输入：

- `owner_type = "creation"`
- `owner_id = creation_sessions.id`
- `input_payload.page_ids`

Handler 流程：

1. 读取 session 和 storyboard pages。
2. 将目标页标记为 `PENDING`。
3. 调用 `ai_provider.generate_image()`。
4. 对 provider 返回的 `data:` 图片调用 `storage.save_generated_data_url()`。
5. 回写 page：
   - `image_url`
   - `image_asset_id`
   - `generation_status = READY`
6. session `current_step = VOICE`。
7. task result 写 `page_ids`。

### audio

目标：异步生成绘本页音频。

输入：

- `owner_type = "creation"`
- `owner_id = creation_sessions.id`
- `input_payload.page_ids`
- `input_payload.voice_ref_id`

Handler 流程：

1. 读取 session、page、voice_ref。
2. 调用 `ai_provider.generate_audio()`。
3. 对 `data:` 音频保存 OSS。
4. 回写 page：
   - `audio_url`
   - `audio_asset_id`
   - 清空旧 `lip_sync_url`
   - `generation_status = READY`
5. session `current_step = PREVIEW`。
6. task result 写 `page_ids`。

### lip_sync

目标：异步生成对口型视频。

输入：

- `owner_type = "creation"`
- `owner_id = creation_sessions.id`
- `input_payload.page_ids`

前置条件：

- page 必须有公网可访问 `image_url`。
- page 必须有公网可访问 `audio_url`。

Handler 流程：

1. 读取 session 和目标 pages。
2. 校验图片和音频 URL。
3. 调用 `ai_provider.generate_lip_sync()`。
4. 将 provider 返回的视频保存为稳定 asset 或稳定 OSS URL。
5. 回写 `CreationStoryboardPage.lip_sync_url`。
6. task result 写 `page_ids`。

### template_composite

目标：异步生成模板替换预览图，或基于模板生成个人绘本。

输入：

- `owner_type = "template_creation_record"`
- `owner_id = template_creation_records.id`
- `input_payload.mode`
- `input_payload.template_id`
- `input_payload.replacement_asset_ids`
- `input_payload.character_ids`

Handler 流程：

1. 读取 `TemplateCreationRecord`、模板定义、替换资源和区域配置。
2. 根据 template regions、replacement character/upload asset 生成预览图或最终书籍页面。
3. 保存生成图片到 storage。
4. 回写 record：
   - preview 模式写预览资源引用。
   - book 模式写 `result_book_id`。
5. task result 写 `template_creation_record_id`、生成资源引用和可展示状态。

Handler 归属 template 模块，因为替换规则、区域、模板内容都由 template 拥有。

### pdf_export

目标：异步生成 PDF，保存文件资产，并回写导出任务。

输入：

- `owner_type = "export_job"`
- `owner_id = export_jobs.id`
- `input_payload.book_id`
- `input_payload.format`

Handler 流程：

1. 读取 `ExportJob` 和 `Book` 快照。
2. 生成 PDF 文件。
3. 保存到 storage asset。
4. 回写：
   - `export_jobs.status = SUCCEEDED`
   - `file_asset_id`
   - `file_url`
   - `expires_at`
5. task success result 写 `export_job_id`、`file_asset_id`、`file_url`。

失败时：

- `ExportJob.status = FAILED`。
- task 标记为 `FAILED`。
- 如果生成失败涉及额度消耗，由 entitlement/export 共同决定释放或补偿规则。

## 事务和外部调用规则

handler 不在持有业务事务时等待外部 AI 或长耗时生成服务。

推荐流程：

```text
claim task -> commit
load owner snapshot if needed
call provider outside long transaction
open db transaction
persist files / update owner / mark succeeded
commit
```

如果 handler 需要先把页面设为 `PENDING`，可以单独提交一次：

```text
mark running + set pages pending -> commit
call provider
write results -> commit
```

失败处理：

- provider 异常统一映射到 `PROVIDER_FAILED`，保留前 500-1000 字错误信息。
- 输入或业务状态异常使用更明确 error_code，例如：
  - `OWNER_NOT_FOUND`
  - `ASSET_NOT_USABLE`
  - `TASK_INPUT_INVALID`
  - `UNSUPPORTED_TASK_TYPE`
- handler 失败后要同步回写业务对象失败状态，例如 creation page `FAILED`、export job `FAILED`。

## API 返回策略

生成 API 返回任务状态而不是等待生成结果：

- 创建 task 后返回 `CreationTaskResponse(session, task)`，task 状态为 `QUEUED`。
- 前端通过 `/generation-tasks/{id}` 轮询任务。
- 任务完成后刷新业务详情：
  - 角色：`GET /assets/characters/{id}`
  - 创作：`GET /creation/sessions/{id}`
  - 导出：`GET /export/jobs/{id}`

## 推荐文件结构

```text
backend/app/service/generation_task/
  service.py          # lifecycle: create/list/get/claim/running/progress/success/failure/retry

backend/app/service/asset/
  character.py
  character_generation.py

backend/app/service/creation/
  service.py
  generation_handlers.py

backend/app/service/template/
  service.py
  composite_generation.py

backend/app/service/export/
  service.py
  pdf_generation.py

backend/app/worker/
  __init__.py
  main.py             # generic independent worker entrypoint
  runner.py           # generic worker loop and dispatch
  registry.py         # task source/type -> handler
  generation_task.py  # adapter for generation_tasks claim/status APIs
```
