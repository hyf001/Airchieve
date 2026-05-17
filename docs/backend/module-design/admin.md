# admin 模块详细设计

## 功能

- 提供后台入口和运营动作编排。
- 后台可以调用各业务模块公开 service，但不能绕过业务模块直接写核心数据。
- 覆盖系统故事、系统绘本、模板、系统素材、分类、会员权益、审核举报、推荐位、生成任务监控、运营数据查看。
- 所有后台写操作必须调用 `audit_service.write_audit_log()`。

## 接口

### 后台聚合 API

- `GET /api/v1/admin/dashboard`：后台首页聚合。
- `GET /api/v1/admin/content/overview`：内容概览。
- `GET /api/v1/admin/generation-tasks`：生成任务监控。
- `GET /api/v1/admin/users/{user_id}/summary`：用户摘要。

### 后台编排动作

- `POST /api/v1/admin/stories/{story_id}/publish`：调用 story 发布。
- `POST /api/v1/admin/books/{book_id}/publish`：调用 book 发布。
- `POST /api/v1/admin/share-links/{share_id}/ban`：调用 share 禁用。
- `POST /api/v1/admin/moderation/{record_id}/handle`：调用 moderation 处理。

### Service

- `get_admin_dashboard(filters) -> AdminDashboardRead`
- `publish_story(operator, story_id, payload) -> StoryRead`
- `publish_book(operator, book_id, payload) -> BookRead`
- `ban_share_link(operator, share_id, reason) -> ShareLinkRead`
- `handle_moderation(operator, record_id, payload) -> ModerationRecordRead`
- `write_admin_action(operator, action, target, before, after) -> AuditLogRead`

## 数据库定义

admin 模块不拥有核心业务表。后台专属配置可按需落在目标模块，例如推荐配置在 `recommendation`，会员计划在 `membership`，审核在 `moderation`，审计在 `audit`。

## Schema 定义

- `AdminDashboardRead`：待审核数量、生成任务异常、内容统计、支付订阅摘要、举报摘要。
- `AdminContentOverviewRead`：故事、绘本、模板、素材各状态数量。
- `AdminActionRequest`：通用后台动作参数，如 `reason`、`remark`。
- `AdminOperatorDTO`：后台操作人 ID、角色、权限摘要。

