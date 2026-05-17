# account 模块详细设计

## 功能

- 管理用户账号、注册登录、第三方身份绑定、手机号绑定、用户角色、登录态摘要和儿童档案。
- 支持账号注册、手机号验证码登录、微信登录，首次登录时自动创建用户账号。
- 支持已登录用户绑定、换绑、解绑手机号，绑定、换绑微信；手机号作为唯一登录标识，不允许绑定到多个有效账号。
- 验证码用于手机号登录、账号注册、手机号绑定等场景，需限制发送频率、校验次数和有效期。
- 微信登录通过微信 `code` 换取 `openid`/`unionid`，优先按 `unionid` 匹配，其次按应用内 `openid` 匹配。
- 登录、注册、首次微信创建账号必须记录用户协议和隐私政策同意版本。
- 短信发送、连续失败、异常设备、高风险账号操作需支持真人验证挑战，验证完成后回到原操作上下文。
- 支持家长账号下多个儿童档案，档案之间阅读历史、收藏和推荐上下文隔离。
- 儿童档案保存昵称、年龄段、兴趣标签、阅读水平、常用教育目标、默认形象、默认声音、默认画风。
- 创建儿童档案前调用 `entitlement_service.assert_can_create(user_id, "child_profile")`。
- 只保存默认素材引用，不负责形象、声音、画风的创建和处理。

## 接口

### 前台 API

- `POST /api/v1/account/auth/register`：账号注册，支持手机号验证码注册。
- `POST /api/v1/account/auth/sms-code`：发送短信验证码，用于注册、手机号登录、手机号绑定、换绑。
- `POST /api/v1/account/auth/phone-login`：手机号验证码登录；手机号未注册时按产品策略自动注册或返回需注册。
- `POST /api/v1/account/auth/wechat-login`：微信登录；微信身份未绑定用户时自动创建账号并绑定微信身份。
- `POST /api/v1/account/auth/refresh`：刷新登录态并轮换 refresh token。
- `POST /api/v1/account/auth/logout`：退出当前登录态。
- `POST /api/v1/account/auth/captcha/verify`：提交真人验证结果，换取可用于当前操作的验证票据。
- `GET /api/v1/account/me`：获取当前用户、角色、会员摘要和默认儿童档案。
- `GET /api/v1/account/bindings`：获取当前账号已绑定登录方式摘要。
- `POST /api/v1/account/phone/bind`：绑定手机号。
- `POST /api/v1/account/phone/change`：换绑手机号。
- `DELETE /api/v1/account/phone`：解绑手机号，需确保账号仍保留微信等至少一种可登录身份。
- `POST /api/v1/account/wechat/bind`：绑定微信。
- `POST /api/v1/account/wechat/change`：换绑微信。
- `DELETE /api/v1/account/wechat`：解绑微信，需确保账号仍保留手机号等至少一种可登录身份。
- `GET /api/v1/account/child-profiles`：获取当前用户儿童档案列表。
- `POST /api/v1/account/child-profiles`：创建儿童档案。
- `GET /api/v1/account/child-profiles/{profile_id}`：获取儿童档案详情。
- `PATCH /api/v1/account/child-profiles/{profile_id}`：更新儿童档案。
- `DELETE /api/v1/account/child-profiles/{profile_id}`：软删除儿童档案。
- `POST /api/v1/account/child-profiles/{profile_id}/default`：设为默认档案。

### 后台 API

- `GET /api/v1/admin/accounts/users`：账号列表，支持按手机号、角色、状态、注册时间和登录方式筛选。
- `GET /api/v1/admin/accounts/users/{user_id}`：账号详情，展示基础状态、注册时间、最近登录时间、登录方式摘要和儿童档案数量。
- `PATCH /api/v1/admin/accounts/users/{user_id}/status`：启用或禁用账号，写入后台审计日志。

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
- `get_or_create_user_by_wechat_identity(identity) -> UserRead`
- `list_auth_bindings(user_id) -> list[AuthBindingSummary]`
- `assert_login_method_remains(user_id, excluding_identity_id=None) -> None`
- `assert_phone_bound(user_id) -> None`
- `assert_phone_code_valid(phone, scene, code) -> None`
- `assert_risk_challenge_passed(user_id, action, ticket) -> None`
- `get_current_user(user_id) -> UserRead`
- `get_child_profile(profile_id) -> ChildProfileRead`
- `list_child_profiles(user_id) -> list[ChildProfileSummary]`
- `create_child_profile(user_id, payload) -> ChildProfileRead`
- `update_child_profile(user_id, profile_id, payload) -> ChildProfileRead`
- `delete_child_profile(user_id, profile_id) -> None`
- `set_default_child_profile(user_id, profile_id) -> ChildProfileRead`
- `assert_profile_belongs_to_user(profile_id, user_id) -> None`

