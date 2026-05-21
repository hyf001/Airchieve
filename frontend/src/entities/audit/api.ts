import { apiClient } from "@/shared/api/client";
import type { AuditLogList } from "./types";

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
};

export const auditApi = {
  listLogs: (params: { action?: string; target_type?: string; operator_id?: number; limit?: number; offset?: number } = {}) =>
    apiClient.get<AuditLogList>(`/v1/admin/audit/logs${query(params)}`),
};
