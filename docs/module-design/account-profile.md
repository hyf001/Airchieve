# 账号与儿童档案详细设计

对应总览：`docs/module-design/module-design.md` 4.1 `auth / profile-management / account`

总设计文档：[module-design.md](module-design.md)

前端原型：[auth.html](../frontend/auth.html)、[profile.html](../frontend/profile.html)

产品需求：[picture-book-website-prd.md](../picture-book-website-prd.md) 的 Story 2 用户登录、注册与账号绑定，Story 5 儿童档案与个性化，Story 13 儿童安全与隐私。

## 1. 模块目标

统一管理账号身份、登录态、账号绑定、风险验证和儿童档案。前端当前分为账号登录注册能力和儿童档案管理能力；后端由 `account` 模块统一拥有账号与档案数据。

## 2. 前端设计

### 页面

- `pages/auth`：用户名密码登录、手机号短信注册、微信扫码登录占位展示。
- `pages/profiles`：儿童档案列表、创建、编辑、默认档案、档案相关素材入口。

### 功能模块

- `features/auth`
  - 用户名密码登录。
  - 手机号短信验证码注册。
  - 微信扫码登录区域仅做入口占位展示，当前不接入微信登录接口。
  - 退出登录。
  - 注册发送短信前提供本地滑块验证交互。
  - 手机号验证码登录、登录成功后恢复 `return_to`、登录方式展示、手机号绑定/换绑/解绑、微信绑定/换绑/解绑、真人验证服务端票据和风险操作二次确认作为后续能力，不属于当前前端实现范围。
- `features/profile-management`
  - 儿童档案创建、编辑、软删除、设为默认。
  - 当前儿童档案初始化和切换。
  - 档案默认角色形象、默认声音引用。
  - 档案维度阅读历史、收藏和个人绘本库入口。

### 领域组件

- `entities/account`：`CurrentUserSummary`、`AuthBindingList`、`AccountStatusBadge`。
- `entities/child-profile`：`ChildProfileCard`、`ChildProfileSelector`、`ChildProfileForm`。

### 前端公开入口

- `AuthGuard`
- `LoginEntry`
- `useCurrentUser()`
- `useAuthBindings()`
- `ChildProfileSelector`
- `useCurrentProfile()`
- `useChildProfiles()`

## 3. 后端设计

### 后端归属

- API：`account_api.py`
- Schema：`schema/account.py`
- Service：`service/account/*`
- Model：`model/account/*`

### 前台 API

- `POST /api/v1/account/auth/register`
- `POST /api/v1/account/auth/sms-code`
- `POST /api/v1/account/auth/phone-login`
- `POST /api/v1/account/auth/wechat-login`
- `POST /api/v1/account/auth/refresh`
- `POST /api/v1/account/auth/logout`
- `POST /api/v1/account/auth/captcha/verify`
- `GET /api/v1/account/me`
- `GET /api/v1/account/bindings`
- `POST /api/v1/account/phone/bind`
- `POST /api/v1/account/phone/change`
- `DELETE /api/v1/account/phone`
- `POST /api/v1/account/wechat/bind`
- `POST /api/v1/account/wechat/change`
- `DELETE /api/v1/account/wechat`
- `GET /api/v1/account/child-profiles`
- `POST /api/v1/account/child-profiles`
- `GET /api/v1/account/child-profiles/{profile_id}`
- `PATCH /api/v1/account/child-profiles/{profile_id}`
- `DELETE /api/v1/account/child-profiles/{profile_id}`
- `POST /api/v1/account/child-profiles/{profile_id}/default`

### 后台 API

- `GET /api/v1/admin/accounts/users`
- `GET /api/v1/admin/accounts/users/{user_id}`
- `PATCH /api/v1/admin/accounts/users/{user_id}/status`

### Service

- `register_with_phone(payload) -> AuthTokenRead`
- `send_sms_code(phone, scene, user_id=None) -> SmsCodeSendResult`
- `login_with_phone(phone, code) -> AuthTokenRead`
- `login_with_wechat(payload) -> AuthTokenRead`
- `refresh_session(refresh_token) -> AuthTokenRead`
- `logout(session_id) -> None`
- `verify_captcha(payload) -> CaptchaVerifyResult`
- `bind_phone(user_id, phone, code) -> UserRead`
- `change_phone(user_id, old_phone_code, new_phone, new_phone_code) -> UserRead`
- `unbind_phone(user_id, code) -> UserRead`
- `bind_wechat(user_id, payload) -> UserRead`
- `change_wechat(user_id, payload) -> UserRead`
- `unbind_wechat(user_id, identity_id) -> UserRead`
- `list_auth_bindings(user_id) -> list[AuthBindingSummary]`
- `assert_login_method_remains(user_id, excluding_identity_id=None) -> None`
- `assert_phone_bound(user_id) -> None`
- `assert_risk_challenge_passed(user_id, action, ticket) -> None`
- `get_current_user(user_id) -> UserRead`
- `list_child_profiles(user_id) -> list[ChildProfileRead]`
- `create_child_profile(user_id, payload) -> ChildProfileRead`
- `update_child_profile(user_id, profile_id, payload) -> ChildProfileRead`
- `delete_child_profile(user_id, profile_id) -> None`
- `set_default_child_profile(user_id, profile_id) -> ChildProfileRead`
- `assert_profile_belongs_to_user(profile_id, user_id) -> None`

## 4. 数据库结构设计

### account 数据库定义

