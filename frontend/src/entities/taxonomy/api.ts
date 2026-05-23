import { apiClient } from "@/shared/api/client";

import type { TaxonomyItem, TaxonomyItemStatus, TaxonomyItemWrite, TaxonomyType } from "./types";

export const taxonomyApi = {
  list: (type?: TaxonomyType, includeDisabled = false) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (includeDisabled) params.set("include_disabled", "true");
    const qs = params.toString();
    return apiClient.get<TaxonomyItem[]>(`/v1/taxonomy${qs ? `?${qs}` : ""}`);
  },

  get: (id: number) => apiClient.get<TaxonomyItem>(`/v1/taxonomy/${id}`),
  create: (payload: TaxonomyItemWrite) => apiClient.post<TaxonomyItem>("/v1/admin/taxonomy/items", payload),
  update: (id: number, payload: Partial<Omit<TaxonomyItemWrite, "type">>) =>
    apiClient.patch<TaxonomyItem>(`/v1/admin/taxonomy/items/${id}`, payload),
  updateStatus: (id: number, status: TaxonomyItemStatus) =>
    apiClient.patch<TaxonomyItem>(`/v1/admin/taxonomy/items/${id}/status`, { status }),
};
