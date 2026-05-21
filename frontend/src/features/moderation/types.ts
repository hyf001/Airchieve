export type ModerationStatus = "pending" | "approved" | "rejected" | "hidden";
export type ReportReasonType = "age_inappropriate" | "copyright" | "privacy" | "abnormal" | "other";

export interface ModerationSnapshot {
  title?: string | null;
  summary?: string | null;
  owner_user_id?: number | null;
  preview_url?: string | null;
  values: Record<string, unknown>;
}

export interface ModerationRecord {
  id: number;
  target_type: string;
  target_id: number;
  submitter_user_id?: number | null;
  status: ModerationStatus;
  reason?: string | null;
  reviewer_id?: number | null;
  reviewed_at?: string | null;
  snapshot: ModerationSnapshot;
  created_at: string;
  updated_at: string;
}

export interface ModerationRecordList {
  items: ModerationRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportCreate {
  target_type: string;
  target_id: number;
  reason_type: ReportReasonType;
  description?: string | null;
}

export interface ModerationHandleRequest {
  status: ModerationStatus;
  reason: string;
  report_result?: string | null;
}
