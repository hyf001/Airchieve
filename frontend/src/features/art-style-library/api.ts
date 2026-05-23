import { apiClient } from "@/shared/api/client";
import type { ArtStyle, AssetAccessLevel, ListResponse } from "@/entities/asset";

export interface CustomArtStyleWrite {
  code?: string | null;
  name: string;
  description: string;
  prompt?: string | null;
  example_asset_id?: number | null;
  example_url?: string | null;
  example_image_base64?: string | null;
  example_image_mime_type?: string;
  example_image_filename?: string;
  age_range_codes: string[];
  access_level?: AssetAccessLevel;
  sort_order?: number;
  status?: "active" | "inactive";
}

export const artStyleLibraryApi = {
  list: () => apiClient.get<ListResponse<ArtStyle>>("/v1/assets/art-styles"),
  createCustom: (payload: CustomArtStyleWrite) => apiClient.post<ArtStyle>("/v1/assets/custom-art-styles", payload),
  updateCustom: (id: number, payload: Partial<CustomArtStyleWrite>) => apiClient.patch<ArtStyle>(`/v1/assets/custom-art-styles/${id}`, payload),
  deleteCustom: (id: number) => apiClient.delete<void>(`/v1/assets/custom-art-styles/${id}`),
};
