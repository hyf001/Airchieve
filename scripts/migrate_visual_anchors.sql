-- Add phase-2 lightweight visual anchors to storybooks.
-- SQLite does not support column-level COMMENT syntax; this column stores JSON text.
ALTER TABLE `storybooks`
  ADD COLUMN `visual_anchors` TEXT DEFAULT NULL;
