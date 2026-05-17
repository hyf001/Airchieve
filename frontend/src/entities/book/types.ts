export type BookLanguage = "zh" | "en" | "bilingual";
export type BookAccessLevel = "free" | "preview" | "vip";

export interface BookSummary {
  id: number;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  cover_url?: string | null;
  age_range_ids: number[];
  theme_ids: number[];
  education_goal_ids: number[];
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
  narrative_style_id?: number | null;
  art_style_id?: number | null;
  publish_status: "draft" | "published" | "unpublished" | "deleted";
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  related_books: BookSummary[];
}

export interface BookListRead {
  items: BookSummary[];
  total: number;
  limit: number;
  offset: number;
}
