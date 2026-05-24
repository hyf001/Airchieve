import { apiClient } from "@/shared/api/client";

import type { GenerationTaskRead } from "./types";

export const generationTaskApi = {
  getTask: (taskId: number) => apiClient.get<GenerationTaskRead>(`/v1/generation-tasks/${taskId}`),
  retryTask: (taskId: number) => apiClient.post<GenerationTaskRead>(`/v1/generation-tasks/${taskId}/retry`, {}),
};
