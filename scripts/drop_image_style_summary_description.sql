-- Remove obsolete image style text fields.
-- The style generation flow now uses reference images plus generation_prompt/negative_prompt.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS image_style_versions_new (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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

INSERT INTO image_style_versions_new (
    id,
    image_style_id,
    version_no,
    generation_prompt,
    negative_prompt,
    status,
    creator,
    created_at,
    published_at
)
SELECT
    id,
    image_style_id,
    version_no,
    generation_prompt,
    negative_prompt,
    status,
    creator,
    created_at,
    published_at
FROM image_style_versions;

DROP TABLE image_style_versions;
ALTER TABLE image_style_versions_new RENAME TO image_style_versions;

CREATE INDEX IF NOT EXISTS ix_image_style_versions_image_style_id ON image_style_versions (image_style_id);
CREATE INDEX IF NOT EXISTS ix_image_style_versions_status ON image_style_versions (status);
CREATE INDEX IF NOT EXISTS ix_image_style_versions_created_at ON image_style_versions (created_at);

PRAGMA foreign_keys=on;
