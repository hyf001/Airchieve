import { type BookSummary } from "@/entities/book";
import { type GenerationTaskRead } from "@/entities/generation-task";

export type StorySourceType = "system" | "user" | "uploaded" | "generated_idea";
export type StoryLanguage = "zh" | "en" | "bilingual";
export type StoryAccessLevel = "free" | "preview" | "vip";

export interface StoryCharacter {
  name: string;
  is_protagonist: boolean;
}

export interface StorySummary {
  id: number;
  owner_user_id?: number | null;
  source_type: StorySourceType;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  age_range_codes: string[];
  theme_codes: string[];
  education_goal_codes: string[];
  language: StoryLanguage;
  narrative_style_code?: string | null;
  access_level: StoryAccessLevel;
  publish_status: "draft" | "published" | "unpublished" | "deleted";
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoryDetail extends StorySummary {
  body: string;
  characters: StoryCharacter[];
  moderation_status: "pending" | "approved" | "rejected" | "hidden";
  generated_books: BookSummary[];
}

export interface StoryListRead {
  items: StorySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface StoryPayload {
  title: string;
  summary?: string | null;
  body: string;
  source_type?: StorySourceType;
  age_range_codes?: string[];
  theme_codes?: string[];
  education_goal_codes?: string[];
  language?: StoryLanguage;
  narrative_style_code?: string | null;
  characters?: StoryCharacter[];
}

export interface StoryGeneratePayload {
  idea_prompt: string;
  characters: StoryCharacter[];
  age_range_codes?: string[];
  theme_codes?: string[];
  education_goal_codes?: string[];
  language?: StoryLanguage;
  narrative_style_code?: string | null;
}

export interface StoryGenerationTaskResponse {
  story: StoryDetail;
  task: GenerationTaskRead;
}
