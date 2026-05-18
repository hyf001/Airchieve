import { type BookSummary } from "@/entities/book";

export type ReadingMode = "auto" | "manual" | "parent_child";
export type ReadingTextMode = "zh" | "en" | "bilingual";

export interface FavoriteRead {
  id: number;
  book_id: number;
  child_profile_id?: number | null;
  status: "active" | "deleted";
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgressRead {
  id: number;
  book_id: number;
  child_profile_id?: number | null;
  current_page_no: number;
  current_position_ms: number;
  progress_percent: number;
  mode: ReadingMode;
  text_mode: ReadingTextMode;
  voice_id?: number | null;
  last_read_at: string;
  completed_at?: string | null;
}

export interface ReadingProgressPayload {
  child_profile_id?: number | null;
  current_page_no: number;
  current_position_ms: number;
  progress_percent: number;
  mode: ReadingMode;
  text_mode: ReadingTextMode;
  voice_id?: number | null;
  completed?: boolean;
}

export interface RecentReadSummary {
  progress: ReadingProgressRead;
  book: BookSummary;
}

export interface ReadingEventPayload {
  book_id: number;
  child_profile_id?: number | null;
  event_type: "play_start" | "page_view" | "pause" | "resume" | "complete" | "replay";
  page_no?: number | null;
  position_ms?: number | null;
  payload?: Record<string, string | number | boolean | null>;
}
