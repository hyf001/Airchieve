import { apiClient } from "@/shared/api/client";

import type { TemplateListRead, TemplateRead } from "./types";

export const templateApi = {
  listTemplates: () => apiClient.get<TemplateListRead>("/v1/templates"),
  getTemplate: (templateId: number) => apiClient.get<TemplateRead>(`/v1/templates/${templateId}`),
};
