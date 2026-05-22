import { apiClient } from "@/shared/api/client";
import type { ArtStyle, AssetStorageDTO, ListResponse } from "@/entities/asset";
import type { AdminContentOverviewRead, AdminDashboardRead, SystemArtStyleWrite } from "./types";

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
};
