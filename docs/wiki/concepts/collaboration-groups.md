---
title: 多人协作分组
created: 2026-05-19
updated: 2026-05-20
type: concept
tags: [collaboration, architecture]
sources: [raw/articles/module-design.md]
---

# 多人协作分组

## 分组表

| 小组 | 负责模块 | 主要交付 |
| --- | --- | --- |
| A 组 | `app/shared/taxonomy` | 应用壳、路由、API client、基础 UI、分类选择器 |
| B 组 | `auth/account/profile-management` | 登录注册、账号绑定、儿童档案、当前档案上下文 |
| C 组 | `discovery/story-library/recommendation` | 首页、绘本详情、故事库、推荐位 |
| D 组 | `book-player/book/reading` | 播放器、播放器 payload、收藏、阅读进度 |
| E 组 | `creation/template/generation_task/ai_provider` | 创作向导、模板创作、生成任务、AI 适配 |
| F 组 | `asset/storage/privacy` | 角色形象、声音、画风、上传、隐私确认 |
| G 组 | `membership/entitlement/payment/share/export` | 权益、订阅支付、分享、导出 |
| H 组 | `admin/moderation/audit/analytics/domain_event` | 后台、审核、审计、统计、领域事件 |

## 协作流程

1. 模块 owner 先定义公开入口、DTO、状态枚举和错误码；跨模块 DTO 必须列出字段、类型、枚举值和关键校验规则
2. 依赖方只消费公开入口，不等待内部实现
3. 跨模块新增字段必须同时更新前端类型、后端 schema 和设计文档
4. 复杂流程先画清楚发起模块、目标模块、同步调用和异步事件
5. PR 以模块为边界提交；跨模块 PR 必须说明为什么不能拆开

## 并行开发路线

| 阶段 | 先定契约 | 可并行实现 | 主要阻塞点 |
| --- | --- | --- | --- |
| 0. 基础壳 | A 组 `app/shared/taxonomy`、B 组 auth/session | UI 基础组件、API client、路由、分类选择器 | 分类 DTO、登录态恢复、错误处理规范 |
| 1. 内容消费 | C 组 discovery/story，D 组 book-player/reading | 首页、详情页、故事库、播放器 UI | book summary、player payload、reading progress DTO |
| 2. 内容生产 | E 组 creation/template，F 组 asset/storage | 创作向导、模板选择、素材选择、上传 | entitlement check、asset ref、generation task status |
| 3. 商业合规 | G 组 membership/share/export，F 组 privacy | 会员页、分享弹窗、导出按钮、隐私确认 | 权益判断、额度扣减、个人素材风险标记 |
| 4. 运营数据 | H 组 admin/moderation/analytics | 后台壳、审核队列、统计仪表盘 | 目标模块后台 API、audit event、domain event |

## Mock 策略

| 能力 | Owner | 依赖方 mock 前提 |
| --- | --- | --- |
| 当前用户和儿童档案 | B 组 [[account-profile]] | 固定 user summary、profile summary、登录态切换 |
| 分类选项 | A 组 [[taxonomy]] | 固定 taxonomy group payload |
| 绘本摘要和播放 payload | D 组 [[book-player-reading]] | 固定 book summary、page/audio payload、试看状态 |
| 权益判断 | G 组 [[membership-payment]] | 固定 entitlement summary、额度不足错误码 |
| 素材引用 | F 组 [[asset-storage]] | 固定 character/voice/art-style ref |
| 生成任务 | E 组 [[creation-generation]] | 固定 queued/running/succeeded/failed 状态机 |
| 审计和统计事件 | H 组 [[moderation-audit]] / [[analytics-domain-event]] | fire-and-forget event stub |

## 跨组评审点

- 需求 owner 是否能在 [[product-requirements]] 中找到对应 Story？
- 模块依赖是否符合 [[module-dependency-matrix]]？
- 新增 DTO 是否同时落在前端类型、后端 schema 和 raw 详细设计？
- 后台写操作是否由目标模块承接并写入审计？
- 涉及儿童资料、个人声音、头像或参考图时，是否经过隐私确认链路？

## 相关页面

- [[project-overview]] — 项目总览
- [[architecture-and-layers]] — 分层架构与设计原则
- [[module-dependency-matrix]] — 模块依赖矩阵
- [[module-contract-standard]] — 模块契约标准

## 完整来源

- 本页为组织入口；完整原文保存在 `docs/wiki/raw/` 对应来源文件中。
