import { apiClient } from "@/shared/api/client";
import type { BookPlayerPayload } from "@/entities/book";
import type { PublicShare, ShareAccessScope, ShareLink, ShareLinkList } from "./types";

const passwordQuery = (password?: string) => (password ? `?password=${encodeURIComponent(password)}` : "");

export const shareApi = {
  create: (bookId: number, payload: { access_scope: ShareAccessScope; password?: string | null; privacy_confirmation_id?: number | null; idempotency_key?: string | null }) =>
    apiClient.post<ShareLink>(`/v1/share/book/${bookId}`, payload),
  list: () => apiClient.get<ShareLinkList>("/v1/share/links"),
  update: (shareId: number, payload: Partial<Pick<ShareLink, "access_scope" | "status" | "expires_at">>) =>
    apiClient.patch<ShareLink>(`/v1/share/links/${shareId}`, payload),
  close: (shareId: number) => apiClient.post<ShareLink>(`/v1/share/links/${shareId}/close`),
  regenerateToken: (shareId: number) => apiClient.post<ShareLink>(`/v1/share/links/${shareId}/regenerate-token`),
  getPublic: (token: string, password?: string) => apiClient.get<PublicShare>(`/v1/share/public/${encodeURIComponent(token)}${passwordQuery(password)}`),
  getPublicPlayer: (token: string, password?: string) =>
    apiClient.get<BookPlayerPayload & { share: PublicShare }>(`/v1/share/public/${encodeURIComponent(token)}/player${passwordQuery(password)}`),
};
