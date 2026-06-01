export type AssetAccessLevel = "free" | "vip";
export type AssetSourceType = "system" | "ai_generated" | "user_upload" | "voice_clone";
export type GenerationTaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type LibraryItemStatus = "active" | "deleted" | "disabled";

export interface ArtStyle {
  id: number;
  owner_user_id: number | null;
  code: string | null;
  name: string;
  description: string;
  prompt: string | null;
  example_asset_id: number | null;
  example_url: string | null;
  age_range_codes: string[];
  access_level: AssetAccessLevel;
  sort_order: number;
  status: "active" | "inactive" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface CharacterSummary {
  id: number;
  owner_user_id: number | null;
  name: string;
  identity_tag: string | null;
  description: string | null;
  image_asset_id: number | null;
  image_url: string | null;
  art_style_id: number | null;
  art_style_code: string | null;
  custom_art_style_prompt: string | null;
  category_code: string | null;
  access_level: AssetAccessLevel;
  source_type: AssetSourceType;
  is_default: boolean;
  generation_task_id: number | null;
  generation_status: GenerationTaskStatus | null;
  generation_progress_percent: number | null;
  generation_error_message: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "hidden";
  status: LibraryItemStatus;
  created_at: string;
  updated_at: string;
}

export interface CharacterRead extends CharacterSummary {
  reference_character_id: number | null;
  generation_prompt: string | null;
  art_style: ArtStyle | null;
}

export interface VoiceSummary {
  id: number;
  owner_user_id: number | null;
  name: string;
  voice_style_code: string | null;
  emotion_type: string | null;
  sample_url: string | null;
  duration_seconds: number | null;
  access_level: AssetAccessLevel;
  source_type: AssetSourceType;
  is_default: boolean;
  status: LibraryItemStatus;
  created_at: string;
  updated_at: string;
}

export interface BackgroundMusicSummary {
  id: number;
  owner_user_id: number | null;
  name: string;
  description: string | null;
  audio_url: string;
  duration_seconds: number | null;
  access_level: AssetAccessLevel;
  source_type: AssetSourceType;
  is_default: boolean;
  sort_order: number;
  status: LibraryItemStatus;
  created_at: string;
  updated_at: string;
}

export interface BackgroundMusicBookReference {
  id: number;
  title: string;
  cover_url: string | null;
  publish_status: string;
}

export interface BackgroundMusicRead extends BackgroundMusicSummary {
  referenced_books: BackgroundMusicBookReference[];
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadSessionRead {
  id: number;
  user_id: number | null;
  purpose: "character" | "voice" | "background_music" | "story_file" | "book_media" | "export" | "task_result";
  filename: string;
  mime_type: string;
  max_byte_size: number;
  storage_key: string;
  upload_url: string;
  upload_method: "PUT";
  upload_headers: Record<string, string>;
  status: "created" | "completed" | "expired" | "failed";
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AssetStorageDTO {
  id: number;
  storage_key: string;
  url: string;
  mime_type: string;
  byte_size: number | null;
}
