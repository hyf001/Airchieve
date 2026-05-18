import { type BookDetail, type BookListRead } from "@/entities/book";
import { apiClient } from "@/shared/api/client";

export interface BookQuery {
  q?: string;
  theme_code?: string;
  age_range_code?: string;
  language?: string;
  access_level?: string;
  sort?: "featured" | "newest" | "popular";
  limit?: number;
  offset?: number;
}

const toQuery = (query: BookQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
};

export const discoveryApi = {
  listBooks: (query: BookQuery = {}) => {
    const qs = toQuery(query);
    return apiClient.get<BookListRead>(`/v1/books${qs ? `?${qs}` : ""}`);
  },
  getBook: (bookId: number) => apiClient.get<BookDetail>(`/v1/books/${bookId}`),
  startSimilarCreation: (bookId: number) =>
    apiClient.post<{ guidance: string }>(`/v1/books/${bookId}/similar-creation-session`, {}),
};
