import { apiClient } from "@/shared/api/client";
import type { ArtStyle, AssetStorageDTO, CharacterRead, CharacterSummary, ListResponse } from "@/entities/asset";
import type { AdminContentOverviewRead, AdminDashboardRead, SystemArtStyleWrite, SystemCharacterWrite } from "./types";

export const adminApi = {
  getDashboard: () => apiClient.get<AdminDashboardRead>("/v1/admin/dashboard"),
  getContentOverview: () => apiClient.get<AdminContentOverviewRead>("/v1/admin/content/overview"),
  listArtStyles: () => apiClient.get<ListResponse<ArtStyle>>("/v1/admin/art-styles"),
  createArtStyle: (payload: SystemArtStyleWrite) => apiClient.post<ArtStyle>("/v1/admin/art-styles", payload),
  updateArtStyle: (id: number, payload: Partial<SystemArtStyleWrite>) =>
    apiClient.patch<ArtStyle>(`/v1/admin/art-styles/${id}`, payload),
  deleteArtStyle: (id: number) => apiClient.delete<void>(`/v1/admin/art-styles/${id}`),
  uploadArtStyleImage: (payload: { base64: string; mime_type: string; filename: string }) =>
    apiClient.post<AssetStorageDTO>("/v1/admin/art-styles/image", payload),
  listCharacters: () => apiClient.get<ListResponse<CharacterSummary>>("/v1/admin/characters"),
  createCharacter: (payload: SystemCharacterWrite) => apiClient.post<CharacterRead>("/v1/admin/characters", payload),
  updateCharacter: (id: number, payload: Partial<SystemCharacterWrite>) =>
    apiClient.patch<CharacterRead>(`/v1/admin/characters/${id}`, payload),
  deleteCharacter: (id: number) => apiClient.delete<void>(`/v1/admin/characters/${id}`),
  uploadCharacterImage: (payload: { base64: string; mime_type: string; filename: string }) =>
    apiClient.post<AssetStorageDTO>("/v1/admin/characters/image", payload),
};
