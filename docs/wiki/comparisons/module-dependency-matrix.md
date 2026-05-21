---
title: 模块依赖矩阵
created: 2026-05-20
updated: 2026-05-20
type: comparison
tags: [module-design, collaboration, frontend, backend]
sources: [raw/articles/module-design.md]
---

# 模块依赖矩阵

## 用途

本页把模块边界从“说明文字”整理成依赖矩阵，用于评审实现方案、拆分 PR、判断跨组阻塞点。依赖方向遵循 [[architecture-and-layers]]，协作 owner 遵循 [[collaboration-groups]]。

## 分层模块地图

| 层级 | 模块 | 角色 |
| --- | --- | --- |
| 基础能力 | [[taxonomy]], [[account-profile]], [[asset-storage]] | 分类、身份、素材与存储基础设施 |
| 内容消费 | [[discovery-recommendation]], [[book-player-reading]], [[story-library]] | 找内容、看内容、管理纯文本故事 |
| 内容生产 | [[creation-generation]], [[template]] | 生成绘本、模板化复用、异步任务 |
| 商业与合规 | [[membership-payment]], [[share-export-privacy]], [[moderation-audit]] | 权益、支付、分享导出、隐私、审核审计 |
| 运营与数据 | [[admin]], [[analytics-domain-event]] | 后台聚合、运营动作、领域事件和统计 |

## 依赖矩阵

| 模块 | 主要依赖 | 被谁依赖 | 禁止跨界 |
| --- | --- | --- | --- |
| [[taxonomy]] | shared 基础设施 | 发现、故事库、创作、素材、档案、后台 | 不承接业务状态或推荐逻辑 |
| [[account-profile]] | taxonomy、asset 引用 | 全部登录态流程、推荐、创作、会员、分享 | 不计算权益，不拥有素材实体，不写阅读历史 |
| [[discovery-recommendation]] | book、reading、taxonomy、account-profile | 首页、详情页、相似创作、后台推荐位 | 不保存播放进度，不启动生成细节 |
| [[story-library]] | account-profile、taxonomy、creation-generation | 创作流程、后台故事管理 | 不进入播放器逻辑，不拥有绘本资产 |
| [[book-player-reading]] | book、reading、asset-storage、membership-payment | 首页继续阅读、详情、分享公开播放、统计 | 不判断会员规则细节，不生成内容 |
| [[template]] | book、asset-storage、membership-payment | creation-generation、admin | 模板创作不开放画风、正文、背景、结构修改 |
| [[asset-storage]] | storage、privacy、membership-payment | 创作、播放器、档案、分享、后台 | 不判断业务语义，不写生成或阅读状态 |
| [[creation-generation]] | story-library、template、asset-storage、membership-payment、account-profile | 首页创作入口、相似创作、后台任务 | 不复制素材库、播放器、会员逻辑 |
| [[membership-payment]] | account-profile、payment provider | 创作、模板、播放、导出、素材权限 | 其他模块不得自行判断 VIP/额度 |
| [[share-export-privacy]] | book-player-reading、asset-storage、membership-payment、privacy | 分享页、公开播放、后台封禁 | 不拥有绘本内容，不绕过隐私确认 |
| [[moderation-audit]] | account-profile、admin | 举报、后台动作、内容安全 | 审计日志不可变，业务模块不能直接改审计结果 |
| [[analytics-domain-event]] | domain_event、各模块事件 | admin、运营仪表盘 | 不阻塞主流程，不写业务状态 |
| [[admin]] | 所有目标模块公开后台 API/service | 运营人员 | 不绕过目标模块直接写核心数据 |

## 公共能力复用

| 公共能力 | Owner | 依赖方 |
| --- | --- | --- |
| 登录守卫、当前用户 | [[account-profile]] | 所有需要登录态的模块 |
| 当前儿童档案 | [[account-profile]] | 推荐、创作、播放器、档案页 |
| 权益判断、额度扣减 | [[membership-payment]] | 创作、导出、模板、素材、播放 |
| 分类配置 | [[taxonomy]] | 发现、故事库、档案、素材、后台 |
| 文件上传和 URL | [[asset-storage]] | 素材、创作、分享、后台 |
| 隐私确认 | [[share-export-privacy]] | 素材上传、声音、分享、导出 |
| 播放器 payload | [[book-player-reading]] | 播放页、分享公开播放 |
| 领域事件和统计 | [[analytics-domain-event]] | 所有需要非阻塞运营副作用的模块 |

## 评审检查

- 是否只依赖目标模块公开入口，而不是内部文件、内部表或内部状态？
- 写操作是否由目标模块 service 承接？
- 是否存在业务模块自行判断 VIP、额度、试看或素材权限？
- 是否存在创作流程复制素材、播放器或会员逻辑？
- 后台操作是否经过目标模块并写入 [[moderation-audit]]？
- 统计、AI provider、storage 是否保持非业务状态写入边界？

## 相关页面

- [[module-contract-standard]]
- [[product-requirements]]
- [[source-inventory]]
