import type { OperationDashboard } from "@/features/analytics";
import type { AssetAccessLevel, LibraryItemStatus } from "@/entities/asset";
import type { BillingPeriod, EntitlementConfig, MembershipPlanStatus } from "@/entities/membership";

export interface AdminDashboardRead {
  pending_moderation_count: number;
  report_count: number;
  audit_log_count: number;
  analytics: OperationDashboard;
}

export interface AdminContentOverviewRead {
  stories: number;
  books: number;
  templates: number;
  characters: number;
  voices: number;
  background_music: number;
  share_links: number;
  export_jobs: number;
}

export interface SystemArtStyleWrite {
  code: string;
  name: string;
  description: string;
  prompt?: string | null;
  example_asset_id?: number | null;
  age_range_codes: string[];
  access_level: AssetAccessLevel;
  sort_order: number;
  status: "active" | "inactive";
}

export interface SystemCharacterWrite {
  name: string;
  identity_tag?: string | null;
  description?: string | null;
  image_asset_id?: number | null;
  image_url?: string | null;
  art_style_id: number | null;
  generation_prompt?: string | null;
  category_code?: string | null;
  access_level: AssetAccessLevel;
  status: Exclude<LibraryItemStatus, "deleted">;
}

export interface SystemVoiceWrite {
  name: string;
  voice_style_code?: string | null;
  voice_language?: string | null;
  emotion_type?: string | null;
  sample_url?: string | null;
  duration_seconds?: number | null;
  access_level: AssetAccessLevel;
  status: Exclude<LibraryItemStatus, "deleted">;
}

export interface SystemBackgroundMusicWrite {
  name: string;
  description?: string | null;
  audio_url: string;
  duration_seconds?: number | null;
  access_level: AssetAccessLevel;
  sort_order: number;
  status: Exclude<LibraryItemStatus, "deleted">;
}

export interface MembershipPlanWrite {
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  billing_period: BillingPeriod;
  entitlement_config: EntitlementConfig;
  sort_order: number;
  status: MembershipPlanStatus;
}
