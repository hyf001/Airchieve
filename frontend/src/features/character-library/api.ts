import { apiClient } from "@/shared/api/client";
import type { AssetStorageDTO, CharacterRead, CharacterSummary, ListResponse } from "@/entities/asset";

export interface CharacterCreatePayload {
  name: string;
  identity_tag?: string | null;
  description?: string | null;
  reference_character_id?: number | null;
  reference_asset_id?: number | null;
  upload_consent_id?: number | null;
  art_style_id?: number | null;
  custom_art_style_prompt?: string | null;
  generation_prompt?: string | null;
  category_code?: string | null;
}

export const characterLibraryApi = {
  list: () => apiClient.get<ListResponse<CharacterSummary>>("/v1/assets/characters"),
  get: (id: number) => apiClient.get<CharacterRead>(`/v1/assets/characters/${id}`),
  uploadCharacterImage: (payload: { base64: string; mime_type: string; filename: string }) =>
    apiClient.post<AssetStorageDTO>("/v1/assets/characters/image", payload),
  create: (payload: CharacterCreatePayload) => apiClient.post<CharacterRead>("/v1/assets/characters", payload),
  update: (
    id: number,
    payload: Partial<Pick<CharacterCreatePayload, "name" | "identity_tag" | "description" | "art_style_id" | "generation_prompt" | "category_code">> & {
      image_url?: string | null;
    },
  ) =>
    apiClient.patch<CharacterRead>(`/v1/assets/characters/${id}`, payload),
  remove: (id: number) => apiClient.delete<void>(`/v1/assets/characters/${id}`),
  setDefault: (id: number) => apiClient.post<CharacterRead>(`/v1/assets/characters/${id}/default`),
};
