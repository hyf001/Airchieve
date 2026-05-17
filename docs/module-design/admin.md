# 后台运营详细设计

对应总览：`docs/module-design/module-design.md` 4.13 `admin`

总设计文档：[module-design.md](module-design.md)

前端原型：暂无独立 HTML 原型；后台能力参考 [picture-book-website-prd.md](../picture-book-website-prd.md) 的“绘本管理后台”需求，并复用各业务模块原型。

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 14 绘本管理后台。

## 1. 模块目标

提供后台应用入口和运营动作编排。后台可以调用各业务模块公开 service，但不能绕过业务模块直接写核心数据。

## 2. 前端设计

### 页面

- 后台首页。
- 内容概览。
- 用户摘要。
- 系统故事、用户故事、系统绘本、页面级绘本内容、绘本模板、系统素材、分类、会员权益、推荐位、审核举报、生成任务、分享导出、统计分析入口。

### 功能模块

- `features/admin`
  - 后台布局和权限守卫。
  - Dashboard 聚合。
  - 内容概览。
  - 业务后台页入口注册和面包屑。
  - 统一列表筛选、批量状态操作和变更预览。
  - 后台动作确认和原因填写。
  - 审计日志入口和敏感信息脱敏展示。
  - 各业务后台页面入口编排；具体表单和写操作仍由目标业务模块暴露。

### 后台能力矩阵

| 能力域 | 后台页面/组件 | 写操作归属 | 必须覆盖的关键能力 |
| --- | --- | --- | --- |
| 故事管理 | `AdminStoryList`、`AdminStoryEditor` | `story` | 系统/用户故事列表、创建、编辑、删除、上下架、权益状态、审核状态、关联绘本；故事后台不得维护页面、插图、音频、角色位或播放器结构 |
| 绘本管理 | `AdminBookList`、`AdminBookEditor`、`AdminBookPageEditor` | `book` | 绘本列表、创建、编辑、上下架、删除、搜索、状态筛选；页面顺序、正文、中英文文本、对白、朗读文本、背景音乐、音效、对口型素材状态、共读提示和学习卡片 |
| 模板管理 | `AdminTemplateList`、`AdminTemplateEditor`、`TemplateRegionEditor` | `template` | 从已有绘本创建模板、角色配置、声音替换规则、逐页替换区域、锁定非替换内容、模板校验、替换效果预览 |
| 系统素材 | `AdminCharacterList`、`AdminVoiceList`、`AdminArtStyleList` | `asset` | 系统画风、系统形象、系统声音配置，包含示例、适用年龄、排序、启用状态、免费/VIP 权益状态 |
| 分类配置 | `AdminTaxonomyList` | `taxonomy` | 主题、兴趣、年龄段、阅读水平、教育目标、语言、叙事风格和推荐标签统一管理 |
| 会员权益 | `AdminMembershipPlanList`、`AdminEntitlementEditor` | `membership`、`entitlement` | 会员内容标记、试看页数、生成次数、故事/形象/声音/儿童档案/分享/PDF 导出额度、导出清晰度 |
| 推荐运营 | `AdminRecommendationSlotList`、`AdminRecommendationEditor` | `recommendation` | 首页、分类页、详情页、播放器结束页、生成入口的推荐绘本、故事、模板、画风、形象和声音 |
| 生成任务 | `AdminGenerationTaskList`、`GenerationResultInspector` | `generation_task`、`creation` | 查看故事、分镜、插图、音频、对口型任务状态、失败原因、重试记录和人工审核入口 |
| 审核举报 | `ModerationQueue`、`ReportDetail` | `moderation` | 审核故事、绘本、图片、声音、分享链接和导出内容；处理举报并记录结果 |
| 分享导出 | `AdminShareLinkList`、`AdminExportJobList` | `share`、`export` | 分享链接状态、访问范围、关闭/恢复/封禁、PDF 导出状态和隐私风险标记 |
| 统计分析 | `AdminAnalyticsDashboard` | `analytics` | 播放量、完播率、收藏量、分享量、创建类似作品次数、生成转化率、订阅转化来源和举报数量 |
| 审计日志 | `AuditLogTable`、`AuditLogDetail` | `audit` | 后台所有写操作、支付关键状态、敏感配置变更的操作者、原因、前后值和时间 |

### 前端公开入口

- `AdminShell`
- `AdminDashboard`
- `AdminContentOverview`
- `AdminActionButton`
- `AdminTargetSummary`
- `AdminResourceList`
- `AdminResourceEditor`
- `AdminStatusFilter`
- `AdminChangePreview`
- `AdminAuditTrail`

