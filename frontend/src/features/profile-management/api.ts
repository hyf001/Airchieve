import { apiClient } from "@/shared/api/client";
import { type ChildProfile, type ChildProfilePayload } from "./types";

export const profileApi = {
  listProfiles: () => apiClient.get<ChildProfile[]>("/v1/account/child-profiles"),
  createProfile: (payload: ChildProfilePayload) =>
    apiClient.post<ChildProfile>("/v1/account/child-profiles", { ...payload }),
  updateProfile: (profileId: number, payload: ChildProfilePayload) =>
    apiClient.patch<ChildProfile>(`/v1/account/child-profiles/${profileId}`, { ...payload }),
  deleteProfile: (profileId: number) => apiClient.delete<void>(`/v1/account/child-profiles/${profileId}`),
  setDefaultProfile: (profileId: number) =>
    apiClient.post<ChildProfile>(`/v1/account/child-profiles/${profileId}/default`),
};
