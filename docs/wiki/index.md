# Wiki Index

> AIrchieve 绘本网站项目知识库。每个模块页面包含前后端归属、数据模型、接口、边界和跨模块引用。
> Last updated: 2026-06-10 | Total pages: 23

## Start Here

- [项目总览](concepts/project-overview.md) — 绘本网站核心领域定义、用户画像和技术架构概览
- [分层架构与设计原则](concepts/architecture-and-layers.md) — 前后端分层约束、依赖方向和设计原则
- [模块契约标准](concepts/module-contract-standard.md) — 每个模块页必须呈现的职责、边界、契约和来源结构
- [模块依赖矩阵](comparisons/module-dependency-matrix.md) — 分层模块地图、依赖关系、公共能力 owner 和跨界检查
- [多人协作分组](concepts/collaboration-groups.md) — A-H 组模块分工和协作流程
- [产品需求与用户故事](concepts/product-requirements.md) — PRD 用户画像、15 个 User Stories 和验收标准归属索引
- [前端原型索引](concepts/frontend-prototypes.md) — `docs/frontend/*.html` 原型的无损 raw 来源和模块归属
- [Generation Task Execution](concepts/generation-task-execution.md) — 生成任务的 worker claim、handler 分发、事务、重试和 task 类型执行规则
- [Seedream Image Prompting](concepts/seedream-image-prompting.md) — 豆包/Seedream 图片生成提示词结构、参考图、多图输出和 AIrchieve 映射
- [Source Inventory](concepts/source-inventory.md) — wiki raw 层完整来源清单和无损使用原则

## Module Map

### 基础能力

- [分类配置](entities/taxonomy.md) — 集中分类系统：年龄段、主题、兴趣、教育目标等 (A 组)
- [账号与儿童档案](entities/account-profile.md) — 用户身份、登录会话、认证绑定、儿童档案 (B 组)
- [素材库与存储](entities/asset-storage.md) — 角色形象、声音、画风管理，文件上传和存储抽象 (F 组)

### 内容消费

- [发现、推荐与绘本详情](entities/discovery-recommendation.md) — 首页发现、搜索分类、推荐位、绘本详情 (C 组)
- [故事库](entities/story-library.md) — 纯文本故事资产管理，系统/用户故事 (C 组)
- [绘本内容、播放器与阅读状态](entities/book-player-reading.md) — 可播放内容资产、播放器 payload、收藏进度 (D 组)

### 内容生产

- [绘本模板](entities/template.md) — 可复用模板、角色替换区域、声音替换规则 (E 组)
- [创作生成与异步任务](entities/creation-generation.md) — 创作向导、分镜编辑、AI 生成任务、供应商适配 (E 组)

### 商业与合规

- [会员、权益与支付](entities/membership-payment.md) — 订阅计划、权益校验、额度扣减、支付订单 (G 组)
- [分享、导出与隐私](entities/share-export-privacy.md) — 分享链接、PDF 导出、上传授权和隐私确认 (G 组)
- [审核、举报与审计](entities/moderation-audit.md) — 内容举报、审核队列、不可变审计日志 (H 组)

### 运营与数据

- [数据事件与统计](entities/analytics-domain-event.md) — 领域事件、业务指标聚合、运营仪表盘 (H 组)
- [后台运营](entities/admin.md) — 后台应用壳、仪表盘、运营动作编排 (H 组)

## Raw Sources

- [Source Inventory](concepts/source-inventory.md) — 无损来源清单；详细 API、契约、数据库字段和 HTML 原型以 raw 层为准