## 数据库定义

### users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 用户 ID |
| email | string nullable unique | 邮箱 |
| phone | string nullable unique | 手机号 |
| phone_verified_at | datetime nullable | 手机号验证时间 |
| display_name | string | 展示名 |
| avatar_asset_id | string nullable | 头像文件引用 |
| role | enum(`parent`,`teacher`,`admin`) | 基础角色 |
| status | enum(`active`,`disabled`) | 账号状态 |
| default_child_profile_id | string nullable | 默认儿童档案 |
| terms_accepted_at | datetime nullable | 用户协议同意时间 |
| privacy_accepted_at | datetime nullable | 隐私政策同意时间 |
| terms_version | string nullable | 已同意用户协议版本 |
| privacy_version | string nullable | 已同意隐私政策版本 |
| last_login_at | datetime nullable | 最近登录时间 |
| created_at / updated_at | datetime | 时间戳 |

索引：`email` unique、`phone` unique、`role`。

### account_auth_identities

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 身份绑定 ID |
| user_id | FK users.id | 所属用户 |
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

### sms_verification_codes

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 验证码记录 ID |
| phone | string indexed | 手机号 |
| scene | enum(`register`,`phone_login`,`bind_phone`,`change_phone`,`unbind_phone`) | 验证码场景 |
| code_hash | string | 验证码哈希，不保存明文 |
| send_ip | string nullable | 发送 IP |
| device_id | string nullable | 设备 ID |
| captcha_ticket | string nullable | 真人验证票据 |
| user_id | string nullable indexed | 关联用户；登录/注册场景可为空 |
| expires_at | datetime | 过期时间 |
| verified_at | datetime nullable | 校验通过时间 |
| attempt_count | integer | 校验尝试次数 |
| status | enum(`pending`,`verified`,`expired`,`blocked`) | 状态 |
| created_at / updated_at | datetime | 时间戳 |

索引：`phone,scene,status,created_at`、`expires_at`。

### account_risk_challenges

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 真人验证挑战 ID |
| user_id | string nullable indexed | 关联用户；未登录场景可为空 |
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

### account_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 登录态 ID |
| user_id | FK users.id | 用户 ID |
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

### child_profiles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 档案 ID |
| user_id | FK users.id | 所属家长/老师账号 |
| nickname | string | 昵称 |
| age_range_id | string nullable | taxonomy:age_range |
| reading_level_id | string nullable | taxonomy:reading_level |
| interest_tag_ids | JSON array | taxonomy:interest_tag |
| education_goal_ids | JSON array | taxonomy:education_goal |
| default_character_id | string nullable | asset character 引用 |
| default_voice_id | string nullable | asset voice 引用 |
| default_art_style_id | string nullable | asset art_style 引用 |
| visibility | enum(`private`) | MVP 固定私密 |
| is_default | bool | 是否默认 |
| status | enum(`active`,`deleted`) | 软删除状态 |
| created_at / updated_at | datetime | 时间戳 |

索引：`user_id,status`、`user_id,is_default`。

## Schema 定义

