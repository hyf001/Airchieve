# 绘本网站模块设计

本文基于 [picture-book-website-prd.md](../picture-book-website-prd.md) 和 [`docs/frontend/*.html`](../frontend/) 原型，统一描述前端与后端的模块划分、职责边界、复用方式和多人协作约定。

目标不是按技术目录拆任务，而是让同一个业务模块在前端、后端、接口契约和数据边界上保持一致，避免重复实现、跨层直连和业务规则漂移。

模块总览以本文为准。每个统一模块的详细设计放在 `docs/module-design/*.md`，每份详细设计都同时维护前端归属、前端公开入口、后端接口、Service、数据模型和前后端协作边界。

## 1. 设计原则

- 高内聚：一个模块拥有一类稳定业务能力、状态和写逻辑。
- 低耦合：跨模块通过公开组件、API、service、DTO 或领域事件协作，不依赖对方内部实现。
- 前后端一致：前端 `features/entities` 的业务模块必须能映射到后端 `api/schema/service/model` 的同名或明确归属模块。
- 可复用：选择器、卡片、摘要 DTO、权限判断、上传确认、播放器 payload 等公共能力必须沉淀到模块公开入口，不在页面复制。
- 可并行：模块负责人只修改自己模块内部文件；跨模块改动必须先约定契约，再分别落地。
- 儿童体验隔离：儿童阅读主流程不得混入购买、充值、真人验证等家长操作。
- 领域边界稳定：故事是纯文本资产；绘本是可播放内容资产；绘本模板是基于现有绘本的角色替换配置。

## 2. 统一分层

### 2.1 前端分层

```text
frontend/src/
  app/          # 路由、Provider、全局初始化、全局布局
  pages/        # 路由页面，只做页面编排
  features/     # 业务流程、交互状态、模块 API 调用
  entities/     # 领域资源展示、摘要组件、选择器基础能力
  shared/       # 基础 UI、API client、通用 hooks、工具、主题
```

约束：

- `pages` 不写复杂业务逻辑，不直接拼接底层 API。
- `features` 可以依赖 `entities/shared`，同级 `features` 之间尽量通过公开入口协作。
- `entities` 不依赖 `features/pages/app`。
- `shared` 不出现具体业务语义。

### 2.2 后端分层

```text
backend/app/
  api/v1/       # 路由、请求校验、依赖注入、response model
  schema/       # Pydantic 请求、响应、跨模块 DTO
  service/      # 业务规则、状态流转、跨模块编排
  model/        # SQLAlchemy ORM 模型和表结构
  core/         # 配置、安全、日志、基础设施
  db/           # session、Base、数据库连接
```

约束：

- API 层不写复杂业务逻辑，不直接修改 ORM。
- 跨模块写操作必须调用目标模块 service。
- 跨模块传递 id、summary DTO 或 internal DTO，不传 SQLAlchemy model。
- 会员、额度、访问权限统一由 `entitlement` 判断。
- 非阻塞副作用优先通过 `domain_event` 交给订阅方消费。
- 数据库表内部主键和外键统一使用 `int`；第三方平台标识、渠道订单号、设备号、请求号、token hash 等外部标识仍使用 `string`。

## 3. 页面与需求到模块映射

