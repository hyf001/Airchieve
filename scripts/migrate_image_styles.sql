-- 图片风格一期表结构迁移
-- 说明：
-- 1. 新表在全新数据库中会由 SQLAlchemy create_all 自动创建。
-- 2. 已有数据库需要执行本脚本，补齐新表和 storybooks 预留字段。
-- 3. SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，重复执行第 3 步会报 duplicate column。

-- 1. 新增图片风格表
CREATE TABLE IF NOT EXISTS image_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    cover_image VARCHAR(1024) NULL,
    tags JSON NOT NULL DEFAULT '[]',
    current_version_id INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    creator VARCHAR(128) NOT NULL,
    modifier VARCHAR(128) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_image_styles_name ON image_styles (name);
CREATE INDEX IF NOT EXISTS ix_image_styles_current_version_id ON image_styles (current_version_id);
CREATE INDEX IF NOT EXISTS ix_image_styles_is_active ON image_styles (is_active);
CREATE INDEX IF NOT EXISTS ix_image_styles_created_at ON image_styles (created_at);

-- 2. 新增图片风格版本表
CREATE TABLE IF NOT EXISTS image_style_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_style_id INTEGER NOT NULL,
    version_no VARCHAR(32) NOT NULL,
    generation_prompt TEXT NULL,
    negative_prompt TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    creator VARCHAR(128) NOT NULL,
    created_at DATETIME NOT NULL,
    published_at DATETIME NULL,
    FOREIGN KEY(image_style_id) REFERENCES image_styles (id)
);

CREATE INDEX IF NOT EXISTS ix_image_style_versions_image_style_id ON image_style_versions (image_style_id);
CREATE INDEX IF NOT EXISTS ix_image_style_versions_status ON image_style_versions (status);
CREATE INDEX IF NOT EXISTS ix_image_style_versions_created_at ON image_style_versions (created_at);

-- 3. 新增图片风格版本参考图表
CREATE TABLE IF NOT EXISTS image_style_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_style_version_id INTEGER NOT NULL,
    url VARCHAR(2048) NOT NULL,
    is_cover BOOLEAN NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    note VARCHAR(500) NULL,
    creator VARCHAR(128) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(image_style_version_id) REFERENCES image_style_versions (id)
);

CREATE INDEX IF NOT EXISTS ix_image_style_reference_images_image_style_version_id ON image_style_reference_images (image_style_version_id);
CREATE INDEX IF NOT EXISTS ix_image_style_reference_images_created_at ON image_style_reference_images (created_at);

-- 4. Storybook 预留图片风格绑定字段
ALTER TABLE storybooks ADD COLUMN image_style_id INTEGER NULL;
ALTER TABLE storybooks ADD COLUMN image_style_version_id INTEGER NULL;
