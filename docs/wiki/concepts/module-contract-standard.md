---
title: 模块契约标准
created: 2026-05-20
updated: 2026-05-20
type: concept
tags: [module-design, api, frontend, backend, database, collaboration]
sources: [raw/articles/module-design.md]
---

# 模块契约标准

## 用途

本页定义每个业务模块页面应呈现的信息结构。`entities/` 下的模块页是开发入口，`raw/articles/module-design/*.md` 是完整来源；模块页不需要复制所有字段，但必须让开发者快速判断职责、边界、依赖和契约。

## 模块页标准结构

| 区块 | 必填 | 说明 |
| --- | --- | --- |
| 概述 | 是 | 模块拥有的稳定业务能力和状态 |
| 不负责什么 | 是 | 明确禁止承接的职责，避免边界漂移 |
| 前端归属 | 是 | `pages/features/entities/shared` 中的公开入口和内部目录 |
| 后端归属 | 是 | `api/schema/service/model` 归属和公开 service |
| 数据所有权 | 是 | 本模块拥有的表、状态、事件；其他模块只能通过公开入口使用 |
| 对外 API | 是 | 前台 API、后台 API、内部 service / DTO |
| 依赖模块 | 是 | 同步依赖、异步事件依赖、只读依赖分别列出 |
| 被依赖方 | 是 | 哪些模块调用本模块公开能力 |
| 关键业务规则 | 是 | 权限、额度、状态流转、幂等、失败恢复 |
| 隐私/审计/统计 | 按需 | 涉及个人素材、儿童数据、后台操作或运营指标时必须写 |
| 完整来源 | 是 | 指向完整 raw 文件，作为无损细节来源 |

## 契约粒度

- 前端契约：页面入口、feature API、entity 组件、状态枚举、错误态和 loading 态。
- 后端契约：路由、schema、service 方法、DTO、错误码、幂等键和权限依赖。
- 数据契约：表归属、外键/引用方式、状态字段、软删字段、审计字段。
- 协作契约：owner、依赖方、阻塞点、mock 策略、是否允许异步事件解耦。

## 使用规则

- 新模块进入 wiki 时，先按本标准补齐模块页，再补 raw 来源。
- 修改跨模块字段时，同时更新模块页、raw 详细设计、前端类型和后端 schema。
- 如果模块页摘要与 raw 详细设计冲突，以 raw 为准，并在模块页标记需要同步。
- 模块页不得只写“见 raw”；至少要列出公开入口、数据所有权和边界规则。

## 相关页面

- [[architecture-and-layers]]
- [[module-dependency-matrix]]
- [[collaboration-groups]]
