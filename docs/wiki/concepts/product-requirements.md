---
title: 产品需求与用户故事
created: 2026-05-20
updated: 2026-05-20
type: concept
tags: [story, module-design, frontend]
sources: [raw/articles/picture-book-website-prd.md]
---

# 产品需求与用户故事

## 用途

本页组织 PRD 中的用户画像、15 个 User Stories 和验收标准归属。完整 PRD 原文已无损保存在 `raw/articles/picture-book-website-prd.md`；本页只做导航和模块映射，不删减原始验收标准。

## 用户画像

- 儿童读者：3-10 岁儿童，主要通过家长或老师引导使用，偏好语音播放、图文并茂、节奏清晰的阅读体验。
- 家长：希望孩子获得高质量绘本内容，也希望围绕孩子姓名、兴趣、成长问题、个人角色形象、家人声音或家庭场景创建专属绘本。
- 老师：需要围绕课程主题、节日活动、班级行为习惯或教学目标快速创建绘本，并在课堂中播放、共读或使用老师自己的声音讲述。
- 多孩家庭：需要为不同孩子保存独立年龄、兴趣、阅读偏好和专属绘本库。
- 内容管理员：负责绘本上架、故事管理、音频管理、会员内容配置、审核 AI 生成内容。
- 平台运营：关注内容消费、创建转化、订阅转化和内容安全。

## 用户故事索引

| 故事 | 标题 | 验收条目数 | 主 Owner | 协作模块 | 设计覆盖 |
| --- | --- | ---: | --- | --- | --- |
| Story 1 | 首页发现与快速开始 | 15 | [[discovery-recommendation]] | [[book-player-reading]], [[creation-generation]], [[story-library]], [[membership-payment]] | 模块设计 + raw PRD |
| Story 2 | 用户登录、注册与账号绑定 | 24 | [[account-profile]] | [[moderation-audit]], [[share-export-privacy]] | 模块设计 + raw PRD |
| Story 3 | 在线播放绘本 | 14 | [[book-player-reading]] | [[asset-storage]], [[membership-payment]], [[analytics-domain-event]] | 模块设计 + raw PRD |
| Story 4 | 亲子共读 | 5 | [[book-player-reading]] | [[admin]], [[analytics-domain-event]] | 模块设计 + raw PRD |
| Story 5 | 儿童档案与个性化 | 7 | [[account-profile]] | [[asset-storage]], [[discovery-recommendation]], [[creation-generation]] | 模块设计 + raw PRD |
| Story 6 | 绘本生成 | 41 | [[creation-generation]] | [[story-library]], [[template]], [[asset-storage]], [[membership-payment]], [[account-profile]] | 模块设计 + raw PRD |
| Story 7 | 故事库 | 13 | [[story-library]] | [[creation-generation]], [[taxonomy]], [[admin]] | 模块设计 + raw PRD |
| Story 8 | 基于绘本创建类似作品 | 6 | [[creation-generation]] | [[discovery-recommendation]], [[book-player-reading]] | 模块设计 + raw PRD |
| Story 9 | 画风管理 | 7 | [[asset-storage]] | [[creation-generation]], [[membership-payment]] | 模块设计 + raw PRD |
| Story 10 | 形象管理 | 10 | [[asset-storage]] | [[creation-generation]], [[account-profile]], [[share-export-privacy]] | 模块设计 + raw PRD |
| Story 11 | 我的声音管理 | 9 | [[asset-storage]] | [[book-player-reading]], [[share-export-privacy]], [[membership-payment]] | 模块设计 + raw PRD |
| Story 12 | 分享与导出 | 6 | [[share-export-privacy]] | [[book-player-reading]], [[membership-payment]], [[asset-storage]] | 模块设计 + raw PRD |
| Story 13 | 儿童安全与隐私 | 7 | [[share-export-privacy]] | [[moderation-audit]], [[account-profile]], [[asset-storage]] | 模块设计 + raw PRD |
| Story 14 | 绘本管理后台 | 32 | [[admin]] | [[moderation-audit]], [[analytics-domain-event]], [[story-library]], [[book-player-reading]], [[template]] | 模块设计 + raw PRD |
| Story 15 | 会员订阅 | 4 | [[membership-payment]] | [[creation-generation]], [[share-export-privacy]], [[asset-storage]] | 模块设计 + raw PRD |

## 需求追踪规则

- 主 Owner 负责拆解验收标准、定义对外契约、推动跨模块 mock。
- 协作模块只通过公开入口提供能力，不直接修改主 Owner 的内部状态。
- 验收标准全文不在本页重复维护，完整内容以 `raw/articles/picture-book-website-prd.md` 为准。
- Story 级需求变更必须同步检查 [[module-dependency-matrix]]，避免新增隐式依赖。

## 完整来源

- PRD 全文：`raw/articles/picture-book-website-prd.md`
- 与总体架构相关：[[project-overview]]、[[architecture-and-layers]]
- 与模块实现相关：[[source-inventory]]、[[frontend-prototypes]]、[[module-dependency-matrix]]
