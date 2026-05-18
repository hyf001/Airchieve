import { type BookSummary } from "@/entities/book";
import { apiClient } from "@/shared/api/client";
import {
  type FavoriteRead,
  type ReadingEventPayload,
  type ReadingProgressPayload,
  type ReadingProgressRead,
  type RecentReadSummary,
} from "./types";

const scopedQuery = (childProfileId?: number | null, limit?: number) => {
  const params = new URLSearchParams();
  if (childProfileId) params.set("child_profile_id", String(childProfileId));
  if (limit) params.set("limit", String(limit));
  const value = params.toString();
  return value ? `?${value}` : "";
};

export const readingApi = {
  listRecent: (childProfileId?: number | null, limit = 10) =>
    apiClient.get<RecentReadSummary[]>(`/v1/reading/recent${scopedQuery(childProfileId, limit)}`),
  listFavorites: (childProfileId?: number | null, limit = 20) =>
    apiClient.get<BookSummary[]>(`/v1/reading/favorites${scopedQuery(childProfileId, limit)}`),
  getFavorite: (bookId: number, childProfileId?: number | null) =>
    apiClient.get<FavoriteRead | null>(`/v1/reading/favorites/${bookId}${scopedQuery(childProfileId)}`),
  toggleFavorite: (bookId: number, childProfileId?: number | null) =>
    apiClient.post<FavoriteRead>("/v1/reading/favorites/toggle", {
      book_id: bookId,
      child_profile_id: childProfileId ?? null,
    }),
  getProgress: (bookId: number, childProfileId?: number | null) =>
    apiClient.get<ReadingProgressRead | null>(`/v1/reading/progress/${bookId}${scopedQuery(childProfileId)}`),
  saveProgress: (bookId: number, payload: ReadingProgressPayload) =>
    apiClient.put<ReadingProgressRead>(`/v1/reading/progress/${bookId}`, { ...payload }),
  recordEvent: (payload: ReadingEventPayload) => apiClient.post<void>("/v1/reading/events", { ...payload }),
};
