---
title: 项目总览
created: 2026-05-19
updated: 2026-05-20
type: concept
tags: [module-design, architecture]
sources: [raw/articles/picture-book-website-prd.md, raw/articles/module-design.md]
---

# AIrchieve 绘本网站项目总览

AIrchieve 是一个面向儿童阅读的绘本 Web 平台，核心提供在线绘本播放阅读、音频朗读、亲子共读、会员订阅和绘本内容管理能力。平台同时提供绘本生成能力，支持家长和老师通过主题、已有故事或上传故事创建绘本，并选择角色形象和个人声音，生成可在线播放的定制化绘本。

## 核心领域定义

- **故事**：纯文本内容资产，只包含标题、正文、适龄范围、主题标签等文本元数据，不包含页面、插图、音频或播放结构。
- **绘本**：基于故事生成或由模板替换角色形象和朗读声音后得到的可播放内容资产，包含页面结构、插图、音频、对白、互动提示和学习卡片。
- **用户头像**：账号展示头像或原始参考图片，不直接作为绘本生成结果使用。
- **角色形象**：用于绘本生成和模板角色替换的视觉资产，由系统预置或 AI 生成；每个角色形象必须绑定画风。
- **绘本模板**：可复用的现成绘本加角色说明，用户使用时只能替换角色形象区域和朗读声音。

## 用户画像

- **儿童读者**：3-10 岁，偏好语音播放、图文并茂、节奏清晰的阅读体验
- **家长**：希望创建专属绘本，使用个人角色形象和家人声音
- **老师**：围绕课程主题快速创建绘本，课堂播放和共读
- **多孩家庭**：为不同孩子保存独立档案和专属绘本库
- **内容管理员**：绘本上架、故事管理、审核 AI 生成内容
- **平台运营**：内容消费、创建转化、订阅转化和内容安全

## 技术架构

- 前端：React + TypeScript + Vite，按 `app/pages/features/entities/shared` 分层
- 后端：FastAPI + SQLAlchemy + Alembic，按 `api/schema/service/model` 分层
- 前后端模块一一对应，同一业务能力在前端 `features/entities` 和后端 `api/schema/service/model` 保持一致归属

## 相关页面

- [[account-profile]] — 账号与儿童档案
- [[membership-payment]] — 会员权益与支付
- [[discovery-recommendation]] — 发现与推荐
- [[book-player-reading]] — 绘本播放与阅读
- [[creation-generation]] — 创作生成
- [[asset-storage]] — 素材库与存储

## 完整来源

- 本页为组织入口；完整原文保存在 `docs/wiki/raw/` 对应来源文件中。