| PRD 需求 | 原型 | React 页面 | 主模块 | 复用模块 |
| --- | --- | --- | --- | --- |
| Story 1 首页发现与快速开始 | `index.html` | `pages/home` | `discovery` | `profile-management`, `membership`, `creation`, `story-library`, `asset` |
| Story 2 用户登录、注册与账号绑定 | `auth.html` | `pages/auth` | `auth` | `privacy` |
| Story 3 在线播放绘本 / Story 4 亲子共读 | `player.html` | `pages/player` | `book-player` | `voice-library`, `reading`, `membership`, `moderation` |
| Story 5 儿童档案与个性化 | `profile.html` | `pages/profiles` | `profile-management` | `character-library`, `voice-library`, `art-style-library`, `reading` |
| Story 6 绘本生成 / Story 8 基于绘本创建类似作品 | `create.html`, `book-detail.html`, `player.html` | `pages/create`, `pages/book-detail`, `pages/player` | `creation` | `discovery`, `story-library`, `profile-management`, `asset`, `membership`, `privacy`, `book-player` |
| Story 7 故事库 | `stories.html` | `pages/stories` | `story-library` | `creation`, `membership`, `privacy` |
| Story 9 画风管理 | `artstyle.html` | `pages/art-styles` | `art-style-library` | `membership` |
| Story 10 形象管理 | `characters.html` | `pages/characters` | `character-library` | `membership`, `privacy` |
| Story 11 我的声音管理 | `voices.html` | `pages/voices` | `voice-library` | `membership`, `privacy` |
| Story 12 分享与导出 | `share.html` | `pages/share` | `share` | `export`, `book-player`, `membership`, `privacy` |
| Story 13 儿童安全与隐私 | 多页面承载 | `pages/auth`, `pages/player`, `pages/share`, `pages/create` | `privacy`, `moderation` | `auth`, `book-player`, `asset`, `share`, `export` |
| Story 14 绘本管理后台 | 暂无独立 HTML 原型 | `pages/admin/*` | `admin` | `moderation`, `audit`, `analytics`, 各业务模块 |
| Story 15 会员订阅 | `membership.html` | `pages/membership` | `membership` | `auth`, `payment`, `entitlement` |

## 4. 模块设计

### 4.1 账号与儿童档案 `auth / profile-management / account`

详细设计：[account-profile.md](account-profile.md)

前端归属：

- `features/auth`：登录注册、微信登录、手机号验证码登录、登录态恢复、账号绑定、退出登录、风险验证入口。
- `features/profile-management`：儿童档案 CRUD、当前档案切换、默认形象/声音/画风引用、档案阅读历史和收藏入口。
- `entities/account`、`entities/child-profile`：账号摘要、档案摘要、档案选择器。

后端归属：

- `account_api.py`、`schema/account.py`、`service/account/*`、`model/account/*`。
- 管用户、登录身份、会话、短信验证码、风控票据、儿童档案。

复用入口：

- 前端导出 `AuthGuard`、`useCurrentUser`、`LoginEntry`、`ChildProfileSelector`、`useCurrentProfile`。
- 后端提供 `get_current_user()`、`assert_phone_bound()`、`list_child_profiles()`、`assert_profile_belongs_to_user()`。

边界：

- 不计算会员权益，不创建形象、声音、画风。
- 儿童档案只保存默认素材引用，不拥有素材实体。
- 阅读历史和收藏数据归 `reading`，档案页只展示聚合结果。

协作建议：

- 账号登录、档案管理可由两组并行开发，通过 `UserRead`、`ChildProfileRead`、`AuthTokenRead` 契约对齐。

### 4.2 会员、权益与支付 `membership / entitlement / payment`

详细设计：[membership-payment.md](membership-payment.md)

前端归属：

- `features/membership`：套餐展示、权益对比、当前权益摘要、升级提示、试看和额度限制提示。
- `entities/membership`：计划卡片、权益 badge、访问状态组件。

后端归属：

- `membership`：会员计划、订阅状态、权益配置。
- `entitlement`：统一权益校验和额度扣减。
- `payment`：订单、支付流水、支付渠道回调、退款、订阅账单。

复用入口：

- 前端导出 `useEntitlements`、`EntitlementGate`、`AccessBadge`、`UpgradePrompt`。
- 后端提供 `get_user_entitlements()`、`can_access_book()`、`can_use_asset()`、`assert_can_create()`、`consume_quota()`、`create_membership_order()`。

边界：

- 其他模块不得自行判断 VIP、试看页数、次数限制或数量上限。
- `payment` 不判断内容访问权限，只把支付结果转换为订阅变更。
- 会员页可以展示支付入口，但支付渠道细节不泄漏到素材、创作、播放器模块。

协作建议：

- 先稳定 `EntitlementSummary` 和 `AccessDecision`，其他模块只消费结果。

### 4.3 发现、推荐与绘本详情 `discovery / recommendation`

详细设计：[discovery-recommendation.md](discovery-recommendation.md)

前端归属：

- `features/discovery`：首页推荐、搜索入口、分类浏览、继续阅读入口、绘本详情主体、相关绘本、创建类似作品入口。
- `entities/book`：绘本卡片、绘本摘要、标签、免费/VIP 状态。

后端归属：

- `book` 提供绘本列表和详情。
- `recommendation` 提供首页、详情页、播放器结束页、创作入口等推荐位。
- `taxonomy` 提供筛选条件。

