import type { OperationDashboard } from "@/features/analytics";

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
