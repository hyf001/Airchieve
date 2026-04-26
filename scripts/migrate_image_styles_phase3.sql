-- 图片风格三期迁移
-- 说明：
-- 1. 全新数据库会由 SQLAlchemy create_all 创建新表。
-- 2. 已有一期/二期测试库执行本脚本，补齐图片资产表和参考图引用字段。
-- 3. SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，重复执行 ADD COLUMN 会报 duplicate column。

CREATE TABLE IF NOT EXISTS image_style_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url VARCHAR(2048) NOT NULL,
    object_key VARCHAR(1024) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    tags JSON NOT NULL DEFAULT '[]',
    style_type VARCHAR(64) NULL,
    color_tags JSON NOT NULL DEFAULT '[]',
    texture_tags JSON NOT NULL DEFAULT '[]',
    scene_tags JSON NOT NULL DEFAULT '[]',
    subject_tags JSON NOT NULL DEFAULT '[]',
    composition_tags JSON NOT NULL DEFAULT '[]',
    age_group_tags JSON NOT NULL DEFAULT '[]',
    content_type VARCHAR(128) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    width INTEGER NULL,
    height INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    creator VARCHAR(128) NOT NULL,
    modifier VARCHAR(128) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_image_style_assets_object_key ON image_style_assets (object_key);
CREATE INDEX IF NOT EXISTS ix_image_style_assets_name ON image_style_assets (name);
CREATE INDEX IF NOT EXISTS ix_image_style_assets_style_type ON image_style_assets (style_type);
CREATE INDEX IF NOT EXISTS ix_image_style_assets_is_active ON image_style_assets (is_active);
CREATE INDEX IF NOT EXISTS ix_image_style_assets_created_at ON image_style_assets (created_at);

ALTER TABLE image_style_reference_images ADD COLUMN asset_id INTEGER NULL;
ALTER TABLE image_style_reference_images ADD COLUMN url_snapshot VARCHAR(2048) NULL;

CREATE INDEX IF NOT EXISTS ix_image_style_reference_images_asset_id ON image_style_reference_images (asset_id);

-- 将旧 url 参考图沉淀为图片资产并回填 asset_id/url_snapshot。
INSERT INTO image_style_assets (
    url,
    object_key,
    name,
    description,
    tags,
    style_type,
    color_tags,
    texture_tags,
    scene_tags,
    subject_tags,
    composition_tags,
    age_group_tags,
    content_type,
    file_size,
    is_active,
    creator,
    created_at,
    updated_at
)
SELECT
    r.url,
    r.url,
    '历史参考图 ' || r.id,
    r.note,
    '[]',
    NULL,
    '[]',
    '[]',
    '[]',
    '[]',
    '[]',
    '[]',
    'image/png',
    0,
    1,
    r.creator,
    r.created_at,
    r.updated_at
FROM image_style_reference_images r
WHERE r.asset_id IS NULL
  AND r.url IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM image_style_assets a WHERE a.url = r.url
  );

UPDATE image_style_reference_images
SET
    asset_id = (
        SELECT a.id FROM image_style_assets a
        WHERE a.url = image_style_reference_images.url
        ORDER BY a.id
        LIMIT 1
    ),
    url_snapshot = image_style_reference_images.url
WHERE asset_id IS NULL;
