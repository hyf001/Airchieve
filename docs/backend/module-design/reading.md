# reading 模块详细设计

## 功能

- 管理用户和儿童档案维度的收藏、阅读进度、阅读历史和继续阅读。
- 记录播放开始、页面切换、暂停、完播等阅读行为，并通过 `domain_event` 发布给 `analytics`。
- 不修改绘本正文、页面、媒体，不计算运营统计最终口径。

## 接口

### 前台 API

- `GET /api/v1/reading/recent`：继续阅读列表。
- `GET /api/v1/reading/favorites`：收藏列表。
- `POST /api/v1/reading/favorites/toggle`：收藏/取消收藏。
- `GET /api/v1/reading/progress/{book_id}`：获取阅读进度。
- `PUT /api/v1/reading/progress/{book_id}`：保存阅读进度。
- `POST /api/v1/reading/events`：记录播放事件。

### Service

- `save_reading_progress(user_id, book_id, payload) -> ReadingProgressRead`
- `get_reading_progress(user_id, book_id, profile_id=None) -> ReadingProgressRead | None`
- `list_recent_reads(user_id, profile_id=None) -> list[RecentReadSummary]`
- `toggle_favorite(user_id, book_id, payload) -> FavoriteRead`
- `list_favorites(user_id, profile_id=None) -> Page[FavoriteSummary]`
- `record_play_event(user_id, book_id, event_payload) -> None`

## 数据库定义

### reading_progress

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 进度 ID |
| user_id | string indexed | 用户 |
| child_profile_id | string nullable indexed | 儿童档案 |
| book_id | string indexed | 绘本 |
| current_page_no | integer | 当前页 |
| current_position_ms | integer | 当前页播放位置 |
| progress_percent | numeric | 进度百分比 |
| mode | enum(`auto`,`manual`,`parent_child`) | 阅读模式 |
| text_mode | enum(`zh`,`en`,`bilingual`) | 文本模式 |
| voice_id | string nullable | 使用声音 |
| last_read_at | datetime | 最近阅读时间 |
| completed_at | datetime nullable | 完播时间 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, child_profile_id, book_id`。

### reading_favorites

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 收藏 ID |
| user_id | string indexed | 用户 |
| child_profile_id | string nullable indexed | 儿童档案 |
| book_id | string indexed | 绘本 |
| status | enum(`active`,`deleted`) | 收藏状态 |
| created_at / updated_at | datetime | 时间戳 |

唯一约束：`user_id, child_profile_id, book_id`。

### reading_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 事件 ID |
| user_id | string nullable indexed | 用户 |
| child_profile_id | string nullable | 儿童档案 |
| book_id | string indexed | 绘本 |
| event_type | enum(`play_start`,`page_view`,`pause`,`resume`,`complete`,`replay`) | 事件类型 |
| page_no | integer nullable | 页码 |
| position_ms | integer nullable | 播放位置 |
| payload | JSON | 设备、模式等扩展信息 |
| occurred_at | datetime | 发生时间 |

## Schema 定义

- `ReadingProgressUpsert`：`child_profile_id?`、`current_page_no`、`current_position_ms`、`progress_percent`、`mode`、`text_mode`、`voice_id?`。
- `ReadingProgressRead`：进度完整字段和绘本摘要。
- `FavoriteToggleRequest`：`book_id`、`child_profile_id?`、`favorite: bool`。
- `FavoriteSummary`：收藏 ID、绘本摘要、儿童档案摘要、收藏时间。
- `RecentReadSummary`：绘本摘要、进度、最近阅读时间、是否生成绘本。
- `ReadingEventCreate`：事件类型、绘本 ID、儿童档案 ID、页码、位置、payload。

