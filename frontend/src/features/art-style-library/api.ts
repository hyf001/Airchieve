import { apiClient } from "@/shared/api/client";
import type { ArtStyle, ListResponse } from "@/entities/asset";

export const artStyleLibraryApi = {
  list: () => apiClient.get<ListResponse<ArtStyle>>("/v1/assets/art-styles"),
  createCustom: (payload: { name: string; description: string; prompt?: string | null }) =>
    apiClient.post<ArtStyle>("/v1/assets/custom-art-styles", payload),
};