复用入口：

- 前端导出 `BookCard`、`BookGrid`、`RecommendationSlot`、`BookDetailPanel`。
- 后端提供 `list_books()`、`get_book_detail()`、`list_recommendations()`、`get_recommendation_slot()`。

边界：

- 不实现播放器控制，不保存阅读进度。
- 不执行生成流程，只跳转或创建创作会话。
- 推荐模块只保存推荐关系和展示规则，不拥有被推荐内容。

协作建议：

- 首页、详情页和推荐后台可并行；统一使用 `BookSummary`、`RecommendationSlotRead`。

### 4.4 分类配置 `taxonomy`

详细设计：[taxonomy.md](taxonomy.md)

前端归属：

- `entities/taxonomy`：年龄段、主题、兴趣标签、教育目标、阅读水平、语言、叙事风格、场景等选择器。
- 被首页筛选、故事库、创作流程、素材库、档案管理复用。

后端归属：

- `taxonomy_api.py`、`schema/taxonomy.py`、`service/taxonomy_service.py`、`model/taxonomy.py`。

复用入口：

- 前端导出 `TaxonomySelect`、`TaxonomyMultiSelect`、`useTaxonomyGroup`。
- 后端提供 `list_taxonomy()`、`validate_taxonomy_ids()`、`upsert_taxonomy_item()`。

边界：

- 不依赖故事、绘本、素材、会员。
- 分类项用稳定 `code` 和展示名称，不在业务模块散落字符串常量。

协作建议：

- 所有需要筛选、标签或配置枚举的模块先接入 taxonomy，避免各自维护下拉项。

### 4.5 故事库 `story-library / story`

详细设计：[story-library.md](story-library.md)

前端归属：

- `features/story-library`：我的故事、系统故事、故事详情、创建/编辑/删除/上传/粘贴故事、从故事发起生成。
- `entities/story`：故事卡片、故事摘要、故事选择器。

后端归属：

- `story_api.py`、`schema/story.py`、`service/story_service.py`、`model/story.py`。

复用入口：

- 前端导出 `StorySelector`、`StoryCard`、`StoryEditor`。
- 后端提供 `get_story()`、`list_stories()`、`create_user_story()`、`update_user_story()`、`assert_story_usable()`、`list_generated_books()`。

边界：

- 故事只保存纯文本和文本元数据，不包含页面、插图、视频、音频、对白、播放器结构。
- 故事不是模板；复用完整绘本并替换角色的能力归 `template`。
- 上传或粘贴故事必须走 `privacy` 授权确认。

协作建议：

- 故事编辑器、故事列表、后端 CRUD 可并行，接口以 `StoryRead`、`StorySummary`、`StoryInternalDTO` 对齐。

### 4.6 绘本内容、播放器与阅读状态 `book-player / book / reading`

详细设计：[book-player-reading.md](book-player-reading.md)

前端归属：

- `features/book-player`：播放、暂停、翻页、进度条、语言切换、语速、音效、背景音乐、声音切换、共读提示、学习卡片、试看裁剪、举报入口。
- `features/reading`：继续阅读、收藏、阅读进度、播放事件上报。
- `entities/book`：播放器页面结构、学习卡片、共读提示展示组件。

后端归属：

- `book`：绘本详情、页面、媒体、双语文本、音频、对白、对口型素材、共读提示、学习卡片、播放器 payload。
- `reading`：收藏、阅读进度、阅读历史、继续阅读、播放事件。
- `moderation`：举报入口的后端归属。

复用入口：

- 前端导出 `BookPlayer`、`ReadonlyBookPlayer`、`VoiceSwitcher`、`ReadingProgressProvider`、`FavoriteButton`。
- 后端提供 `get_book_detail()`、`get_player_payload()`、`save_reading_progress()`、`list_recent_reads()`、`toggle_favorite()`、`record_play_event()`。

边界：

- `book_player_service` 是 `book` 内部服务，不是独立业务模块。
- 播放器不负责声音上传、会员套餐页、分享链接管理。
- `reading` 不修改绘本正文、页面、音频和媒体。
- 儿童播放主流程不展示商业购买入口。

协作建议：

- 播放器 UI、播放器 payload、阅读状态可三组并行；先冻结 `BookPlayerPayload`。

