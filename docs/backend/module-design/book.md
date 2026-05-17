# book 模块详细设计

## 功能

- 管理绘本作为可播放内容资产的完整模型。
- 支持绘本列表、详情、页面、插图/视频、正文、双语文本、音频、对白、对口型素材、共读提示、学习卡片和播放器内容组装。
- `book_player_service` 是本模块内部服务，负责将页面、媒体、字幕、音频、试看裁剪组装成播放器 payload。
- 不负责收藏、阅读进度、创作流程编排、模板替换规则或 AI 任务调度。

## 接口

### 前台 API

- `GET /api/v1/books`：绘本列表，支持搜索和分类筛选。
- `GET /api/v1/books/{book_id}`：绘本详情。
- `GET /api/v1/books/{book_id}/player`：播放器 payload。
- `POST /api/v1/books/{book_id}/similar-creation-session`：创建类似作品入口，实际调用 `creation`。

### Service

- `get_book(book_id) -> BookRead`
- `list_books(filters) -> Page[BookSummary]`
- `get_book_detail(user_id, book_id) -> BookDetailRead`
- `get_player_payload(user_id, book_id, options) -> BookPlayerPayload`
- `create_book_from_draft(draft_payload) -> BookRead`
- `copy_book_for_template_result(user_id, source_book_id, payload) -> BookRead`
- `update_book_publish_status(book_id, status, operator) -> BookRead`

## 数据库定义

### books

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 绘本 ID |
| owner_user_id | string nullable indexed | 个人绘本所属人；系统绘本为空 |
| source_type | enum(`system`,`generated`,`template_result`,`admin`) | 来源 |
| source_story_id | string nullable | 来源故事 |
| title | string | 标题 |
| summary | text nullable | 简介 |
| cover_asset_id | string nullable | 封面 |
| author_name | string nullable | 作者/来源 |
| age_range_ids | JSON array | 适龄 |
| theme_ids | JSON array | 主题 |
| education_goal_ids | JSON array | 教育目标 |
| language | enum(`zh`,`en`,`bilingual`) | 语言 |
| reading_level_id | string nullable | 阅读水平 |
| narrative_style_id | string nullable | 叙事风格 |
| art_style_id | string nullable | 系统画风 |
| custom_art_style_prompt | text nullable | 自定义画风描述 |
| default_voice_id | string nullable | 默认朗读声音 |
| estimated_duration_seconds | integer | 预计播放时长 |
| page_count | integer | 页数 |
| access_level | enum(`free`,`preview`,`vip`) | 访问等级 |
| preview_page_count | integer | 试看页数 |
| publish_status | enum(`draft`,`published`,`unpublished`,`deleted`) | 发布状态 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| created_at / updated_at | datetime | 时间戳 |

### book_pages

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 页面 ID |
| book_id | FK books.id indexed | 绘本 |
| page_no | integer | 页码 |
| title | string nullable | 页面标题 |
| text_zh | text nullable | 中文文本 |
| text_en | text nullable | 英文文本 |
| narration_text | text nullable | 朗读文本 |
| visual_prompt | text nullable | 画面描述 |
| image_asset_id | string nullable | 插图 |
| video_asset_id | string nullable | 视频 |
| audio_asset_id | string nullable | 整页朗读音频 |
| background_music_asset_id | string nullable | 背景音乐 |
| sound_effect_asset_ids | JSON array | 音效 |
| duration_seconds | integer nullable | 页面播放时长 |
| lip_sync_status | enum(`none`,`pending`,`ready`,`failed`) | 对口型状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`book_id,page_no`。

### book_dialogues

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 对白 ID |
| page_id | FK book_pages.id indexed | 页面 |
| character_ref | string | 说话形象引用 |
| text | text | 对白文本 |
| audio_asset_id | string nullable | 对白音频 |
| start_ms | integer nullable | 起始时间 |
| end_ms | integer nullable | 结束时间 |
| lip_sync_asset_id | string nullable | 对口型素材 |
| sort_order | integer | 排序 |

### book_reading_prompts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 共读提示 ID |
| book_id | FK books.id indexed | 绘本 |
| prompt_type | enum(`question`,`interaction`) | 类型 |
| content | text | 内容 |
| page_no | integer nullable | 关联页码 |
| status | enum(`visible`,`hidden`) | 展示状态 |
| sort_order | integer | 排序 |

### book_learning_cards

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 学习卡片 ID |
| book_id | FK books.id indexed | 绘本 |
| theme | string nullable | 主题 |
| education_goals | JSON array | 教育目标 |
| vocabulary | JSON array | 重点词汇 |
| discussion_questions | JSON array | 读后讨论问题 |
| status | enum(`visible`,`hidden`) | 状态 |
| sort_order | integer | 排序 |

## Schema 定义

- `BookSummary`：封面、标题、简介、适龄、播放时长、语言、标签、免费/VIP、页数、统计摘要。
- `BookDetailRead`：基础信息、共读提示、学习卡片、是否收藏、访问决策、相关推荐。
- `BookPageRead`：页码、标题、中文/英文文本、媒体 URL、音频 URL、对白和对口型状态。
- `BookPlayerPayload`：绘本摘要、播放配置、可播放页列表、试看裁剪信息、当前声音、双语显示模式。
- `BookCreateFromDraft`：来源故事、页面草稿、素材引用、访问等级、发布状态。
- `BookAdminUpdate`：后台可改的基础信息、分类、上下架、试看页、推荐权重。

