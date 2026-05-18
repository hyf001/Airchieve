# 故事库详细设计

对应总览：`docs/module-design/module-design.md` 4.5 `story-library / story`

总设计文档：[module-design.md](module-design.md)

前端原型：[stories.html](../frontend/stories.html)、[create.html](../frontend/create.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 7 故事库，并支撑 Story 6 绘本生成的故事来源。

## 1. 模块目标

管理故事这种纯文本资产，区分系统故事和我的故事，支持创建、编辑、上传、粘贴、删除、详情、筛选，以及从故事发起绘本生成。

## 2. 前端设计

### 页面

- `pages/stories`

### 功能模块

- `features/story-library`
  - 我的故事列表。
  - 系统故事列表。
  - 故事详情。
  - 故事创建、编辑、删除。
  - 上传或粘贴故事文本。
  - 主题、年龄、语言、权益状态筛选。
  - 从故事发起绘本生成。
  - 展示关联已生成绘本。

### 领域组件

- `entities/story/StoryCard`
- `entities/story/StoryList`
- `entities/story/StorySelector`
- `entities/story/StoryEditor`
- `entities/story/StartCreationFromStoryButton`

## 3. 后端设计

### 后端归属

- API：`story_api.py`
- Schema：`schema/story.py`
- Service：`story_service.py`
- Model：`story.py`

### 前台 API

- `GET /api/v1/stories`
- `GET /api/v1/stories/{story_id}`
- `POST /api/v1/stories`
- `PATCH /api/v1/stories/{story_id}`
- `DELETE /api/v1/stories/{story_id}`
- `POST /api/v1/stories/{story_id}/start-creation`

### Service

- `get_story(story_id) -> StoryRead`
- `list_stories(filters) -> Page[StorySummary]`
- `create_user_story(user_id, payload) -> StoryRead`
- `update_user_story(user_id, story_id, payload) -> StoryRead`
- `delete_user_story(user_id, story_id) -> None`
- `assert_story_usable(user_id, story_id) -> StoryInternalDTO`
- `list_generated_books(story_id, user_id=None) -> list[BookSummaryDTO]`

## 4. 数据库结构设计

### story 数据库定义

#### stories

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 故事 ID |
| owner_user_id | int nullable indexed | 用户故事所属人；系统故事为空 |
| source_type | enum(`system`,`user`,`uploaded`,`generated_idea`) | 来源 |
| title | string | 标题 |
| summary | text nullable | 简介 |
| body | text | 正文，MVP 上传最大 3000 中文字 |
| cover_asset_id | int nullable | 封面引用 |
| age_range_codes | JSON array | 适龄范围 |
| theme_codes | JSON array | 主题 |
| education_goal_codes | JSON array | 教育目标 |
| language | enum(`zh`,`en`,`bilingual`) | 语言 |
| narrative_style_code | string nullable | 叙事风格 code |
| access_level | enum(`free`,`preview`,`vip`) | 权益等级 |
| moderation_status | enum(`pending`,`approved`,`rejected`,`hidden`) | 审核状态 |
| publish_status | enum(`draft`,`published`,`unpublished`,`deleted`) | 发布状态 |
| view_count | integer | 展示统计快照，可由 analytics 回填 |
| created_at / updated_at | datetime | 时间戳 |

索引：`owner_user_id,publish_status`、`source_type,access_level`、`moderation_status`。
## 5. 跨模块协作

- 调用 `taxonomy` 校验年龄、主题、教育目标、语言、叙事风格。
- 调用 `entitlement` 校验 VIP 系统故事和个人故事数量。
- 调用 `privacy` 记录上传/粘贴故事授权确认。
- 调用 `creation` 从故事创建创作会话。
- 调用 `book` 读取关联已生成绘本摘要。

## 6. 边界规则

- 故事是纯文本资产，不包含页面、插图、视频、音频、对白、播放器结构。
- 故事不是模板。
- 故事模块不创建绘本页面，不直接调用 AI 生成插图或音频。
