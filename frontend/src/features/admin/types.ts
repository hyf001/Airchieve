import type { OperationDashboard } from "@/features/analytics";
import type { AssetAccessLevel } from "@/entities/asset";

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