### 4.7 绘本模板 `template`

详细设计：[template.md](template.md)

前端归属：

- `features/creation` 内的模板创作路径。
- `entities/template`：模板卡片、模板详情、可替换角色列表、区域预览。

后端归属：

- `template_api.py`、`schema/template.py`、`service/template_service.py`、`model/template.py`。

复用入口：

- 前端导出 `TemplateSelector`、`TemplateReplacementForm`、`TemplatePreview`。
- 后端提供 `list_templates()`、`get_template()`、`validate_template_replacements()`、`preview_template_replacement()`、`create_book_from_template()`。

边界：

- 模板不维护独立页面内容，页面结构来自原绘本。
- 基于模板创作只能替换已标注角色头像/形象区域和朗读声音。
- 不允许更换画风、背景、页面构图、正文、音效、互动提示、学习卡片和播放节奏。
- 头像合成、音频重生成通过 `generation_task`。

协作建议：

- 模板后台标注和前台模板创作可并行；共同依赖 `TemplateRead`、`TemplateCharacterRead`、`TemplateRegionRead`。

### 4.8 素材库与存储 `character-library / voice-library / art-style-library / asset / storage`

详细设计：[asset-storage.md](asset-storage.md)

前端归属：

- `features/character-library`：我的形象、系统形象、创建形象、上传参考图、重命名、删除、设为默认、形象选择器。
- `features/voice-library`：我的声音、系统声音、上传声音、处理状态、试听、删除、设为默认、声音选择器。
- `features/art-style-library`：系统画风、自定义画风描述、画风对比、画风选择器。
- `entities/asset`：素材卡片、上传入口、素材选择器基础组件。

后端归属：

- `asset`：形象、画风、声音、媒体资产引用和素材状态。
- `storage`：上传会话、文件访问 URL、存储 provider 差异。
- `privacy`：上传授权和个人素材隐私确认。

复用入口：

- 前端导出 `CharacterSelector`、`VoiceSelector`、`ArtStyleSelector`、`AssetUploadField`。
- 后端提供 `list_characters()`、`get_character()`、`list_voices()`、`get_voice()`、`list_art_styles()`、`get_art_style()`、`assert_asset_usable()`、`create_upload_session()`、`complete_upload()`。

边界：

- 素材库不编排绘本生成流程，只提供选择和管理能力。
- 画风是独立资源，不属于形象必填属性。
- 删除形象或声音不删除历史绘本中的已生成图片或音频。
- `storage` 不理解业务语义，不判断会员权益，不记录授权。

协作建议：

- 形象、声音、画风可三组并行，但共用 `AssetSummary`、上传会话和权益展示组件。

### 4.9 创作生成与异步任务 `creation / generation_task / ai_provider`

详细设计：[creation-generation.md](creation-generation.md)

前端归属：

- `features/creation`：创建向导、故事路径、模板路径、儿童档案选择、素材选择、画风选择、分镜编辑、生成任务状态、失败重试、局部重生成、播放预览、保存个人绘本。
- `entities/generation-task`：任务进度、失败原因、重试控件。

后端归属：

- `creation`：创作会话、步骤状态、草稿配置、分镜、保存绘本。
- `generation_task`：异步任务生命周期、进度、失败、重试、结果引用。
- `ai_provider`：外部模型适配、供应商路由、错误映射、用量记录。

复用入口：

- 前端导出 `CreationWizard`、`StoryboardEditor`、`GenerationTaskStatus`、`CreationPreviewPlayer`。
- 后端提供 `create_session()`、`update_session_config()`、`generate_story()`、`generate_storyboard()`、`generate_images()`、`generate_audio()`、`regenerate()`、`save_book()`、`create_task()`、`retry_task()`。

边界：

- 基于故事生成可以选择画风、编辑分镜、局部重生成。
- 基于模板创作不走普通画风/分镜编辑能力。
- `creation` 不做素材 CRUD，不直接调用供应商 SDK。
- `generation_task` 不做权益判断，不决定结果归属。
- 创建类似作品只复用主题、适龄、长度、画风等参考信息，不复制原文和图片。

协作建议：

- 向导 UI、创作 session、任务系统、AI provider 适配可并行；通过 `CreationSessionRead` 和 `GenerationTaskRead` 连接。

