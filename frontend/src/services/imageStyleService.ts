import { getAuthHeaders, triggerUnauthorized } from "./authService";

const API_BASE = "/api/v1/image-styles";
const ASSET_API_BASE = "/api/v1/image-style-assets";

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
  asset_id: number;
  is_cover?: boolean;
  sort_order?: number | null;
  note?: string | null;
}

export interface ReferenceImage {
  id: number;
  image_style_version_id: number;
  asset_id: number | null;
  url: string;
  url_snapshot: string | null;
  is_cover: boolean;
  sort_order: number;
  note: string | null;
  creator: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceImageUpdate {
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
  current_version_id: number | null;
  current_version_no: string | null;
  is_active?: boolean;
  sort_order: number;
  updated_at?: string | null;
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

export interface UpdateImageStyleVersionRequest {
  style_summary?: string | null;
  style_description?: string | null;
  generation_prompt?: string | null;
  negative_prompt?: string | null;
}

export interface ImageStyleAsset {
  id: number;
  url: string;
  object_key: string;
  name: string;
  description: string | null;
  tags: string[];
  style_type: string | null;
  color_tags: string[];
  texture_tags: string[];
  scene_tags: string[];
  subject_tags: string[];
  composition_tags: string[];
  age_group_tags: string[];
  content_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  is_active: boolean;
  reference_count: number;
  creator: string;
  modifier: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImageStyleAssetMetadata {
  name?: string | null;
  description?: string | null;
  tags?: string[];
  style_type?: string | null;
  color_tags?: string[];
  texture_tags?: string[];
  scene_tags?: string[];
  subject_tags?: string[];
  composition_tags?: string[];
  age_group_tags?: string[];
}

export interface UpdateImageStyleAssetRequest extends ImageStyleAssetMetadata {
  is_active?: boolean;
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

export const listAdminImageStyles = async (params?: {
  is_active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ImageStyleListItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${API_BASE}/admin${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url, { headers: { ...getAuthHeaders() } });
  if (!res.ok) await handleError(res, `Failed to list admin image styles: ${res.status}`);
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

export const updateImageStyleVersion = async (
  styleId: number,
  versionId: number,
  req: UpdateImageStyleVersionRequest
): Promise<ImageStyleVersion> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to update image style version: ${res.status}`);
  return res.json() as Promise<ImageStyleVersion>;
};

export const deleteImageStyleVersion = async (styleId: number, versionId: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/${styleId}/versions/${versionId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) await handleError(res, `Failed to delete image style version: ${res.status}`);
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

export const listImageStyleAssets = async (params?: {
  is_active?: boolean;
  style_type?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<ImageStyleAsset[]> => {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
  if (params?.style_type) queryParams.append("style_type", params.style_type);
  if (params?.tag) queryParams.append("tag", params.tag);
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${ASSET_API_BASE}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url, { headers: { ...getAuthHeaders() } });
  if (!res.ok) await handleError(res, `Failed to list image style assets: ${res.status}`);
  return res.json() as Promise<ImageStyleAsset[]>;
};

export const uploadImageStyleAsset = async (
  file: File,
  metadata: ImageStyleAssetMetadata
): Promise<ImageStyleAsset> => {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata.name) formData.append("name", metadata.name);
  if (metadata.description) formData.append("description", metadata.description);
  if (metadata.style_type) formData.append("style_type", metadata.style_type);
  const appendList = (key: string, values?: string[]) => values?.forEach((value) => formData.append(key, value));
  appendList("tags", metadata.tags);
  appendList("color_tags", metadata.color_tags);
  appendList("texture_tags", metadata.texture_tags);
  appendList("scene_tags", metadata.scene_tags);
  appendList("subject_tags", metadata.subject_tags);
  appendList("composition_tags", metadata.composition_tags);
  appendList("age_group_tags", metadata.age_group_tags);

  const res = await fetch(`${ASSET_API_BASE}/upload`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });
  if (!res.ok) await handleError(res, `Failed to upload image style asset: ${res.status}`);
  return res.json() as Promise<ImageStyleAsset>;
};

export const updateImageStyleAsset = async (
  assetId: number,
  req: UpdateImageStyleAssetRequest
): Promise<ImageStyleAsset> => {
  const res = await fetch(`${ASSET_API_BASE}/${assetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) await handleError(res, `Failed to update image style asset: ${res.status}`);
  return res.json() as Promise<ImageStyleAsset>;
};

export const deleteImageStyleAsset = async (assetId: number): Promise<void> => {
  const res = await fetch(`${ASSET_API_BASE}/${assetId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) await handleError(res, `Failed to delete image style asset: ${res.status}`);
};
