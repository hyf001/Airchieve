import { apiClient } from "@/shared/api/client";

import type { TaxonomyItem, TaxonomyType } from "./types";

export const taxonomyApi = {
  list: (type?: TaxonomyType, includeDisabled = false) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (includeDisabled) params.set("include_disabled", "true");
    const qs = params.toString();
    return apiClient.get<TaxonomyItem[]>(`/v1/taxonomy${qs ? `?${qs}` : ""}`);
  },

  get: (id: number) => apiClient.get<TaxonomyItem>(`/v1/taxonomy/${id}`),
};
