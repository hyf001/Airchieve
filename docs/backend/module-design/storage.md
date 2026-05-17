# storage 模块详细设计

## 功能

- 封装文件上传、访问地址、删除标记和存储 provider 差异。
- 为素材、绘本媒体、生成任务结果、PDF 导出提供统一文件存取能力。
- 不理解业务语义，不判断会员权益，不记录上传授权。

## 接口

### Service

- `create_upload_session(user_id, payload) -> UploadSessionRead`
- `complete_upload(upload_session_id, payload) -> AssetStorageDTO`
- `get_file_url(storage_key, expires_in=None) -> str`
- `copy_file(source_storage_key, target_prefix) -> AssetStorageDTO`
- `mark_file_deleted(storage_key) -> None`

## 数据库定义

### storage_upload_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID/string PK | 上传会话 |
| user_id | string nullable indexed | 上传用户 |
| purpose | enum(`character`,`voice`,`story_file`,`book_media`,`export`,`task_result`) | 用途 |
| filename | string | 原始文件名 |
| mime_type | string | MIME |
| max_byte_size | integer | 最大大小 |
| storage_key | string | 目标 key |
| status | enum(`created`,`completed`,`expired`,`failed`) | 状态 |
| expires_at | datetime | 过期时间 |
| created_at / updated_at | datetime | 时间戳 |

## Schema 定义

- `UploadSessionCreate`：`purpose`、`filename`、`mime_type`、`byte_size?`。
- `UploadSessionRead`：`upload_session_id`、`upload_url`、`headers`、`storage_key`、`expires_at`。
- `UploadCompleteRequest`：`storage_key`、`byte_size`、`checksum?`。
- `AssetStorageDTO`：`storage_key`、`mime_type`、`byte_size`、`public_url?`。