### 4.10 分享、导出与隐私 `share / export / privacy`

详细设计：[share-export-privacy.md](share-export-privacy.md)

前端归属：

- `features/share`：分享链接、复制、二维码、访问范围、关闭/恢复/重新生成、分享记录、分享隐私确认。
- `features/export`：PDF 导出、导出状态、下载入口、导出记录。
- `features/privacy`：上传授权、分享/导出隐私确认、风险提示弹窗。

后端归属：

- `share`：分享链接、访问范围、分享页只读播放器数据、访问日志。
- `export`：PDF 导出任务、导出文件、导出状态。
- `privacy`：上传授权、个人素材默认私密策略、分享/导出风险确认。

复用入口：

- 前端导出 `ShareDialog`、`ShareLinkList`、`ExportButton`、`PrivacyConfirmDialog`。
- 后端提供 `create_share_link()`、`get_shared_player_payload()`、`close_share_link()`、`create_export_job()`、`get_export_file_url()`、`record_upload_consent()`、`record_privacy_confirmation()`、`get_privacy_flags()`。

边界：

- 分享复用只读播放器，不编辑绘本内容。
- 导出不管理分享链接。
- 隐私模块不上传文件、不审核内容、不修改业务对象。
- 含个人形象或个人声音的分享/导出必须先记录隐私确认。

协作建议：

- 分享页、导出任务、隐私确认弹窗可并行；统一依赖 `PrivacyFlagsRead`。

### 4.11 审核、举报与审计 `moderation / audit`

详细设计：[moderation-audit.md](moderation-audit.md)

前端归属：

- `features/moderation`：播放器举报入口、举报表单、后台审核处理页面。
- `entities/audit`：后台审计日志列表和详情展示。

后端归属：

- `moderation`：内容审核、用户举报、处理状态。
- `audit`：后台写操作、支付关键状态、敏感配置变更日志。

复用入口：

- 前端导出 `ReportContentDialog`、`ModerationQueue`、`AuditLogTable`。
- 后端提供 `create_report()`、`list_moderation_records()`、`handle_moderation_record()`、`write_audit_log()`、`list_audit_logs()`。

边界：

- 审核不替代隐私确认。
- 审计只记录事实，不执行目标业务动作。
- 后台写操作必须调用对应业务模块 service，再写入审计日志。

协作建议：

- 前台举报、后台审核、审计查询可分开开发，统一目标引用格式 `target_type + target_id`。

### 4.12 数据事件与统计 `analytics / domain_event`

详细设计：[analytics-domain-event.md](analytics-domain-event.md)

前端归属：

- `shared/analytics`：前端行为埋点封装。
- 后台统计页面由 `features/admin` 或 `features/analytics` 展示。

后端归属：

- `domain_event`：领域事件发布、持久化、投递状态和失败重试。
- `analytics`：业务事件记录、统计聚合、运营数据查询。

复用入口：

- 前端导出 `trackClientEvent()`。
- 后端提供 `publish_event()`、`list_pending_events()`、`track_event()`、`get_book_metrics()`、`get_creation_funnel_metrics()`、`get_operation_dashboard()`。

边界：

- `domain_event` 不替代同步 service 调用。
- `analytics` 不修改业务对象状态，不判断会员权益。
- 播放量、完播率、生成转化、订阅来源等统计口径集中在 analytics。

协作建议：

- 业务模块只发布事件，统计模块异步消费；新增事件必须先登记事件名、目标类型和 payload schema。

### 4.13 后台运营 `admin`

详细设计：[admin.md](admin.md)

前端归属：

- `features/admin`：后台首页、内容概览、用户摘要、系统故事/绘本/模板/素材/分类/会员/推荐/审核/生成任务入口。

后端归属：

- `admin` 只做后台聚合和运营动作编排。
- 具体写操作仍归目标模块，如故事发布归 `story`，绘本发布归 `book`，推荐配置归 `recommendation`。

复用入口：

- 前端导出 `AdminShell`、`AdminDashboard`、`AdminContentOverview`。
- 后端提供 `get_admin_dashboard()`、`get_content_overview()`、`publish_story()`、`publish_book()`、`ban_share_link()`、`handle_moderation()`。

边界：

