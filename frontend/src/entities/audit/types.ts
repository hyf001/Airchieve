export type AuditOperatorType = "admin" | "system" | "payment_provider";
export type AuditResult = "succeeded" | "failed";

export interface AuditSnapshot {
  values: Record<string, unknown>;
}

export interface AuditLog {
  id: number;
  operator_type: AuditOperatorType;
  operator_id?: number | null;
  action: string;
  target_type: string;
  target_id: number;
  before_snapshot?: AuditSnapshot | null;
  after_snapshot?: AuditSnapshot | null;
  result: AuditResult;
  reason?: string | null;
  request_id?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
