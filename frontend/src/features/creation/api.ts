import { apiClient } from "@/shared/api/client";

import type {
  ArtStyleRef,
  CharacterRef,
  CreationSession,
  CreationSessionCreatePayload,
  CreationTaskResponse,
  GenerationTaskRead,
  VoiceRef,
} from "./types";

export const creationApi = {
  createSession: (payload: CreationSessionCreatePayload) =>
    apiClient.post<CreationSession>("/v1/creation/sessions", payload),
  listSessions: (childProfileId?: number | null, limit = 10, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (childProfileId) params.set("child_profile_id", String(childProfileId));
    return apiClient.get<CreationSession[]>(`/v1/creation/sessions?${params.toString()}`);
  },
  updateConfig: (
    sessionId: number,
    payload: {
      character_refs?: CharacterRef[];
      art_style_ref?: ArtStyleRef | null;
      voice_ref?: VoiceRef | null;
      target_page_count?: number;
    },
  ) => apiClient.patch<CreationSession>(`/v1/creation/sessions/${sessionId}/config`, payload),
  generateStory: (sessionId: number, ideaPrompt: string) =>
    apiClient.post<CreationTaskResponse>(`/v1/creation/sessions/${sessionId}/generate-story`, {
      idea_prompt: ideaPrompt,
    }),
  generateStoryboard: (sessionId: number) =>
    apiClient.post<CreationTaskResponse>(`/v1/creation/sessions/${sessionId}/generate-storyboard`, {}),
  generateImages: (sessionId: number, pageIds?: number[]) =>
    apiClient.post<CreationTaskResponse>(`/v1/creation/sessions/${sessionId}/generate-images`, {
      page_ids: pageIds ?? null,
    }),
  generateAudio: (sessionId: number, pageIds?: number[]) =>
    apiClient.post<CreationTaskResponse>(`/v1/creation/sessions/${sessionId}/generate-audio`, {
      page_ids: pageIds ?? null,
    }),
  saveBook: (sessionId: number) =>
    apiClient.post<{ session: CreationSession; book: { id: number; title: string } }>(
      `/v1/creation/sessions/${sessionId}/save-book`,
      {},
    ),
  getTask: (taskId: number) => apiClient.get<GenerationTaskRead>(`/v1/generation-tasks/${taskId}`),
  retryTask: (taskId: number) => apiClient.post<GenerationTaskRead>(`/v1/generation-tasks/${taskId}/retry`, {}),
};
