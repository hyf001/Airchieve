export interface TemplateSummary {
  id: number;
  source_book_id: number;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  default_voice_name?: string | null;
  access_level: "free" | "preview" | "vip";
  allow_voice_replacement: boolean;
  allowed_voice_scope: "default_only" | "system" | "user_and_system";
  status: "draft" | "published" | "unpublished" | "deleted";
  validation_status: "unchecked" | "valid" | "invalid";
  sort_order: number;
  character_count: number;
  page_count?: number | null;
}

export interface TemplateCharacter {
  id: number;
  template_id: number;
  role_code: string;
  name: string;
  description?: string | null;
  required: boolean;
  default_character_name?: string | null;
  allowed_replacement_sources: string[];
  appear_page_nos: number[];
}

export interface TemplateRead extends TemplateSummary {
  characters: TemplateCharacter[];
}

export interface TemplateListRead {
  items: TemplateSummary[];
  total: number;
  limit: number;
  offset: number;
}
