import { type BookSummary } from "@/entities/book";

export type StorySourceType = "system" | "user" | "uploaded" | "generated_idea";
export type StoryLanguage = "zh" | "en" | "bilingual";
export type StoryAccessLevel = "free" | "preview" | "vip";

export interface StorySummary {
  id: number;
  owner_user_id?: number | null;
  source_type: StorySourceType;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  age_range_ids: number[];
  theme_ids: number[];
  education_goal_ids: number[];
  language: StoryLanguage;
  access_level: StoryAccessLevel;
  publish_status: "draft" | "published" | "unpublished" | "deleted";
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoryDetail extends StorySummary {
  body: string;
  narrative_style_id?: number | null;
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
  age_range_ids?: number[];
  theme_ids?: number[];
  education_goal_ids?: number[];
  language?: StoryLanguage;
  narrative_style_id?: number | null;
}
