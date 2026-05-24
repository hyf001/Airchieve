import type { GenerationTaskRead, GenerationTaskStatusValue } from "@/entities/generation-task";

export type CreationType = "story_to_book" | "template_book" | "similar_book";
export type CreationLanguage = "zh" | "en" | "bilingual";
export type CreationStorySourceType = "system_story" | "user_story" | "uploaded_story" | "idea";
export type CreationStep = "story" | "template" | "character" | "art_style" | "storyboard" | "voice" | "preview";
export type { GenerationTaskRead, GenerationTaskStatusValue };

export interface CharacterRef {
  source: "story_original" | "child_profile_default" | "user_character" | "system_character" | "upload" | "generated";
  character_id?: number | null;
  role_code?: string | null;
  display_name?: string | null;
}

export interface ArtStyleRef {
  source: "system" | "custom";
  art_style_code?: string | null;
  custom_prompt?: string | null;
}

export interface VoiceRef {
  source: "template_default" | "system" | "user";
  voice_id?: number | null;
  display_name?: string | null;
}

export interface StoryboardPage {
  id: number;
  session_id: number;
  page_no: number;
  title?: string | null;
  text_zh?: string | null;
  text_en?: string | null;
  narration_text?: string | null;
  visual_prompt: string;
  character_appearances: Record<string, unknown>[];
  dialogues: Record<string, unknown>[];
  image_asset_id?: number | null;
  image_url?: string | null;
  audio_asset_id?: number | null;
  audio_url?: string | null;
  lip_sync_url?: string | null;
  generation_status: "draft" | "pending" | "ready" | "failed";
}

export interface CreationSession {
  id: number;
  user_id: number;
  child_profile_id?: number | null;
  creation_type: CreationType;
  status: "draft" | "generating" | "preview" | "saved" | "failed" | "canceled";
  current_step: CreationStep;
  story_source_type?: CreationStorySourceType | null;
  story_id?: number | null;
  template_id?: number | null;
  idea_prompt?: string | null;
  reference_book_id?: number | null;
  language: CreationLanguage;
  target_page_count: number;
  age_range_codes: string[];
  theme_codes: string[];
  education_goal_codes: string[];
  narrative_style_code?: string | null;
  character_refs: Record<string, unknown>[];
  art_style_ref?: Record<string, unknown> | null;
  voice_ref?: Record<string, unknown> | null;
  saved_book_id?: number | null;
  storyboard_pages: StoryboardPage[];
  created_at: string;
  updated_at: string;
}

export interface CreationTaskResponse {
  session: CreationSession;
  task: GenerationTaskRead;
}

export interface CreationSessionCreatePayload {
  creation_type: CreationType;
  story_source_type?: CreationStorySourceType | null;
  story_id?: number | null;
  template_id?: number | null;
  reference_book_id?: number | null;
  language: CreationLanguage;
  target_page_count: number;
  age_range_codes: string[];
  theme_codes: string[];
  education_goal_codes: string[];
  narrative_style_code?: string | null;
}
