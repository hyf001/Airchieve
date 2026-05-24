import { type StoryDetail, type StoryGeneratePayload, type StoryGenerationTaskResponse, type StoryListRead, type StoryPayload } from "@/entities/story";
import { apiClient } from "@/shared/api/client";

export const storyLibraryApi = {
  listStories: (sourceType?: string) =>
    apiClient.get<StoryListRead>(`/v1/stories${sourceType ? `?source_type=${sourceType}` : ""}`),
  getStory: (storyId: number) => apiClient.get<StoryDetail>(`/v1/stories/${storyId}`),
  createStory: (payload: StoryPayload) => apiClient.post<StoryDetail>("/v1/stories", { ...payload }),
  generateStory: (payload: StoryGeneratePayload) => apiClient.post<StoryGenerationTaskResponse>("/v1/stories/generate", payload),
  updateStory: (storyId: number, payload: StoryPayload) => apiClient.patch<StoryDetail>(`/v1/stories/${storyId}`, payload),
  deleteStory: (storyId: number) => apiClient.delete<void>(`/v1/stories/${storyId}`),
  startCreation: (storyId: number) =>
    apiClient.post<{ guidance: string }>(`/v1/stories/${storyId}/start-creation`, {}),
};
