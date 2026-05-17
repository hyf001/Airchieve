# share 模块详细设计

## 功能

- 管理个人绘本的只读分享链接、访问范围、关闭/恢复、重新生成 token 和分享页播放器数据。
- 分享含个人形象或个人声音的绘本前调用 `privacy` 记录风险确认。
- 创建分享前调用 `entitlement` 校验分享数量。
- 不修改绘本内容，不生成 PDF。

## 接口

### 前台 API

- `POST /api/v1/share/book/{book_id}`：创建分享链接。
- `GET /api/v1/share/links`：当前用户分享链接列表。
- `PATCH /api/v1/share/links/{share_id}`：更新访问范围、过期时间。
- `POST /api/v1/share/links/{share_id}/close`：关闭分享。
- `POST /api/v1/share/links/{share_id}/regenerate-token`：重新生成 token。
- `GET /api/v1/share/public/{token}`：分享页信息。
- `GET /api/v1/share/public/{token}/player`：分享播放器 payload。

### Service

- `create_share_link(user_id, book_id, payload) -> ShareLinkRead`
- `get_share_link(token) -> ShareLinkRead`
- `get_shared_player_payload(token, options) -> BookPlayerPayload`
- `close_share_link(user_id, share_id) -> ShareLinkRead`
- `regenerate_share_token(user_id, share_id) -> ShareLinkRead`
- `list_user_share_links(user_id, filters) -> Page[ShareLinkSummary]`

## 数据库定义

### share_links

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 分享 ID |
| user_id | string indexed | 创建用户 |
| book_id | string indexed | 绘本 |
| token_hash | string unique | token hash |
| title_snapshot | string | 标题快照 |
| cover_asset_id_snapshot | string nullable | 封面快照 |
| access_scope | enum(`public`,`password`,`specified`) | 访问范围 |
| password_hash | string nullable | 访问密码 |
| status | enum(`active`,`closed`,`banned`,`expired`) | 状态 |
| privacy_confirmation_id | string nullable | 隐私确认 |
| expires_at | datetime nullable | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |

### share_access_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 访问日志 |
| share_id | FK share_links.id indexed | 分享 |
| visitor_id | string nullable | 访问者标识 |
| ip_hash | string nullable | IP hash |
| user_agent | string nullable | UA |
| occurred_at | datetime | 访问时间 |

## Schema 定义

- `ShareLinkCreate`：`access_scope`、`password?`、`expires_at?`、`privacy_confirmation_id?`。
- `ShareLinkRead`：分享 ID、URL、绘本快照、状态、访问范围、过期时间。
- `ShareLinkSummary`：列表字段、访问次数、最近访问时间。
- `SharedBookRead`：分享页基础信息、绘本摘要、是否可播放。

