---
source_url: file://docs/module-design/book-player-reading.md
ingested: 2026-05-20
sha256: 686ae3393bf55584467bc42e1cc2234d93eff7fb357355ec708d36f7beb6203c
---

# 绘本内容、播放器与阅读状态详细设计

对应总览：`docs/module-design/module-design.md` 4.6 `book-player / book / reading`

总设计文档：[module-design.md](module-design.md)

前端原型：[book-detail.html](../frontend/book-detail.html)、[player.html](../frontend/player.html)、[share.html](../frontend/share.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 3 在线播放绘本，Story 4 亲子共读，并支撑 Story 12 分享页只读播放和 Story 13 儿童阅读区安全边界。

## 1. 模块目标

管理绘本作为可播放内容资产的模型、详情和播放器 payload，同时管理用户与儿童档案维度的收藏、阅读进度、阅读历史和播放事件。

## 2. 前端设计

### 页面

- `pages/book-detail`
- `pages/player`
- `pages/share` 复用只读播放器

### 功能模块

- `features/book-player`
  - 播放、暂停、上一页、下一页、进度条、重新播放。
  - 自动朗读、手动翻页、亲子共读模式。
  - 中文、英文、中英双语模式和双语顺序。
  - 当前句或段落高亮。
  - 语速、背景音乐、音效。
  - 声音切换和当前声音展示。
  - 形象对白和对口型动画同步。
  - 共读提示、学习卡片。
  - 试看页数限制和试看结束态。
  - 内容举报入口。
- `features/reading`
  - 收藏、取消收藏。
  - 保存和读取阅读进度。
  - 继续阅读列表。
  - 播放事件上报。

### 领域组件

- `entities/book/BookCard`
- `entities/book/BookDetailPanel`
- `entities/book/BookPageView`
- `entities/book/LearningCards`
- `entities/book/CoReadingPrompts`
- `features/book-player/BookPlayer`
- `features/book-player/ReadonlyBookPlayer`
- `features/reading/FavoriteButton`
- `features/reading/ContinueReadingList`
- `features/reading/ReadingProgressProvider`

## 3. 后端设计

### 后端归属

- `book`：绘本详情、页面、媒体、双语文本、音频、对白、对口型、共读提示、学习卡片、播放器 payload。
- `reading`：收藏、阅读进度、阅读历史、继续阅读、播放事件。
- `moderation`：播放器举报入口。

### 前台 API

- `GET /api/v1/books`
- `GET /api/v1/books/{book_id}`
- `GET /api/v1/books/{book_id}/player`
- `GET /api/v1/reading/recent`
- `GET /api/v1/reading/favorites`
- `POST /api/v1/reading/favorites/toggle`
- `GET /api/v1/reading/progress/{book_id}`
- `PUT /api/v1/reading/progress/{book_id}`
- `POST /api/v1/reading/events`

### Service

- `get_book(book_id) -> BookRead`
- `list_books(filters) -> Page[BookSummary]`
- `get_book_detail(user_id, book_id) -> BookDetailRead`
- `get_player_payload(user_id, book_id, options) -> BookPlayerPayload`
- `create_book_from_draft(draft_payload) -> BookRead`
- `copy_book_for_template_result(user_id, source_book_id, payload) -> BookRead`
- `save_reading_progress(user_id, book_id, payload) -> ReadingProgressRead`
- `get_reading_progress(user_id, book_id, profile_id=None) -> ReadingProgressRead | None`
- `list_recent_reads(user_id, profile_id=None) -> list[RecentReadSummary]`
- `toggle_favorite(user_id, book_id, payload) -> FavoriteRead`
- `record_play_event(user_id, book_id, event_payload) -> None`

## 4. 数据库结构设计

### book 数据库定义

#### books

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 绘本 ID |
| owner_user_id | int nullable indexed | 个人绘本所属人；系统绘本为空 |
| source_type | enum(`system`,`generated`,`template_result`,`admin`) | 来源 |
| source_story_id | int nullable | 来源故事 |
| title | string | 标题 |
| summary | text nullable | 简介 |
| cover_asset_id | int nullable | 封面 |
| author_name | string nullable | 作者/来源 |
| age_range_codes | JSON array | 适龄 |
| theme_codes | JSON array | 主题 |
| education_goal_codes | JSON array | 教育目标 |
| language | enum(`zh`,`en`,`bilingual`) | 语言 |
| reading_level_code | string nullable | 阅读水平 code |
| narrative_style_code | string nullable | 叙事风格 code |
| character_art_style_code | string nullable | 角色形象绑定的系统画风 code |
| character_custom_art_style_prompt | text nullable | 角色形象绑定的自定义画风描述 |
| default_voice_id | int nullable | 默认朗读声音 |
| estimated_duration_seconds | integer | 预计播放时长 |
| page_count | integer | 页数 |
| access_level | enum(`free`,`preview`,`vip`) | 访问等级 |
| preview_page_count | integer | 试看页数 |
| publish_status | enum(`draft`,`published`,`unpublished`,`deleted`) | 发布状态 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| created_at / updated_at | datetime | 时间戳 |

#### book_pages

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 页面 ID |
| book_id | int FK books.id indexed | 绘本 |
| page_no | integer | 页码 |
| title | string nullable | 页面标题 |
| text_zh | text nullable | 中文文本 |
| text_en | text nullable | 英文文本 |
| narration_text | text nullable | 朗读文本 |
| visual_prompt | text nullable | 画面描述 |
| image_asset_id | int nullable | 插图 |
| video_asset_id | int nullable | 视频 |
| audio_asset_id | int nullable | 整页朗读音频 |
| background_music_asset_id | int nullable | 背景音乐 |
| sound_effect_asset_ids | JSON array | 音效 |
| duration_seconds | integer nullable | 页面播放时长 |
| lip_sync_status | enum(`none`,`pending`,`ready`,`failed`) | 对口型状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`book_id,page_no`。

#### book_dialogues

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 对白 ID |
| page_id | int FK book_pages.id indexed | 页面 |
| character_ref | string | 说话形象引用 |
| text | text | 对白文本 |
| audio_asset_id | int nullable | 对白音频 |
| start_ms | integer nullable | 起始时间 |
| end_ms | integer nullable | 结束时间 |
| lip_sync_asset_id | int nullable | 对口型素材 |
| sort_order | integer | 排序 |

#### book_reading_prompts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 共读提示 ID |
| book_id | int FK books.id indexed | 绘本 |
| prompt_type | enum(`question`,`interaction`) | 类型 |
| content | text | 内容 |
| page_no | integer nullable | 关联页码 |
| status | enum(`visible`,`hidden`) | 展示状态 |
| sort_order | integer | 排序 |

#### book_learning_cards

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 学习卡片 ID |
| book_id | int FK books.id indexed | 绘本 |
| theme | string nullable | 主题 |
| education_goals | JSON array | 教育目标 |
| vocabulary | JSON array | 重点词汇 |
| discussion_questions | JSON array | 读后讨论问题 |
| status | enum(`visible`,`hidden`) | 状态 |
| sort_order | integer | 排序 |

### reading 数据库定义

#### reading_progress

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 进度 ID |
| user_id | int indexed | 用户 |
| child_profile_id | int nullable indexed | 儿童档案 |
| book_id | int indexed | 绘本 |
| current_page_no | integer | 当前页 |
| current_position_ms | integer | 当前页播放位置 |
| progress_percent | numeric | 进度百分比 |
| mode | enum(`auto`,`manual`,`parent_child`) | 阅读模式 |
| text_mode | enum(`zh`,`en`,`bilingual`) | 文本模式 |
| voice_id | int nullable | 使用声音 |
| last_read_at | datetime | 最近阅读时间 |
| completed_at | datetime nullable | 完播时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, child_profile_id, book_id`。

#### reading_favorites

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 收藏 ID |
| user_id | int indexed | 用户 |
| child_profile_id | int nullable indexed | 儿童档案 |
| book_id | int indexed | 绘本 |
| status | enum(`active`,`deleted`) | 收藏状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, child_profile_id, book_id`。

#### reading_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 事件 ID |
| user_id | int nullable indexed | 用户 |
| child_profile_id | int nullable | 儿童档案 |
| book_id | int indexed | 绘本 |
| event_type | enum(`play_start`,`page_view`,`pause`,`resume`,`complete`,`replay`) | 事件类型 |
| page_no | integer nullable | 页码 |
| position_ms | integer nullable | 播放位置 |
| payload | JSON | 设备、模式等扩展信息 |
| occurred_at | datetime | 发生时间 |
## 5. 跨模块协作

- 调用 `entitlement` 判断绘本访问、试看和会员状态。
- 调用 `asset/storage` 获取媒体访问地址。
- 调用 `voice-library/asset` 选择朗读声音。
- 调用 `account` 校验儿童档案归属。
- 通过 `domain_event` 发布阅读、收藏、完播事件给 `analytics`。

## 6. 边界规则

- `book_player_service` 是 `book` 内部服务，不是独立业务模块。
- 前端播放器只消费 `BookPlayerPayload`，不自行组装页面和媒体。
- `reading` 不修改绘本内容。
- 播放器不负责声音上传、会员套餐页、分享链接管理。
- 儿童播放主流程不展示商业购买入口。
