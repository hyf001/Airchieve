import { apiClient } from "@/shared/api/client";
import type { ListResponse, UploadSessionRead, VoiceSummary } from "@/entities/asset";

export interface VoiceCreatePayload {
  name: string;
  source_sample_asset_id: number;
  supported_languages?: string[];
  duration_seconds?: number | null;
  upload_consent_id: number;
}

export const voiceLibraryApi = {
  list: () => apiClient.get<ListResponse<VoiceSummary>>("/v1/assets/voices"),
  createUploadSession: (payload: { purpose: "voice"; filename: string; mime_type: string; byte_size?: number | null }) =>
    apiClient.post<UploadSessionRead>("/v1/assets/uploads", payload),
  uploadToStorage: (session: UploadSessionRead, file: File) =>
    fetch(session.upload_url, {
      method: session.upload_method,
      headers: session.upload_headers,
      body: file,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`OSS 上传失败：${response.status}`);
      }
    }),
  completeUpload: (id: number, payload: { byte_size?: number | null; asset_kind: "audio"; visibility: "private" }) =>
    apiClient.post<{ id: number; storage_key: string; url: string; mime_type: string; byte_size: number | null }>(
      `/v1/assets/uploads/${id}/complete`,
      payload,
    ),
  create: (payload: VoiceCreatePayload) => apiClient.post<VoiceSummary>("/v1/assets/voices", payload),
  update: (id: number, payload: { name?: string }) => apiClient.patch<VoiceSummary>(`/v1/assets/voices/${id}`, payload),
  remove: (id: number) => apiClient.delete<void>(`/v1/assets/voices/${id}`),
  setDefault: (id: number) => apiClient.post<VoiceSummary>(`/v1/assets/voices/${id}/default`),
};
