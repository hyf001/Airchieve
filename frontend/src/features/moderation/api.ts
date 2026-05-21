import { apiClient } from "@/shared/api/client";
import type { ModerationHandleRequest, ModerationRecord, ModerationRecordList, ModerationStatus, ReportCreate } from "./types";

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
};

export const moderationApi = {
  createReport: (payload: ReportCreate) => apiClient.post("/v1/moderation/reports", payload),
  listRecords: (params: { status?: ModerationStatus; target_type?: string; limit?: number; offset?: number } = {}) =>
    apiClient.get<ModerationRecordList>(`/v1/admin/moderation/records${query(params)}`),
  handleRecord: (recordId: number, payload: ModerationHandleRequest) =>
    apiClient.post<ModerationRecord>(`/v1/admin/moderation/records/${recordId}/handle`, payload),
};