#### users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 用户 ID |
| email | string nullable unique | 邮箱 |
| phone | string nullable unique | 手机号 |
| phone_verified_at | datetime nullable | 手机号验证时间 |
| display_name | string | 展示名 |
| avatar_asset_id | int nullable | 头像文件引用 |
| role | enum(`parent`,`teacher`,`admin`) | 基础角色 |
| status | enum(`active`,`disabled`) | 账号状态 |
| default_child_profile_id | int nullable | 默认儿童档案 |
| terms_accepted_at | datetime nullable | 用户协议同意时间 |
| privacy_accepted_at | datetime nullable | 隐私政策同意时间 |
| terms_version | string nullable | 已同意用户协议版本 |
| privacy_version | string nullable | 已同意隐私政策版本 |
| last_login_at | datetime nullable | 最近登录时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`email` unique、`phone` unique、`role`。

#### account_auth_identities

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 身份绑定 ID |
| user_id | int FK users.id | 所属用户 |
| provider | enum(`wechat`,`phone`,`email`) | 身份来源 |
| provider_app_id | string nullable | 微信应用 ID 或渠道标识 |
| provider_user_id | string | 来源方用户 ID；微信为 `openid` |
| union_id | string nullable | 微信开放平台 `unionid` |
| display_name | string nullable | 来源方昵称 |
| avatar_url | string nullable | 来源方头像 |
| bound_at | datetime | 绑定时间 |
| last_login_at | datetime nullable | 最近登录时间 |
| status | enum(`active`,`unbound`) | 绑定状态 |
| created_at / updated_at | datetime | 时间戳 |

索引：`user_id,status`、`provider,provider_app_id,provider_user_id` unique、`provider,union_id`。

#### sms_verification_codes

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 验证码记录 ID |
| phone | string indexed | 手机号 |
| scene | enum(`register`,`phone_login`,`bind_phone`,`change_phone`,`unbind_phone`) | 验证码场景 |
| code_hash | string | 验证码哈希，不保存明文 |
| send_ip | string nullable | 发送 IP |
| device_id | string nullable | 设备 ID |
| captcha_ticket | string nullable | 真人验证票据 |
| user_id | int nullable indexed | 关联用户；登录/注册场景可为空 |
| expires_at | datetime | 过期时间 |
| verified_at | datetime nullable | 校验通过时间 |
| attempt_count | integer | 校验尝试次数 |
| status | enum(`pending`,`verified`,`expired`,`blocked`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

索引：`phone,scene,status,created_at`、`expires_at`。

#### account_risk_challenges

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 真人验证挑战 ID |
| user_id | int nullable indexed | 关联用户；未登录场景可为空 |
| action | enum(`send_sms`,`phone_login`,`wechat_login`,`bind_phone`,`bind_wechat`,`upload_character`,`create_voice`,`export_pdf`,`share_personal_asset`) | 风控动作 |
| provider | enum(`slider`,`image`,`silent`,`third_party`) | 验证方式 |
| ticket_hash | string unique | 验证通过票据哈希 |
| device_id | string nullable | 设备 ID |
| ip | string nullable | 触发 IP |
| status | enum(`pending`,`passed`,`failed`,`expired`) | 状态 |
| expires_at | datetime | 票据过期时间 |
| verified_at | datetime nullable | 验证通过时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`user_id,action,status`、`device_id,action,status`、`expires_at`。

#### account_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 登录态 ID |
| user_id | int FK users.id | 用户 ID |
| refresh_token_hash | string unique | 刷新令牌哈希 |
| login_method | enum(`phone_code`,`wechat`,`register`) | 登录方式 |
| device_id | string nullable | 设备 ID |
| user_agent | string nullable | User-Agent 摘要 |
| ip | string nullable | 登录 IP |
| return_to | string nullable | 登录完成后恢复的前端上下文标识或路径 |
| expires_at | datetime | 过期时间 |
| revoked_at | datetime nullable | 失效时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`user_id,revoked_at`、`expires_at`。

#### child_profiles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 档案 ID |
| user_id | int FK users.id | 所属家长/老师账号 |
| nickname | string | 昵称 |
| age_range | enum nullable | 内置年龄段枚举 |
| reading_level | enum nullable | 内置阅读等级枚举 |
| interest_tags | JSON array | 内置兴趣标签枚举数组 |
| education_goals | JSON array | 内置教育目标枚举数组 |
| default_character_id | int nullable | 默认角色形象 ID，引用 asset.characters |
| default_voice_id | int nullable | 默认声音 ID，引用 asset.voices |
| visibility | enum(`private`) | MVP 固定私密 |
| is_default | bool | 是否默认 |
| status | enum(`active`,`deleted`) | 软删除状态 |
| created_at / updated_at | datetime | 时间戳 |

索引：`user_id,status`、`user_id,is_default`。
## 5. 跨模块协作

- 调用 `entitlement` 校验儿童档案数量上限。
- 调用 `asset` 读取默认素材摘要。
- 被 `creation`、`discovery`、`reading`、`membership`、`share`、`export` 消费登录态和当前档案。
- 高风险操作可调用 `assert_phone_bound()` 或风险验证能力。

## 6. 边界规则

- 前端不自行判断验证码有效性、账号风险、登录身份是否可解绑。
- 档案阅读历史和收藏归 `reading`，档案页只展示聚合结果。
- 会员权益归 `membership / entitlement`。
- 素材创建和处理归 `asset / storage / privacy`。
- 账号头像 `users.avatar_asset_id` 只用于账号展示；儿童档案默认角色形象用于绘本生成。
