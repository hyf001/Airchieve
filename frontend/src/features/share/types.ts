export type ShareAccessScope = "public" | "password" | "specified";
export type ShareLinkStatus = "active" | "closed" | "banned" | "expired";

export interface ShareLink {
  id: number;
  user_id: number;
  book_id: number;
  title_snapshot: string;
  cover_url_snapshot: string | null;
  access_scope: ShareAccessScope;
  status: ShareLinkStatus;
  privacy_confirmation_id: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  token: string | null;
  public_url: string | null;
  access_count: number;
}

export interface ShareLinkList {
  items: ShareLink[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublicShare {
  id: number;
  book_id: number;
  title: string;
  cover_url: string | null;
  access_scope: ShareAccessScope;
  status: ShareLinkStatus;
  expires_at: string | null;
}