## 3. 后端设计

### 后端归属

- `admin`：后台聚合 API 和运营动作编排。
- 具体业务写操作归目标模块，例如故事发布归 `story`，绘本发布归 `book`，推荐配置归 `recommendation`，审核处理归 `moderation`。
- `admin` API 可以提供统一入口和聚合响应，但不得直接绕过目标模块 service 修改核心表。

### 后台聚合 API

- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/content/overview`
- `GET /api/v1/admin/generation-tasks`
- `GET /api/v1/admin/users/{user_id}/summary`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/analytics/operation-dashboard`

### 后台编排动作

- `POST /api/v1/admin/stories/{story_id}/publish`
- `POST /api/v1/admin/stories/{story_id}/unpublish`
- `POST /api/v1/admin/books/{book_id}/publish`
- `POST /api/v1/admin/books/{book_id}/unpublish`
- `POST /api/v1/admin/books/{book_id}/delete`
- `POST /api/v1/admin/templates/{template_id}/validate`
- `POST /api/v1/admin/share-links/{share_id}/ban`
- `POST /api/v1/admin/moderation/{record_id}/handle`

### 目标模块后台 API

后台页面优先调用目标模块提供的后台 API；`admin` 只负责统一导航、权限守卫、聚合和审计编排。

- `story`：系统故事/用户故事列表、编辑、删除、上下架、权益和审核状态。
- `book`：绘本、绘本页面、共读提示、学习卡片、试看页数、上下架和页面级媒体配置。
- `template`：模板基础信息、可替换角色、替换区域、声音规则、校验和替换预览。
- `asset`：系统画风、系统形象、系统声音的配置、排序、启停和权益状态。
- `taxonomy`：分类项的新增、编辑、排序、启停和 code 唯一性校验。
- `membership` / `entitlement`：套餐、权益规则、会员内容访问等级和额度规则。
- `recommendation`：推荐位、专题、推荐项排序、时间窗、目标内容选择。
- `generation_task`：生成任务查询、重试记录、结果引用和失败原因。
- `moderation`：审核队列、举报处理、隐藏/下架/驳回/通过。
- `share` / `export`：分享链接和导出任务的后台查询、关闭、恢复、封禁。
- `analytics`：运营指标查询。
- `audit`：审计日志查询。

### Service

- `get_admin_dashboard(filters) -> AdminDashboardRead`
- `get_content_overview(filters) -> AdminContentOverviewRead`
- `get_user_summary(user_id) -> AdminUserSummaryRead`
- `get_generation_task_overview(filters) -> Page[AdminGenerationTaskSummary]`
- `publish_story(operator, story_id, payload) -> StoryRead`
- `unpublish_story(operator, story_id, payload) -> StoryRead`
- `publish_book(operator, book_id, payload) -> BookRead`
- `unpublish_book(operator, book_id, payload) -> BookRead`
- `delete_book(operator, book_id, payload) -> BookRead`
- `validate_template(operator, template_id) -> TemplateValidationResult`
- `ban_share_link(operator, share_id, reason) -> ShareLinkRead`
- `handle_moderation(operator, record_id, payload) -> ModerationRecordRead`
- `write_admin_action(operator, action, target, before, after) -> AuditLogRead`

## 4. 数据库结构设计

### admin 数据库定义

admin 模块不拥有核心业务表。后台专属配置可按需落在目标模块，例如推荐配置在 `recommendation`，会员计划在 `membership`，审核在 `moderation`，审计在 `audit`。

## 5. 跨模块协作

- 调用各业务模块公开 service；写操作必须返回目标模块的正式 Read DTO。
- 所有后台写操作调用 `audit_service.write_audit_log()`。
- 后台页面复用各 `entities/*` 摘要组件。
- 后台列表统一使用 `target_type + target_id` 引用业务对象，避免跨模块传 ORM model。
- 敏感素材只展示审核所需摘要和脱敏预览，普通管理员不得读取用户原始隐私素材。

## 6. 边界规则

- 不绕过业务模块直接写核心数据。
- 不拥有故事、绘本、模板、素材、推荐、会员、支付等核心业务规则。
- 前端后台动作必须展示确认和原因输入，后端负责最终审计落库。
- 后台页面不得把故事纯文本资产和绘本可播放资产混为一个编辑器。
- 模板后台必须保留“锁定非头像/非声音内容”的校验入口，前台模板创作不得暴露画风、正文、背景和结构修改能力。
