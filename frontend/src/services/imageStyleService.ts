import { getAuthHeaders, triggerUnauthorized } from "./authService";

const API_BASE = "/api/v1/image-styles";

// ============ 内部工具 ============
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
  const detail = data.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join("；");
  }
  return fallback;
};

const handleError = async (res: Response, fallback: string): Promise<never> => {
  if (res.status === 401) {
    triggerUnauthorized();
    throw new Error("请先登录");
  }
  const error = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(extractDetail(error, fallback));
};

// ============ Types ============
export interface ReferenceImageCreate {
  url: string;
  is_cover: boolean;
  sort_order: number;
  note?: string | null;
}

export interface ReferenceImage extends ReferenceImageCreate {
  id: number;
  image_style_version_id: number;
  creator: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceImageUpdate {
  url?: string;
  is_cover?: boolean;
  sort_order?: number;
  note?: string | null;
}

export interface ImageStyleListItem {
  id: number;
  name: string;
  description: string | null;
  cover_image: string | null;
  tags: string[];
  current_version_id: number;
  current_version_no: string;
  sort_order: number;
}

export interface ImageStyle {
  id: number;
  name: string;
  description: string | null;
  cover_image: string | null;
  tags: string[];
  current_version_id: number | null;
  current_version_no: string | null;
  is_active: boolean;
  sort_order: number;
  creator: string;
  modifier: string | null;
  created_at: string;
  updated_at: string;
}

export type ImageStyleVersionStatus = "draft" | "published";

export interface ImageStyleVersion {
  id: number;
  image_style_id: number;
  version_no: string;
  style_summary: string | null;
  style_description: string | null;
  generation_prompt: string | null;
  negative_prompt: string | null;
  reference_images: ReferenceImage[];
  status: ImageStyleVersionStatus;
  creator: string;
  created_at: string;
  published_at: string | null;
}

export interface CreateImageStyleRequest {
  name: string;
  description?: string | null;
  cover_image?: string | null;
  tags?: string[];
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateImageStyleRequest {
  name?: string;
  description?: string | null;
  cover_image?: string | null;
  tags?: string[];
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateImageStyleVersionRequest {
  style_summary?: string | null;
  style_description?: string | null;
  generation_prompt?: string | null;
  negative_prompt?: string | null;
  reference_images?: ReferenceImageCreate[];
}

// ============ API Functions ============

/**
 * 获取可用图片风格列表
 */
export const listImageStyles = async (params?: {
  is_active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ImageStyleListItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${API_BASE}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) await handleError(res, `Failed to list image styles: ${res.status}`);
  return res.json() as Promise<ImageStyleListItem[]>;
};

/**
 * 获取图片风格详情
 */
export const getImageStyle = async (styleId: number): Promise<ImageStyle> => {
  const res = await fetch(`${API_BASE}/${styleId}`);
  if (!res.ok) await handleError(res, `Failed to get image style: ${res.status}`);
  return res.json() as Promise<ImageStyle>;
};

/**
 * 创建图片风格
 */
export const createImageStyle = async (req: CreateImageStyleRequest): Promise<ImageStyle> => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to create image style: ${res.status}`);
  return res.json() as Promise<ImageStyle>;
};

/**
 * 更新图片风格基础信息
 */
export const updateImageStyle = async (
  styleId: number,
  req: UpdateImageStyleRequest
): Promise<ImageStyle> => {
  const res = await fetch(`${API_BASE}/${styleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to update image style: ${res.status}`);
  return res.json() as Promise<ImageStyle>;
};

/**
 * 创建图片风格版本草稿
 */
export const createImageStyleVersion = async (
  styleId: number,
  req: CreateImageStyleVersionRequest
): Promise<ImageStyleVersion> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to create image style version: ${res.status}`);
  return res.json() as Promise<ImageStyleVersion>;
};

/**
 * 获取图片风格版本列表
 */
export const listImageStyleVersions = async (styleId: number): Promise<ImageStyleVersion[]> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) await handleError(res, `Failed to list image style versions: ${res.status}`);
  return res.json() as Promise<ImageStyleVersion[]>;
};

/**
 * 新增图片风格版本参考图
 */
export const createImageStyleReferenceImage = async (
  styleId: number,
  versionId: number,
  req: ReferenceImageCreate
): Promise<ReferenceImage> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}/reference-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to create image style reference image: ${res.status}`);
  return res.json() as Promise<ReferenceImage>;
};

/**
 * 更新图片风格版本参考图
 */
export const updateImageStyleReferenceImage = async (
  styleId: number,
  versionId: number,
  imageId: number,
  req: ReferenceImageUpdate
): Promise<ReferenceImage> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}/reference-images/${imageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to update image style reference image: ${res.status}`);
  return res.json() as Promise<ReferenceImage>;
};

/**
 * 删除图片风格版本参考图
 */
export const deleteImageStyleReferenceImage = async (
  styleId: number,
  versionId: number,
  imageId: number
): Promise<void> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}/reference-images/${imageId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) await handleError(res, `Failed to delete image style reference image: ${res.status}`);
};

/**
 * 发布图片风格版本
 */
export const publishImageStyleVersion = async (
  styleId: number,
  versionId: number
): Promise<ImageStyleVersion> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}/publish`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) await handleError(res, `Failed to publish image style version: ${res.status}`);
  return res.json() as Promise<ImageStyleVersion>;
};