- 后台不绕过业务模块直接写核心数据。
- 所有后台写操作必须写入 `audit`。
- 后台页面复用前台已有实体摘要组件时，只能依赖公开入口。

协作建议：

- 后台壳、各业务后台页和后台聚合 API 可并行；后台动作必须明确目标模块 owner。

## 5. 跨模块依赖规则

### 5.1 推荐依赖方向

```text
app/pages
  -> features
    -> entities
      -> shared
```

后端依赖：

```text
api -> service -> model
service -> other service public method / DTO / domain_event
```

### 5.2 必须复用的公共能力

- 登录守卫：`auth`。
- 当前儿童档案：`profile-management/account`。
- 权益判断：`membership/entitlement`。
- 分类配置：`taxonomy`。
- 文件上传和 URL：`asset/storage`。
- 上传、分享、导出隐私确认：`privacy`。
- 绘本播放 payload：`book`。
- 阅读进度和收藏：`reading`。
- 生成任务状态：`generation_task`。
- 非阻塞统计和运营副作用：`domain_event/analytics`。

### 5.3 禁止跨界

- 页面组件直接拼接业务 API。
- 前端模块深层引用其他模块内部文件。
- 后端 API 直接写 ORM 或跨模块直接改表。
- 业务模块自行判断 VIP、额度、试看、素材权限。
- 创作流程复制素材库、播放器、会员逻辑。
- 模板创作开放画风、正文、背景、结构修改。
- 故事进入播放器逻辑。
- `storage`、`ai_provider`、`analytics` 写业务状态。

## 6. 多人协作拆分

| 小组 | 负责模块 | 主要交付 |
| --- | --- | --- |
| A 组 | `app/shared/taxonomy` | 应用壳、路由、API client、基础 UI、分类选择器 |
| B 组 | `auth/account/profile-management` | 登录注册、账号绑定、儿童档案、当前档案上下文 |
| C 组 | `discovery/story-library/recommendation` | 首页、绘本详情、故事库、推荐位 |
| D 组 | `book-player/book/reading` | 播放器、播放器 payload、收藏、阅读进度 |
| E 组 | `creation/template/generation_task/ai_provider` | 创作向导、模板创作、生成任务、AI 适配 |
| F 组 | `asset/storage/privacy` | 形象、声音、画风、上传、隐私确认 |
| G 组 | `membership/entitlement/payment/share/export` | 权益、订阅支付、分享、导出 |
| H 组 | `admin/moderation/audit/analytics/domain_event` | 后台、审核、审计、统计、领域事件 |

协作流程：

1. 模块 owner 先定义公开入口、DTO、状态枚举和错误码；跨模块 DTO 必须列出字段、类型、枚举值和关键校验规则。
2. 依赖方只消费公开入口，不等待内部实现。
3. 跨模块新增字段必须同时更新前端类型、后端 schema 和本文档。
4. 复杂流程先画清楚发起模块、目标模块、同步调用和异步事件。
5. PR 以模块为边界提交；跨模块 PR 必须说明为什么不能拆开。

## 7. 命名对照

| 业务能力 | 前端模块 | 后端模块 |
| --- | --- | --- |
| 登录注册 | `features/auth` | `account` |
| 儿童档案 | `features/profile-management` | `account` |
| 会员权益 | `features/membership` | `membership`, `entitlement` |
| 支付订阅 | `features/membership` | `payment` |
| 首页发现 | `features/discovery` | `book`, `recommendation`, `reading` |
| 故事库 | `features/story-library` | `story` |
| 绘本详情 | `features/discovery` | `book` |
| 播放器 | `features/book-player` | `book`, `reading` |
| 绘本模板 | `features/creation`, `entities/template` | `template` |
| 创作生成 | `features/creation` | `creation`, `generation_task`, `ai_provider` |
| 形象库 | `features/character-library` | `asset` |
| 声音库 | `features/voice-library` | `asset` |
| 画风库 | `features/art-style-library` | `asset` |
| 分享 | `features/share` | `share` |
| 导出 | `features/export` | `export` |
| 隐私授权 | `features/privacy` | `privacy` |
| 分类配置 | `entities/taxonomy` | `taxonomy` |
| 审核举报 | `features/moderation` | `moderation` |
| 后台运营 | `features/admin` | `admin` |
| 统计分析 | `features/analytics` | `analytics`, `domain_event` |