- `AccountRegisterRequest`：`phone`、`sms_code`、`display_name?`、`terms_version`、`privacy_version`。
- `SmsCodeSendRequest`：`phone`、`scene`、`device_id?`、`captcha_ticket?`。
- `SmsCodeSendResult`：`cooldown_seconds`、`expires_in_seconds`、`masked_phone`。
- `PhoneLoginRequest`：`phone`、`sms_code`、`auto_register=true`、`device_id?`、`return_to?`、`terms_version?`、`privacy_version?`。
- `WechatLoginRequest`：`code`、`provider_app_id`、`encrypted_phone_payload?`、`device_id?`、`return_to?`、`terms_version?`、`privacy_version?`。
- `CaptchaVerifyRequest`：`challenge_id`、`provider`、`captcha_response`、`device_id?`。
- `CaptchaVerifyResult`：`captcha_ticket`、`expires_in_seconds`。
- `AuthTokenRead`：`access_token`、`refresh_token`、`token_type`、`expires_in`、`session_id`、`return_to?`、`user`。
- `AuthBindingSummary`：`provider`、`masked_identifier`、`bound_at`、`last_login_at?`、`can_unbind`。
- `PhoneBindRequest`：`phone`、`sms_code`。
- `PhoneChangeRequest`：`old_phone_sms_code`、`new_phone`、`new_phone_sms_code`。
- `PhoneUnbindRequest`：`sms_code`。
- `WechatBindRequest`：`code`、`provider_app_id`。
- `UserRead`：`id`、`display_name`、`avatar_url`、`role`、`status`、`default_child_profile_id`、`phone_masked`、`wechat_bound`、`membership_summary`。
- `AdminUserSummary`：`id`、`phone_masked`、`display_name`、`role`、`status`、`created_at`、`last_login_at`、`login_methods`。
- `ChildProfileCreate`：`nickname`、`age_range_id?`、`reading_level_id?`、`interest_tag_ids=[]`、`education_goal_ids=[]`、`default_character_id?`、`default_voice_id?`、`default_art_style_id?`。
- `ChildProfileUpdate`：全部字段可选，禁止更新 `user_id`。
- `ChildProfileRead`：档案完整字段、默认素材摘要、创建时间、更新时间。
- `ChildProfileSummary`：`id`、`nickname`、`age_range_label`、`reading_level_label`、`is_default`、默认素材缩略摘要。

## 业务规则

- 手机号登录和注册必须先校验 `sms_verification_codes`，验证码只允许在对应 `scene` 使用一次。
- 同一手机号短时间内重复发送验证码需返回冷却时间；同一 IP、同一手机号、同一设备需有频率限制。
- 如果发送短信、登录失败或异常设备命中风控，接口返回需要真人验证的错误码和 `challenge_id`，前端完成验证后携带 `captcha_ticket` 重试原操作。
- 真人验证不得直接打断儿童阅读播放主流程；如阅读场景触发账号风险，应引导到家长账号操作上下文处理。
- 手机号绑定前必须确认手机号未被其他 `active` 用户占用；换绑成功后更新 `users.phone` 和 `phone_verified_at`。
- 解绑手机号前必须检查用户仍有至少一个 `active` 登录身份，例如微信身份，避免账号不可登录。
- 微信绑定、换绑前必须确认微信身份未被其他 `active` 用户绑定；解绑微信前必须检查用户仍有手机号等至少一种可登录身份。
- 微信登录时如果命中已有 `account_auth_identities`，直接登录对应用户；未命中时创建 `users` 和微信身份绑定。
- 如果微信返回的手机号已存在账号，自动合并必须非常谨慎；MVP 默认要求用户先完成手机号验证码确认后再绑定到已有账号。
- 首次手机号登录自动注册、手机号注册、首次微信登录自动创建账号时，必须校验用户已同意当前用户协议和隐私政策版本。
- 登录成功后返回 `return_to`，由前端恢复绘本播放、生成步骤、会员支付页或个人素材库上下文；后端只保存必要的上下文标识，不保存完整敏感页面状态。
- 使用微信登录但未绑定手机号的用户，在会员订阅、分享含个人素材绘本、创建个人声音、导出 PDF 等高风险操作前，业务模块可调用 `account_service.assert_phone_bound(user_id)`。
- 管理员后台只能查看手机号脱敏值、登录方式摘要、注册时间和最近登录时间；不得展示短信验证码明文、微信 openid/unionid 完整值或不必要的微信头像昵称隐私。
- 账号状态为 `disabled` 时禁止登录、绑定手机号和创建儿童档案。
