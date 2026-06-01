import { apiClient } from "@/shared/api/client";
import type { AssetStorageDTO, BackgroundMusicSummary, ListResponse, UploadSessionRead } from "@/entities/asset";

export interface BackgroundMusicCreatePayload {
  name: string;
  description?: string | null;
  audio_asset_id: number;
  upload_consent_id?: number | null;
  duration_seconds?: number | null;
}

export interface BackgroundMusicUpdatePayload {
  name?: string;
  description?: string | null;
  audio_asset_id?: number;
  upload_consent_id?: number | null;
  duration_seconds?: number | null;
}

export const backgroundMusicLibraryApi = {
  list: () => apiClient.get<ListResponse<BackgroundMusicSummary>>("/v1/assets/background-music"),
  createUploadSession: (payload: { purpose: "background_music"; filename: string; mime_type: string; byte_size?: number | null }) =>
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
    apiClient.post<AssetStorageDTO>(`/v1/assets/uploads/${id}/complete`, payload),
  create: (payload: BackgroundMusicCreatePayload) => apiClient.post<BackgroundMusicSummary>("/v1/assets/background-music", payload),
  update: (id: number, payload: BackgroundMusicUpdatePayload) =>
    apiClient.patch<BackgroundMusicSummary>(`/v1/assets/background-music/${id}`, payload),
  remove: (id: number) => apiClient.delete<void>(`/v1/assets/background-music/${id}`),
  setDefault: (id: number) => apiClient.post<BackgroundMusicSummary>(`/v1/assets/background-music/${id}/default`),
};
