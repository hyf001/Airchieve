-- 1. 新增 status 列
ALTER TABLE pages ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'finished';

-- 2. 新增 error_message 列
ALTER TABLE pages ADD COLUMN error_message VARCHAR(500) NULL;

-- 3. 历史数据统一设为 finished（新增列默认值已处理，这步确保万无一失）
UPDATE pages SET status = 'finished', error_message = NULL WHERE status IS NULL OR status = '';
