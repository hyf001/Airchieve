import { apiClient } from "@/shared/api/client";
import type { ExportJob, ExportJobList, ExportQuality } from "./types";

export const exportApi = {
  create: (bookId: number, quality: ExportQuality, privacyConfirmationId?: number | null, idempotencyKey?: string | null) =>
    apiClient.post<ExportJob>(`/v1/export/book/${bookId}`, {
      export_type: "pdf",
      quality,
      privacy_confirmation_id: privacyConfirmationId,
      idempotency_key: idempotencyKey,
    }),
  list: () => apiClient.get<ExportJobList>("/v1/export/jobs"),
  getFileUrl: (exportId: number) => apiClient.get<{ export_id: number; file_url: string; expires_at: string | null }>(`/v1/export/jobs/${exportId}/file-url`),
};
