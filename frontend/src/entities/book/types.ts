export type BookLanguage = "zh" | "en" | "bilingual";
export type BookAccessLevel = "free" | "preview" | "vip";

export interface BookSummary {
  id: number;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  cover_url?: string | null;
  age_range_codes: string[];
  theme_codes: string[];
  education_goal_codes: string[];
  tags: string[];
  language: BookLanguage;
  reading_level?: string | null;
  page_count: number;
  duration_seconds: number;
  access_level: BookAccessLevel;
  play_count: number;
  favorite_count: number;
}

export interface BookDetail extends BookSummary {
  source_story_id?: number | null;
  narrative_style_code?: string | null;
  art_style_code?: string | null;
  background_music_id?: number | null;
  background_music_url?: string | null;
  publish_status: "draft" | "published" | "unpublished" | "deleted";
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  related_books: BookSummary[];
}

export type BookLipSyncStatus = "none" | "pending" | "ready" | "failed";
export type BookPromptType = "question" | "interaction";
export type BookPlaybackSegmentType = "narration" | "dialogue";
export type BookPlaybackMediaMode = "audio" | "lip_sync";
export type BookSubtitleCueType = "narration" | "dialogue" | "interaction";
export type BookSubtitlePosition = "bottom" | "top" | "center" | "custom";
export type BookSegmentFallbackMode = "none" | "page_image_audio" | "page_image_dialogue_audio";
export type BookSoundEffectTriggerType = "page" | "segment";

export interface BookSubtitleCue {
  id: number;
  cue_type: BookSubtitleCueType;
  speaker_ref?: string | null;
  start_ms: number;
  end_ms?: number | null;
  text_zh?: string | null;
  text_en?: string | null;
  position: BookSubtitlePosition;
  position_config?: Record<string, unknown> | null;
  sort_order: number;
}

export interface BookSoundEffectCue {
  id: number;
  segment_id?: number | null;
  trigger_type: BookSoundEffectTriggerType;
  sound_effect_url: string;
  start_ms: number;
  end_ms?: number | null;
  volume: number;
  loop: boolean;
  sort_order: number;
}

export interface BookPlaybackSegment {
  id: number;
  segment_type: BookPlaybackSegmentType;
  speaker_ref?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  lip_sync_url?: string | null;
  media_mode: BookPlaybackMediaMode;
  start_ms?: number | null;
  end_ms?: number | null;
  fallback_mode: BookSegmentFallbackMode;
  lip_sync_status: BookLipSyncStatus;
  sort_order: number;
  subtitle_cues: BookSubtitleCue[];
  sound_effects: BookSoundEffectCue[];
}

export interface BookPage {
  id: number;
  page_no: number;
  title?: string | null;
  text_zh?: string | null;
  text_en?: string | null;
  narration_text?: string | null;
  visual_prompt?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  duration_seconds?: number | null;
  playback_segments: BookPlaybackSegment[];
  sound_effects: BookSoundEffectCue[];
}

export interface BookReadingPrompt {
  id: number;
  prompt_type: BookPromptType;
  content: string;
  page_no?: number | null;
  status: "visible" | "hidden";
  sort_order: number;
}

export interface BookLearningCard {
  id: number;
  theme?: string | null;
  education_goals: string[];
  vocabulary: string[];
  discussion_questions: string[];
  status: "visible" | "hidden";
  sort_order: number;
}

export interface BookVoiceOption {
  id?: number | null;
  name: string;
  source: string;
}

export interface AccessDecision {
  allowed: boolean;
  preview_pages?: number | null;
  reason_code?: string | null;
  upgrade_required: boolean;
}

export interface BookPlayerPayload {
  book: BookDetail;
  pages: BookPage[];
  reading_prompts: BookReadingPrompt[];
  learning_cards: BookLearningCard[];
  access_decision?: AccessDecision | null;
  can_read_full_book: boolean;
  preview_page_count?: number | null;
  default_text_mode: BookLanguage;
  default_voice?: BookVoiceOption | null;
  voice_options: BookVoiceOption[];
}

export interface BookListRead {
  items: BookSummary[];
  total: number;
  limit: number;
  offset: number;
}
