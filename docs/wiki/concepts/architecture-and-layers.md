---
title: 分层架构与设计原则
created: 2026-05-19
updated: 2026-05-20
type: concept
tags: [architecture, module-design, frontend, backend]
sources: [raw/articles/module-design.md]
---

# 分层架构与设计原则

## 设计原则

- **高内聚**：一个模块拥有一类稳定业务能力、状态和写逻辑
- **低耦合**：跨模块通过公开组件、API、service、DTO 或领域事件协作
- **前后端一致**：前端 `features/entities` 映射到后端 `api/schema/service/model` 的同名或明确归属模块
- **可复用**：选择器、卡片、摘要 DTO、权限判断等公共能力沉淀到模块公开入口
- **可并行**：模块负责人只修改自己模块内部文件；跨模块改动先约定契约
- **儿童体验隔离**：儿童阅读主流程不得混入购买、充值、真人验证等家长操作

## 前端分层

```
frontend/src/
  app/          # 路由、Provider、全局初始化、全局布局
  pages/        # 路由页面，只做页面编排
  features/     # 业务流程、交互状态、模块 API 调用
  entities/     # 领域资源展示、摘要组件、选择器基础能力
  shared/       # 基础 UI、API client、通用 hooks、工具、主题
```

约束：`pages` 不写复杂业务逻辑；`features` 可依赖 `entities/shared`；`entities` 不依赖 `features/pages/app`；`shared` 不出现业务语义。

## 后端分层

```
backend/app/
  api/v1/       # 路由、请求校验、依赖注入、response model
  schema/       # Pydantic 请求、响应、跨模块 DTO
  service/      # 业务规则、状态流转、跨模块编排
  model/        # SQLAlchemy ORM 模型和表结构
  core/         # 配置、安全、日志、基础设施
  db/           # session、Base、数据库连接
```

约束：API 层不写复杂业务逻辑；跨模块写操作必须调用目标模块 service；跨模块传 id、summary DTO 或 internal DTO，不传 SQLAlchemy model。

## 依赖方向

前端：`app/pages -> features -> entities -> shared`
后端：`api -> service -> model`；`service -> other service public method / DTO / domain_event`

## 相关页面

- [[project-overview]] — 项目总览
- [[collaboration-groups]] — 多人协作分组
- [[module-dependency-matrix]] — 模块依赖矩阵
- [[module-contract-standard]] — 模块契约标准

## 完整来源

- 本页为组织入口；完整原文保存在 `docs/wiki/raw/` 对应来源文件中。
