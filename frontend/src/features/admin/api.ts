import { apiClient } from "@/shared/api/client";
import type { ArtStyle, AssetStorageDTO, BackgroundMusicRead, BackgroundMusicSummary, CharacterRead, CharacterSummary, ListResponse, VoiceSummary } from "@/entities/asset";
import type { MembershipPlan, MembershipPlanStatus } from "@/entities/membership";
import type { GenerationTaskRead } from "@/features/creation/types";
import type {
  AdminContentOverviewRead,
  AdminDashboardRead,
  MembershipPlanWrite,
  SystemArtStyleWrite,
  SystemBackgroundMusicWrite,
  SystemCharacterWrite,
  SystemVoiceWrite,
} from "./types";

export const adminApi = {
  getDashboard: () => apiClient.get<AdminDashboardRead>("/v1/admin/dashboard"),
  getContentOverview: () => apiClient.get<AdminContentOverviewRead>("/v1/admin/content/overview"),
  listMembershipPlans: () => apiClient.get<MembershipPlan[]>("/v1/admin/membership/plans"),
  createMembershipPlan: (payload: MembershipPlanWrite) => apiClient.post<MembershipPlan>("/v1/admin/membership/plans", payload),
  updateMembershipPlan: (id: number, payload: Partial<MembershipPlanWrite>) =>
    apiClient.patch<MembershipPlan>(`/v1/admin/membership/plans/${id}`, payload),
  updateMembershipPlanStatus: (id: number, status: MembershipPlanStatus, reason?: string) =>
    apiClient.patch<MembershipPlan>(`/v1/admin/membership/plans/${id}/status`, { status, reason }),
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
  listVoices: () => apiClient.get<ListResponse<VoiceSummary>>("/v1/admin/voices"),
  createVoice: (payload: SystemVoiceWrite) => apiClient.post<VoiceSummary>("/v1/admin/voices", payload),
  updateVoice: (id: number, payload: Partial<SystemVoiceWrite>) => apiClient.patch<VoiceSummary>(`/v1/admin/voices/${id}`, payload),
  deleteVoice: (id: number) => apiClient.delete<void>(`/v1/admin/voices/${id}`),
  uploadVoiceAudio: (payload: { base64: string; mime_type: string; filename: string }) =>
    apiClient.post<AssetStorageDTO>("/v1/admin/voices/audio", payload),
  generateVoiceSample: (payload: {
    voice_id?: number | null;
    voice_style_code: string;
    voice_language?: string | null;
    emotion_type?: string | null;
    sample_text: string;
  }) =>
    apiClient.post<GenerationTaskRead>("/v1/admin/voices/sample", payload),
  listBackgroundMusic: () => apiClient.get<ListResponse<BackgroundMusicSummary>>("/v1/admin/background-music"),
  getBackgroundMusic: (id: number) => apiClient.get<BackgroundMusicRead>(`/v1/admin/background-music/${id}`),
  createBackgroundMusic: (payload: SystemBackgroundMusicWrite) => apiClient.post<BackgroundMusicRead>("/v1/admin/background-music", payload),
  updateBackgroundMusic: (id: number, payload: Partial<SystemBackgroundMusicWrite>) =>
    apiClient.patch<BackgroundMusicRead>(`/v1/admin/background-music/${id}`, payload),
  deleteBackgroundMusic: (id: number) => apiClient.delete<void>(`/v1/admin/background-music/${id}`),
  uploadBackgroundMusicAudio: (payload: { base64: string; mime_type: string; filename: string }) =>
    apiClient.post<AssetStorageDTO>("/v1/admin/background-music/audio", payload),
  getGenerationTask: (taskId: number) => apiClient.get<GenerationTaskRead>(`/v1/generation-tasks/${taskId}`),
};
