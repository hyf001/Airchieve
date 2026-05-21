---
title: 账号与儿童档案
created: 2026-05-19
updated: 2026-05-20
type: entity
tags: [account, auth, child-profile, module-design]
sources: [raw/articles/module-design/account-profile.md]
---

# 账号与儿童档案 (auth / profile-management / account)

## 概述

管理用户身份、登录会话、认证绑定（手机号/微信）、短信验证码、真人风控验证和儿童档案。其他模块通过此模块获取登录状态和当前儿童档案上下文。

## 前端归属

- `features/auth`：登录注册、微信登录、手机号验证码登录、登录态恢复、账号绑定、退出登录、风险验证入口
- `features/profile-management`：儿童档案 CRUD、当前档案切换、默认角色形象/声音引用
- `entities/account`、`entities/child-profile`：账号摘要、档案摘要、档案选择器

## 后端归属

- `account_api.py`、`schema/account.py`、`service/account/*`、`model/account/*`

## 核心数据模型

| 模型 | 说明 |
| --- | --- |
| `users` | 用户基础信息 |
| `account_auth_identities` | 登录身份（手机号/微信） |
| `sms_verification_codes` | ���信验证码 |
| `account_risk_challenges` | 真人风控验证 |
| `account_sessions` | 登录会话 |
| `child_profiles` | 儿童档案（昵称、年龄段、兴趣标签、阅读水平） |

## 核心接口

- 认证：`register`、`sms-code`、`phone-login`、`wechat-login`、`refresh`、`logout`、`captcha/verify`
- 账号管理：`me`、`bindings`、`phone/bind|change|unbind`、`wechat/bind|change|unbind`
- 儿童档案：`child-profiles` CRUD
- 后台：`admin/accounts/users`

## 复用入口

- 前端：`AuthGuard`、`useCurrentUser`、`LoginEntry`、`ChildProfileSelector`、`useCurrentProfile`
- 后端：`get_current_user()`、`assert_phone_bound()`、`list_child_profiles()`

## 边界

- 不计算会员权益，不创建角色形象、声音、画风
- 儿童档案只保存默认素材引用，不拥有素材实体
- 阅读历史和收藏数据归 [[book-player-reading]]

## 完整来源

- 详细设计全文：`raw/articles/module-design/account-profile.md`
- 本页是模块索引与摘要；API、契约、Service、数据库字段、跨模块协作和边界规则以 raw 全文为准。

## 相关页面

- [[project-overview]] — 项目总览
- [[membership-payment]] — 会员权益判断
- [[asset-storage]] — 素材管理
