import { apiClient } from "@/shared/api/client";
import type { AssetStorageDTO, CharacterRead, CharacterSummary, ListResponse, UploadSessionRead } from "@/entities/asset";

export interface CharacterCreatePayload {
  name: string;
  identity_tag?: string | null;
  description?: string | null;
  reference_asset_id?: number | null;
  upload_consent_id?: number | null;
  art_style_id?: number | null;
  custom_art_style_prompt?: string | null;
  generation_prompt: string;
  category_code?: string | null;
  age_range_codes?: string[];
}

export const characterLibraryApi = {
  list: () => apiClient.get<ListResponse<CharacterSummary>>("/v1/assets/characters"),
  createUploadSession: (payload: { purpose: "character"; filename: string; mime_type: string; byte_size?: number | null }) =>
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
  completeUpload: (id: number, payload: { byte_size?: number | null; asset_kind: "image"; visibility: "private" }) =>
    apiClient.post<AssetStorageDTO>(`/v1/assets/uploads/${id}/complete`, payload),
  create: (payload: CharacterCreatePayload) => apiClient.post<CharacterRead>("/v1/assets/characters", payload),
  update: (id: number, payload: Partial<Pick<CharacterCreatePayload, "name" | "identity_tag" | "description">>) =>
    apiClient.patch<CharacterRead>(`/v1/assets/characters/${id}`, payload),
  remove: (id: number) => apiClient.delete<void>(`/v1/assets/characters/${id}`),
  setDefault: (id: number) => apiClient.post<CharacterRead>(`/v1/assets/characters/${id}/default`),
};
