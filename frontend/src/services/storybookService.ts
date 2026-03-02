const API_BASE = "/api/v1/storybooks";
import { getAuthHeaders, triggerUnauthorized } from "./authService";

// ============ 内部工具 ============

export class InsufficientPointsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPointsError";
  }
}

const handleWriteError = async (res: Response, fallback: string): Promise<never> => {
  if (res.status === 401) {
    triggerUnauthorized();
    throw new Error("请先登录");
  }
  const error = await res.json().catch(() => ({ detail: fallback }));
  if (res.status === 402 && error.detail?.code === "INSUFFICIENT_POINTS") {
    throw new InsufficientPointsError(error.detail.message || fallback);
  }
  throw new Error(typeof error.detail === "string" ? error.detail : fallback);
};

// ============ Types ============
export type StorybookStatus = "init" | "creating" | "updating" | "finished" | "error";

export interface StorybookPage {
  text: string;
  image_url: string;
}

export interface Storybook {
  id: number;
  title: string;
  description: string | null;
  creator: string;
  pages: StorybookPage[] | null;
  status: StorybookStatus;
  error_message?: string | null;
  instruction?: string | null;
  template_id?: number | null;
}

export interface StorybookListItem {
  id: number;
  title: string;
  description: string | null;
  creator: string;
  status: StorybookStatus;
  is_public: boolean;
  created_at: string;
  pages: StorybookPage[] | null;
}

export interface CreateStorybookRequest {
  instruction: string;
  template_id?: number;
  images?: string[];
}

export interface EditStorybookRequest {
  instruction: string;
  images?: string[];
}

export interface StorybookCreateResponse {
  id: number;
  title: string;
  status: StorybookStatus;
}

export interface EditPageAsyncResponse {
  storybook_id: number;
  status: StorybookStatus;
}

// ============ API Functions ============

/**
 * 创建绘本（异步，返回绘本 ID，后台生成）
 */
export const createStorybook = async (
  req: CreateStorybookRequest
): Promise<StorybookCreateResponse> => {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      instruction: req.instruction,
      template_id: req.template_id,
      images: req.images || [],
    }),
  });
  if (!res.ok) {
    await handleWriteError(res, "创建绘本失败");
  }
  return res.json() as Promise<StorybookCreateResponse>;
};

/**
 * 获取绘本列表
 */
export const listStorybooks = async (params?: {
  creator?: string;
  title?: string;
  status?: string;
  is_public?: boolean;
  limit?: number;
  offset?: number;
}): Promise<StorybookListItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.creator) queryParams.append("creator", params.creator);
  if (params?.title) queryParams.append("title", params.title);
  if (params?.status) queryParams.append("status", params.status);
  if (params?.is_public !== undefined) queryParams.append("is_public", params.is_public.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${API_BASE}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list storybooks: ${res.status}`);
  return res.json() as Promise<StorybookListItem[]>;
};

/**
 * 获取绘本详情（含 status、error_message，用于轮询）
 */
export const getStorybook = async (storybookId: number): Promise<Storybook> => {
  const res = await fetch(`${API_BASE}/${storybookId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("绘本不存在");
    throw new Error(`Failed to get storybook: ${res.status}`);
  }
  return res.json() as Promise<Storybook>;
};

/**
 * 编辑绘本（异步，创建新版本，返回新绘本 ID）
 */
export const editStorybook = async (
  storybookId: number,
  req: EditStorybookRequest
): Promise<StorybookCreateResponse> => {
  const res = await fetch(`${API_BASE}/${storybookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      instruction: req.instruction,
      images: req.images || [],
    }),
  });
  if (!res.ok) {
    await handleWriteError(res, "编辑绘本失败");
  }
  return res.json() as Promise<StorybookCreateResponse>;
};

/**
 * 编辑绘本单页（异步，返回 storybook_id + status: "updating"）
 * 客户端轮询 GET /{storybook_id} 直到 status !== "updating"
 */
export const editStorybookPage = async (
  storybookId: number,
  pageIndex: number,
  req: { instruction: string }
): Promise<EditPageAsyncResponse> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/${pageIndex}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ instruction: req.instruction }),
  });
  if (!res.ok) {
    await handleWriteError(res, "编辑页面失败");
  }
  return res.json() as Promise<EditPageAsyncResponse>;
};

/**
 * 删除绘本
 */
export const deleteStorybook = async (storybookId: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/${storybookId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    await handleWriteError(res, `Failed to delete storybook: ${res.status}`);
  }
};

/**
 * 更新绘本公开状态
 */
export const updateStorybookPublicStatus = async (
  storybookId: number,
  isPublic: boolean
): Promise<void> => {
  const res = await fetch(`${API_BASE}/${storybookId}/public`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ is_public: isPublic }),
  });
  if (!res.ok) {
    await handleWriteError(res, `Failed to update public status: ${res.status}`);
  }
};
