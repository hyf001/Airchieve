# 创作生成与异步任务详细设计

对应总览：`docs/module-design/module-design.md` 4.9 `creation / generation_task / ai_provider`

总设计文档：[module-design.md](module-design.md)

前端原型：[create.html](../frontend/create.html)、[stories.html](../frontend/stories.html)、[book-detail.html](../frontend/book-detail.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 6 绘本生成，Story 8 基于绘本创建类似作品。

## 1. 模块目标

编排基于故事生成绘本、从想法生成故事、分镜生成、插图生成、语音生成、局部重生成和保存绘本；统一管理异步任务生命周期，并通过 AI provider 适配外部模型。

## 2. 前端设计

### 页面

- `pages/create`

### 功能模块

- `features/creation`
  - 创建绘本向导。
  - 故事来源选择：系统故事、我的故事、上传/粘贴、一个想法。
  - 儿童档案选择和默认配置带入。
  - 角色形象和声音选择。
  - 分镜编辑。
  - 图片、音频、对口型生成。
  - 局部重生成。
  - 播放预览。
  - 保存个人绘本。
  - 创建类似作品预填。
- `entities/generation-task`
  - 任务进度、失败原因、重试控件。

### 前端公开入口

- `CreationWizard`
- `StorySourceStep`
- `AssetSelectionStep`
- `StoryboardEditor`
- `VoiceGenerationStep`
- `CreationPreviewPlayer`
- `GenerationTaskStatus`
- `useCreationSession()`
- `useGenerationTask(taskId)`

## 3. 后端设计

### 后端归属

- `creation`：创作会话、步骤状态、草稿配置、分镜、保存绘本。
- `generation_task`：异步任务生命周期、进度、失败、重试、结果引用。
- `ai_provider`：外部 AI provider 适配、供应商路由、参数归一化、错误映射、用量记录。

### 前台 API

- `POST /api/v1/creation/sessions`
- `GET /api/v1/creation/sessions/{session_id}`
- `PATCH /api/v1/creation/sessions/{session_id}/config`
- `POST /api/v1/creation/sessions/{session_id}/generate-story`
- `POST /api/v1/creation/sessions/{session_id}/generate-storyboard`
- `PATCH /api/v1/creation/sessions/{session_id}/storyboard/pages/{page_id}`
- `POST /api/v1/creation/sessions/{session_id}/generate-images`
- `POST /api/v1/creation/sessions/{session_id}/generate-audio`
- `POST /api/v1/creation/sessions/{session_id}/regenerate`
- `POST /api/v1/creation/sessions/{session_id}/save-book`
- `GET /api/v1/generation-tasks/{task_id}`
- `POST /api/v1/generation-tasks/{task_id}/retry`

### Service

- `create_session(user_id, payload) -> CreationSessionRead`
- `update_session_config(user_id, session_id, payload) -> CreationSessionRead`
- `confirm_uploaded_story(user_id, session_id, payload) -> StoryRead`
- `generate_story(user_id, session_id, idea_payload) -> GenerationTaskRead`
- `generate_storyboard(user_id, session_id) -> GenerationTaskRead`
- `update_storyboard_page(user_id, session_id, page_id, payload) -> StoryboardPageRead`
- `generate_images(user_id, session_id, page_ids) -> GenerationTaskRead`
- `generate_audio(user_id, session_id, page_ids) -> GenerationTaskRead`
- `regenerate(user_id, session_id, payload) -> GenerationTaskRead`
- `save_book(user_id, session_id) -> BookRead`
- `create_task(task_type, input_payload, owner) -> GenerationTaskRead`
- `get_task(task_id) -> GenerationTaskRead`
- `retry_task(task_id) -> GenerationTaskRead`
- `generate_text(request)`
- `generate_structured(request, response_schema)`
- `generate_image(request)`
- `generate_audio(request)`
- `generate_lip_sync(request)`
- `generate_character_image(request)`

## 4. 关键契约与校验规则

### CreationSessionCreate

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| creation_type | enum(`story_to_book`,`template_book`,`similar_book`) | 创作路径 |
| child_profile_id | int nullable | 选择儿童档案；必须校验归属 |
| story_source_type | enum(`system_story`,`user_story`,`uploaded_story`,`idea`) nullable | 基于故事生成时必填；模板路径为空 |
| story_id | int nullable | 系统故事或我的故事 ID |
| template_id | int nullable | 模板路径必填 |
| reference_book_id | int nullable | 创建类似作品时必填 |
| language | enum(`zh`,`en`,`bilingual`) | 生成语言 |
| target_page_count | integer | MVP 必须在 6-12 页 |
| age_range_codes | string[] | 适龄范围 |
| theme_codes | string[] | 主题 |
| education_goal_codes | string[] | 教育目标 |
| narrative_style_code | string nullable | 叙事风格 code |

校验：

- `story_to_book` 必须有 `story_source_type`，且 `target_page_count` 在 6-12。
- `template_book` 必须有 `template_id`，不得进入普通画风选择和分镜编辑步骤。
- `similar_book` 必须有 `reference_book_id`，只复制主题、适龄、页数、视觉风格、结构参考等摘要，不复制原绘本文字、图片、音频或视频。

### UploadedStoryInput

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| title | string | 故事标题 |
| body | text | 故事正文 |
| source_type | enum(`paste`,`text_file`) | 上传方式 |
| upload_consent_id | int | 上传授权确认 |

校验：

- `body` MVP 最大 3000 中文字或等价长度，超过返回 `STORY_TEXT_TOO_LONG`。
- 必须先通过 `privacy.record_upload_consent()` 记录用户确认其拥有使用权。
- 确认后的故事写入 `story`，仍保持纯文本资产，不产生页面、插图、音频或播放结构。

### CreationConfigPatch

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| character_refs | `CharacterRef[]` | 选择的角色形象 |
| voice_ref | `VoiceRef` nullable | 系统声音或用户声音 |
| language | enum(`zh`,`en`,`bilingual`) nullable | 生成语言 |
| target_page_count | integer nullable | 页数，仍需保持 6-12 |

`CharacterRef` 字段：`source` enum(`story_original`,`child_profile_default`,`user_character`,`system_character`,`generated`)、`character_id` nullable、`role_code` nullable、`display_name` nullable、`art_style_code` nullable、`custom_art_style_prompt` nullable。

`VoiceRef` 字段：`source` enum(`template_default`,`system`,`user`)、`voice_id` nullable、`display_name` nullable。

校验：

- 所有素材必须调用 `asset.assert_asset_usable()` 和 `entitlement` 校验。
- 生成绘本插图时必须使用所选角色形象绑定的画风；用户头像或参考图不能直接作为绘本出图素材。
- 如果需要新画风，必须先通过 `asset.create_character()` 基于头像/参考图、画风和生成指令创建新的角色形象。
- 选择用户声音时，后续生成的每页正文音频必须使用该声音。
- 中英双语必须同时生成 `text_zh`、`text_en` 和对应 `narration_text`。

### StoryboardPagePatch

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| page_no | integer | 页码 |
| title | string nullable | 页面标题 |
| text_zh | text nullable | 中文正文 |
| text_en | text nullable | 英文正文 |
| narration_text | text nullable | 朗读文本 |
| visual_prompt | text | 画面描述 |
| character_appearances | `CharacterAppearance[]` | 出场形象 |
| dialogues | `DialogueMark[]` | 对白标记 |

`DialogueMark` 字段：`speaker_ref`、`text`、`narration_text` nullable、`start_ms` nullable、`end_ms` nullable、`sort_order`。

校验：

- 页面顺序必须连续且唯一。
- 对白必须引用本会话中的形象或模板角色。
- 局部编辑后，对应页的图片、音频、对口型状态必须回退到可重新生成的状态。

### RegenerateRequest

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| target_type | enum(`story`,`storyboard`,`page_text`,`page_image`,`page_dialogue`,`page_audio`,`book_audio`,`lip_sync`) | 重生成对象 |
| page_ids | string[] nullable | 局部页面 |
| reason | string nullable | 用户或系统原因 |
| override_prompt | text nullable | 可选补充提示 |

校验：

- `page_image`、`page_text`、`page_dialogue`、`page_audio` 必须指定 `page_ids`。
- `book_audio` 会重置整本音频和对口型状态。
- 任何重生成都必须重新检查额度预占或扣减策略。

### GenerationTaskRead

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 任务 ID |
| task_type | enum(`story`,`storyboard`,`character_image`,`image`,`audio`,`lip_sync`,`template_composite`,`pdf_export`) | 任务类型 |
| owner_type | string | 发起模块 |
| owner_id | int | 发起对象 |
| status | enum(`queued`,`running`,`succeeded`,`failed`,`canceled`) | 状态 |
| progress_percent | integer | 0-100 |
| result_refs | JSON nullable | 结果引用，不直接内嵌大文本或文件 |
| error_code | string nullable | 稳定错误码 |
| error_message | string nullable | 可展示错误摘要 |
| retryable | bool | 是否可重试 |
| started_at / finished_at | datetime nullable | 时间戳 |

错误码：

- `STORY_TEXT_TOO_LONG`
- `PAGE_COUNT_OUT_OF_RANGE`
- `ASSET_NOT_USABLE`
- `ENTITLEMENT_REQUIRED`
- `QUOTA_NOT_ENOUGH`
- `TEMPLATE_CONTENT_LOCKED`
- `REFERENCE_COPY_FORBIDDEN`
- `PROVIDER_TIMEOUT`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_FAILED`
- `TASK_NOT_RETRYABLE`

### 生成性能目标

- MVP 单本 AI 绘本长度限定 6-12 页。
- 单次生成耗时目标 P75 <= 90 秒，统计口径由 `analytics` 记录 `creation_task_duration`。
- 超过 provider 超时时间必须把 `generation_task.status` 置为 `failed`，`error_code=PROVIDER_TIMEOUT`，并保留可重试状态。

## 5. 数据库结构设计

### creation 数据库定义

#### creation_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 创作会话 |
| user_id | int indexed | 用户 |
| child_profile_id | int nullable | 儿童档案 |
| creation_type | enum(`story_to_book`,`template_book`,`similar_book`) | 创作类型 |
| status | enum(`draft`,`generating`,`preview`,`saved`,`failed`,`canceled`) | 状态 |
| current_step | enum(`story`,`template`,`character`,`storyboard`,`voice`,`preview`) | 当前步骤 |
| story_source_type | enum(`system_story`,`user_story`,`uploaded_story`,`idea`) nullable | 故事来源；模板路径为空 |
| story_id | int nullable | 已确认故事 |
| template_id | int nullable | 模板路径使用的模板 |
| idea_prompt | text nullable | 想法输入 |
| reference_book_id | int nullable | 类似作品参考绘本 |
| language | enum(`zh`,`en`,`bilingual`) | 生成语言 |
| target_page_count | integer | 目标页数，MVP 6-12 |
| age_range_codes | JSON array | 适龄 |
| theme_codes | JSON array | 主题 |
| education_goal_codes | JSON array | 教育目标 |
| narrative_style_code | string nullable | 叙事风格 code |
| character_refs | JSON array | 选择的角色形象，包含绑定画风摘要 |
| voice_ref | JSON nullable | 声音 |
| quota_reservation_id | int nullable | 生成额度预占 |
| saved_book_id | int nullable | 保存后的绘本 |
| created_at / updated_at | datetime | 时间戳 |

#### creation_storyboard_pages

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 分镜页 |
| session_id | int FK creation_sessions.id indexed | 会话 |
| page_no | integer | 页码 |
| title | string nullable | 页标题 |
| text_zh | text nullable | 中文正文 |
| text_en | text nullable | 英文正文 |
| narration_text | text nullable | 朗读文本 |
| visual_prompt | text | 画面描述 |
| character_appearances | JSON array | 出场形象 |
| dialogues | JSON array | 对白标记 |
| image_asset_id | int nullable | 生成插图 |
| audio_asset_id | int nullable | 生成语音 |
| generation_status | enum(`draft`,`pending`,`ready`,`failed`) | 生成状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`session_id,page_no`。

### generation_task 数据库定义

#### generation_tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 任务 ID |
| task_type | enum(`story`,`storyboard`,`character_image`,`image`,`audio`,`lip_sync`,`template_composite`,`pdf_export`) | 类型 |
| owner_type | string | 发起模块，如 `creation` |
| owner_id | int | 发起对象 ID |
| user_id | int nullable indexed | 用户 |
| status | enum(`queued`,`running`,`succeeded`,`failed`,`canceled`) | 状态 |
| progress_percent | integer | 进度 |
| input_payload | JSON | 输入摘要 |
| output_payload | JSON nullable | 输出引用 |
| provider | string nullable | AI/导出 provider |
| error_code | string nullable | 错误码 |
| error_message | text nullable | 错误信息 |
| retry_count | integer | 重试次数 |
| started_at | datetime nullable | 开始时间 |
| finished_at | datetime nullable | 完成时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`owner_type,owner_id`、`user_id,status`、`task_type,status`。

#### generation_task_attempts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 尝试 ID |
| task_id | int FK generation_tasks.id indexed | 任务 |
| attempt_no | integer | 尝试次数 |
| status | enum(`running`,`succeeded`,`failed`) | 状态 |
| provider_request_id | string nullable | provider 请求 ID |
| error_payload | JSON nullable | 错误详情 |
| started_at | datetime | 开始时间 |
| finished_at | datetime nullable | 结束时间 |

### ai_provider 数据库定义

#### ai_provider_calls

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 供应商调用 ID |
| task_id | int nullable indexed | 关联 generation_task |
| provider | string indexed | 供应商 |
| model | string | 模型名 |
| capability | enum(`text`,`structured`,`image`,`audio`,`lip_sync`) | 能力类型 |
| request_payload_snapshot | JSON nullable | 请求摘要，禁止保存敏感原文或密钥 |
| response_payload_snapshot | JSON nullable | 响应摘要或结果引用 |
| status | enum(`succeeded`,`failed`,`timeout`,`canceled`) | 调用状态 |
| latency_ms | integer nullable | 耗时 |
| error_code | string nullable | 错误码 |
| error_message | text nullable | 错误信息 |
| created_at / updated_at | datetime | 时间戳 |

索引：`provider,model,status`、`task_id`、`created_at`。

#### ai_provider_usage_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 用量记录 ID |
| provider_call_id | int indexed | 供应商调用 |
| provider | string indexed | 供应商 |
| model | string | 模型名 |
| usage_type | enum(`tokens`,`image_count`,`audio_seconds`,`video_seconds`,`request_count`) | 用量类型 |
| usage_amount | numeric | 用量 |
| estimated_cost | numeric nullable | 预估成本 |
| currency | string nullable | 币种 |
| occurred_at | datetime indexed | 发生时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`provider,model,occurred_at`、`usage_type,occurred_at`。
## 6. 跨模块协作

- 调用 `story` 获取和校验故事。
- 调用 `asset` 获取和校验角色形象、角色形象绑定画风、声音。
- 调用 `book` 创建草稿绘本和最终绘本。
- 调用 `template` 处理模板创作路径。
- 调用 `entitlement` 校验生成额度和 VIP 素材。
- 调用 `storage` 保存生成结果文件。
- 调用 `privacy` 记录上传/粘贴故事授权确认。
- 发布 `domain_event` 给统计和审核模块消费。

## 7. 边界规则

- 基于故事生成选择角色形象后，插图画风跟随角色形象绑定画风；可以编辑分镜、局部重生成。
- 基于模板创作不走普通画风/分镜编辑能力。
- `creation` 不做素材 CRUD，不直接调用供应商 SDK。
- `generation_task` 不做权益判断，不决定结果归属。
- `ai_provider` 不创建或修改故事、绘本、素材、模板等业务对象。
- 创建类似作品不得复制原绘本文字、图片、音频、视频或受锁定的模板内容，只能使用摘要化参考配置。
