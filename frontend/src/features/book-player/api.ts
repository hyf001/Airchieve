import { type BookLanguage, type BookPlayerPayload } from "@/entities/book";
import { apiClient } from "@/shared/api/client";

export interface PlayerPayloadQuery {
  childProfileId?: number | null;
  textMode?: BookLanguage;
  voiceId?: number | null;
}

const toQuery = (query: PlayerPayloadQuery) => {
  const params = new URLSearchParams();
  if (query.childProfileId) params.set("child_profile_id", String(query.childProfileId));
  if (query.textMode) params.set("text_mode", query.textMode);
  if (query.voiceId) params.set("voice_id", String(query.voiceId));
  const value = params.toString();
  return value ? `?${value}` : "";
};

export const bookPlayerApi = {
  getPlayerPayload: (bookId: number, query: PlayerPayloadQuery = {}) =>
    apiClient.get<BookPlayerPayload>(`/v1/books/${bookId}/player${toQuery(query)}`),
};
