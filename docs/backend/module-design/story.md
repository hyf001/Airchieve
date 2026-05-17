# story 模块详细设计

## 功能

- 管理故事这种纯文本资产，区分系统故事和我的故事。
- 支持创建、编辑、软删除、上传/粘贴、系统故事列表、故事详情和从故事发起绘本生成。
- 故事只保存标题、正文、简介、适龄范围、主题、教育目标、语言、状态等文本元数据。
- 不保存页面、插图、音频、对白、播放器结构和模板角色区域。
- 使用系统故事或创建个人故事时调用 `entitlement`；上传/粘贴故事时调用 `privacy` 记录授权确认。

## 接口

### 前台 API

- `GET /api/v1/stories`：故事列表，支持 `scope`、主题、年龄、语言、权益状态、关键词筛选。
- `GET /api/v1/stories/{story_id}`：故事详情。
- `POST /api/v1/stories`：创建我的故事。
- `PATCH /api/v1/stories/{story_id}`：更新我的故事。
- `DELETE /api/v1/stories/{story_id}`：软删除我的故事。
- `POST /api/v1/stories/{story_id}/start-creation`：从故事进入创作流程。

### Service

- `get_story(story_id) -> StoryRead`
- `list_stories(filters) -> Page[StorySummary]`
- `create_user_story(user_id, payload) -> StoryRead`
- `update_user_story(user_id, story_id, payload) -> StoryRead`
- `delete_user_story(user_id, story_id) -> None`
- `assert_story_usable(user_id, story_id) -> StoryInternalDTO`
- `list_generated_books(story_id, user_id=None) -> list[BookSummaryDTO]`

## 数据库定义

### stories

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 故事 ID |
| owner_user_id | string nullable indexed | 用户故事所属人；系统故事为空 |
| source_type | enum(`system`,`user`,`uploaded`,`generated_idea`) | 来源 |
| title | string | 标题 |
| summary | text nullable | 简介 |
| body | text | 正文，MVP 上传最大 3000 中文字 |
| cover_asset_id | string nullable | 封面引用 |
| age_range_ids | JSON array | 适龄范围 |
| theme_ids | JSON array | 主题 |
| education_goal_ids | JSON array | 教育目标 |
| language | enum(`zh`,`en`,`bilingual`) | 语言 |
| narrative_style_id | string nullable | 叙事风格 |
| access_level | enum(`free`,`preview`,`vip`) | 权益等级 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| publish_status | enum(`draft`,`published`,`unpublished`,`deleted`) | 发布状态 |
| view_count | integer | 展示统计快照，可由 analytics 回填 |
| created_at / updated_at | datetime | 时间戳 |

索引：`owner_user_id,publish_status`、`source_type,access_level`、`moderation_status`。

## Schema 定义

- `StoryCreate`：标题、正文、简介、年龄段、主题、教育目标、语言、叙事风格、上传授权确认 ID。
- `StoryUpdate`：标题、正文、简介、分类字段可选。
- `StoryRead`：完整故事字段、权益状态、是否可用、关联绘本摘要。
- `StorySummary`：列表卡片所需的标题、简介、封面、适龄、标签、语言、免费/VIP、热度。
- `StoryInternalDTO`：跨模块使用的 `id`、`title`、`body`、分类、语言、来源和权限摘要。
- `StoryListFilters`：`scope`、`keyword`、`age_range_id`、`theme_id`、`education_goal_id`、`language`、`access_level`、`sort`。

