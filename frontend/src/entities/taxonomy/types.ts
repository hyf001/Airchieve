export type TaxonomyType =
  | "age_range"
  | "theme"
  | "interest_tag"
  | "education_goal"
  | "reading_level"
  | "language"
  | "narrative_style"
  | "scene"
  | "voice_style"
  | "asset_category";

export type TaxonomyItemStatus = "active" | "inactive";

export interface TaxonomyItem {
  id: number;
  type: TaxonomyType;
  code: string;
  name: string;
  name_en: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  sort_order: number;
  status: TaxonomyItemStatus;
  created_at: string;
  updated_at: string;
}
