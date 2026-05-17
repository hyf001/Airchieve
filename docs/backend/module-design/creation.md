# creation 模块详细设计

## 功能

- 编排“基于故事生成绘本”的创作流程。
- 支持从系统故事、我的故事、上传/粘贴故事、一个想法生成故事开始。
- 管理创作会话、步骤状态、草稿配置、分镜、局部重生成、保存到个人绘本库。
- 支持从已有绘本创建类似作品，只复用主题、适龄范围、长度、画风等参考，不复制原文和图片。
- 所有 AI 生成动作通过 `generation_task`；故事、素材、权益分别调用对应模块。

## 接口

### 前台 API

- `POST /api/v1/creation/sessions`：创建创作会话。
- `GET /api/v1/creation/sessions/{session_id}`：获取会话详情。
- `PATCH /api/v1/creation/sessions/{session_id}/config`：更新故事、形象、画风、声音、语言等配置。
- `POST /api/v1/creation/sessions/{session_id}/generate-story`：从想法生成故事。
- `POST /api/v1/creation/sessions/{session_id}/generate-storyboard`：生成分镜。
- `PATCH /api/v1/creation/sessions/{session_id}/storyboard/pages/{page_id}`：编辑单页分镜。
- `POST /api/v1/creation/sessions/{session_id}/generate-images`：生成插图。
- `POST /api/v1/creation/sessions/{session_id}/generate-audio`：生成语音。
- `POST /api/v1/creation/sessions/{session_id}/regenerate`：局部重生成。
- `POST /api/v1/creation/sessions/{session_id}/save-book`：保存为个人绘本。
- `POST /api/v1/creation/from-book/{book_id}`：从已有绘本创建类似作品。

### Service

- `create_session(user_id, payload) -> CreationSessionRead`
- `update_session_config(user_id, session_id, payload) -> CreationSessionRead`
- `generate_story(user_id, session_id, idea_payload) -> GenerationTaskRead`
- `generate_storyboard(user_id, session_id) -> GenerationTaskRead`
- `update_storyboard_page(user_id, session_id, page_id, payload) -> StoryboardPageRead`
- `generate_images(user_id, session_id, page_ids) -> GenerationTaskRead`
- `generate_audio(user_id, session_id, page_ids) -> GenerationTaskRead`
- `create_session_from_book_reference(user_id, book_id, payload) -> CreationSessionRead`
- `save_book(user_id, session_id) -> BookRead`

## 数据库定义

### creation_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 创作会话 |
| user_id | string indexed | 用户 |
| child_profile_id | string nullable | 儿童档案 |
| creation_type | enum(`story_to_book`,`similar_book`) | 创作类型 |
| status | enum(`draft`,`generating`,`preview`,`saved`,`failed`,`canceled`) | 状态 |
| current_step | enum(`story`,`character`,`art_style`,`storyboard`,`voice`,`preview`) | 当前步骤 |
| story_source_type | enum(`system_story`,`user_story`,`uploaded_story`,`idea`) | 故事来源 |
| story_id | string nullable | 已确认故事 |
| idea_prompt | text nullable | 想法输入 |
| reference_book_id | string nullable | 类似作品参考绘本 |
| language | enum(`zh`,`en`,`bilingual`) | 生成语言 |
| target_page_count | integer | 目标页数，MVP 6-12 |
| age_range_ids | JSON array | 适龄 |
| theme_ids | JSON array | 主题 |
| education_goal_ids | JSON array | 教育目标 |
| narrative_style_id | string nullable | 叙事风格 |
| character_refs | JSON array | 选择的形象 |
| art_style_ref | JSON nullable | 系统画风或自定义画风 |
| voice_ref | JSON nullable | 声音 |
| quota_reservation_id | string nullable | 生成额度预占 |
| saved_book_id | string nullable | 保存后的绘本 |
| created_at / updated_at | datetime | 时间戳 |

### creation_storyboard_pages

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 分镜页 |
| session_id | FK creation_sessions.id indexed | 会话 |
| page_no | integer | 页码 |
| title | string nullable | 页标题 |
| text_zh | text nullable | 中文正文 |
| text_en | text nullable | 英文正文 |
| narration_text | text nullable | 朗读文本 |
| visual_prompt | text | 画面描述 |
| character_appearances | JSON array | 出场形象 |
| dialogues | JSON array | 对白标记 |
| image_asset_id | string nullable | 生成插图 |
| audio_asset_id | string nullable | 生成语音 |
| generation_status | enum(`draft`,`pending`,`ready`,`failed`) | 生成状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`session_id,page_no`。

## Schema 定义

- `CreationSessionCreate`：`creation_type`、`child_profile_id?`、故事来源、语言、年龄、主题、教育目标、页数。
- `CreationSessionConfigUpdate`：故事、形象、画风、声音、语言、页数等可选配置。
- `IdeaStoryGenerateRequest`：`idea`、年龄、故事长度、叙事风格、教育目标、语言。
- `StoryboardPageRead`：页码、标题、文本、画面描述、出场形象、对白、生成素材。
- `StoryboardPageUpdate`：文本、画面描述、出场形象、对白归属、页序。
- `RegenerateRequest`：`target_type`(`page_image`,`page_text`,`page_dialogue`,`audio_all`,`audio_pages`)、`page_ids?`。
- `CreationSessionRead`：会话配置、分镜页、任务摘要、保存状态。

