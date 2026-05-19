export type ExportType = "pdf";
export type ExportQuality = "standard" | "high";
export type ExportJobStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

export interface ExportJob {
  id: number;
  user_id: number;
  book_id: number;
  export_type: ExportType;
  quality: ExportQuality;
  status: ExportJobStatus;
  generation_task_id: number | null;
  file_asset_id: number | null;
  file_url: string | null;
  idempotency_key: string | null;
  book_snapshot: Record<string, unknown>;
  privacy_confirmation_id: number | null;
  quota_reservation_id: number | null;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportJobList {
  items: ExportJob[];
  total: number;
  limit: number;
  offset: number;
}
