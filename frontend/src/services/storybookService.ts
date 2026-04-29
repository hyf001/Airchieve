const API_BASE = "/api/v1/storybooks";
import { getAuthHeaders, triggerUnauthorized } from "./authService";
import type { StoryboardItem, VisualAnchor } from "@/types/creation";

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
export type StorybookStatus = "init" | "creating" | "updating" | "finished" | "error" | "terminated";
export type PageStatus = "pending" | "generating" | "finished" | "error";

export type CliType = "gemini" | "doubao";
export type AspectRatio = "1:1" | "16:9" | "4:3";
export type ImageSize = "1k" | "2k" | "4k";
export type PageType = "cover" | "content" | "back_cover";

export interface StorybookPage {
  id: number;
  page_index: number;
  text: string;
  image_url: string;
  storyboard?: StoryboardItem['storyboard'] | null;
  page_type?: PageType;
  status?: PageStatus;
  error_message?: string | null;
}

export interface StorybookPageCreate {
  text: string;
  image_url?: string;
  storyboard?: StorybookPage['storyboard'];
  page_type?: PageType;
}

// ============ Layer Types ============

export type LayerType = 'text' | 'draw' | 'image' | 'sticker' | 'adjustment';

export interface TextLayerContent {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  textAlign: string;
  lineHeight: number;
  backgroundColor: string;
  borderRadius: number;
  rotation: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface DrawLayerContent {
  strokes: Array<{
    points: number[][] | Array<{ x: number; y: number }>;
    color: string;
    brushSize?: number;
    size?: number;
  }>;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ImageLayerContent {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  rotation: number;
  opacity: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export type LayerContent = TextLayerContent | DrawLayerContent | ImageLayerContent | Record<string, unknown>;

export interface StorybookLayer {
  id: number;
  page_id: number;
  layer_type: LayerType;
  layer_index: number;
  visible: boolean;
  locked: boolean;
  content: LayerContent | null;
  created_at: string;
  updated_at: string;
}

export interface StorybookPageWithLayers extends StorybookPage {
  storybook_id: number;
  page_index: number;
  created_at: string;
  updated_at: string;
  layers: StorybookLayer[];
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
  image_style_id?: number | null;
  image_style_version_id?: number | null;
  image_style_name?: string | null;
  image_style_cover_image?: string | null;
  cli_type?: CliType;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
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
  error_message?: string | null;
  cli_type?: CliType;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
  image_style_id?: number | null;
  image_style_version_id?: number | null;
  image_style_name?: string | null;
  image_style_cover_image?: string | null;
}

export interface CreateStorybookRequest {
  instruction: string;
  template_id?: number;
  images?: string[];
  cli_type?: CliType;
  page_count?: number;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
}

export interface StorybookCreateResponse {
  id: number;
  title: string;
  status: StorybookStatus;
  image_style_version_id?: number | null;
}

export interface EditPageAsyncResponse {
  storybook_id: number;
  status: StorybookStatus;
}

export interface InsertPageAsyncResponse {
  storybook_id: number;
  status: StorybookStatus;
}

export interface CreateStoryRequest {
  instruction: string;
  word_count?: number;
  story_type?: 'fairy_tale' | 'adventure' | 'education' | 'scifi' | 'fantasy' | 'animal' | 'daily_life' | 'bedtime_story';
  language?: 'zh' | 'en' | 'ja' | 'ko';
  age_group?: '0_3' | '3_6' | '6_8' | '8_12' | '12_plus';
  cli_type?: CliType;
}

export interface CreateStoryResponse {
  title: string;
  content: string;
}

export interface CreateStorybookFromStoryRequest {
  title: string;
  description: string;
  image_style_id: number;
  cli_type?: CliType;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
  images?: string[];
  visual_anchors?: VisualAnchor[];
  pages: StorybookPageCreate[];
}

// ============ API Functions ============

/**
 * 创建纯文本故事（不含分镜和图片）
 */
export const createStory = async (
  req: CreateStoryRequest
): Promise<CreateStoryResponse> => {
  const res = await fetch(`${API_BASE}/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      instruction: req.instruction,
      word_count: req.word_count || 500,
      story_type: req.story_type || 'fairy_tale',
      language: req.language || 'zh',
      age_group: req.age_group || '3_6',
      cli_type: req.cli_type || 'gemini',
    }),
  });
  if (!res.ok) {
    await handleWriteError(res, '创建故事失败');
  }
  return res.json() as Promise<CreateStoryResponse>;
};

/**
 * 基于故事内容创建绘本（异步，返回绘本 ID，后台生成）
 */
export const createStorybookFromStory = async (
  req: CreateStorybookFromStoryRequest
): Promise<StorybookCreateResponse> => {
  const res = await fetch(`${API_BASE}/from-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      title: req.title,
      description: req.description,
      image_style_id: req.image_style_id,
      images: req.images || [],
      cli_type: req.cli_type || 'gemini',
      aspect_ratio: req.aspect_ratio || '16:9',
      image_size: req.image_size || '1k',
      visual_anchors: req.visual_anchors || [],
      pages: req.pages,
    }),
  });
  if (!res.ok) {
    await handleWriteError(res, '创建绘本失败');
  }
  return res.json() as Promise<StorybookCreateResponse>;
};

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
      cli_type: req.cli_type,
      page_count: req.page_count,
      aspect_ratio: req.aspect_ratio,
      image_size: req.image_size,
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
 * 获取绘本状态（轻量接口，不查询 pages，适��高频轮询）
 */
export interface PageStatusItem {
  id: number;
  page_index: number;
  page_type: PageType;
  status: PageStatus;
  image_url?: string | null;
}

export interface StorybookStatusResult {
  id: number;
  status: StorybookStatus;
  error_message?: string | null;
  updated_at?: string | null;
  total_pages: number;
  completed_pages: number;
  generating_pages: number;
  failed_pages: number;
  pages: PageStatusItem[];
}

export const getStorybookStatus = async (storybookId: number): Promise<StorybookStatusResult> => {
  const res = await fetch(`${API_BASE}/${storybookId}/status`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("绘本不存在");
    throw new Error(`Failed to get storybook status: ${res.status}`);
  }
  return res.json() as Promise<StorybookStatusResult>;
};

/**
 * 获取单个页面详情（含图层列表）
 */
const PAGE_API_BASE = "/api/v1/pages";

export const getPageDetail = async (pageId: number): Promise<StorybookPageWithLayers> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("页面不存在");
    throw new Error(`Failed to get page detail: ${res.status}`);
  }
  return res.json() as Promise<StorybookPageWithLayers>;
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
 * 编辑图片（仅生成图片，不写库）
 * 返回 base64 data URL，前端缓存，用户保存时再调 savePage
 */
export const editPageImage = async (
  storybookId: number,
  imageUrl: string,
  instruction: string,
  referencedImage?: string
): Promise<string> => {
  const res = await fetch(`${API_BASE}/image/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      instruction,
      image_to_edit: imageUrl,
      referenced_image: referencedImage,
      storybook_id: storybookId,
    }),
  });
  if (!res.ok) {
    await handleWriteError(res, "图片生成失败");
  }
  const data = await res.json() as { image: string };
  return data.image;
};

/**
 * 直接保存页面内容（文字 + 图片），不触发 AI
 */
export const savePage = async (
  storybookId: number,
  pageIndex: number,
  text: string,
  imageUrl: string
): Promise<StorybookPage> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/${pageIndex}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ text, image_url: imageUrl }),
  });
  if (!res.ok) {
    await handleWriteError(res, "保存页面失败");
  }
  return res.json() as Promise<StorybookPage>;
};

/**
 * 删除绘本页（至少保留 1 页），返回更新后的绘本
 */
export const deletePage = async (
  storybookId: number,
  pageIndex: number
): Promise<Storybook> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/${pageIndex}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    await handleWriteError(res, "删除页面失败");
  }
  return res.json() as Promise<Storybook>;
};

/**
 * 重新排列页面顺序，返回更新后的绘本
 */
export const reorderPages = async (
  storybookId: number,
  order: number[]
): Promise<Storybook> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) {
    await handleWriteError(res, "排序失败");
  }
  return res.json() as Promise<Storybook>;
};

/**
 * 融合两页，生成新页追加到末尾（异步，轮询）
 */
export const insertPages = async (
  storybookId: number,
  insertPosition: number,
  count: number,
  instruction?: string
): Promise<InsertPageAsyncResponse> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/insert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ insert_position: insertPosition, count, instruction: instruction || "" }),
  });
  if (!res.ok) {
    await handleWriteError(res, "插入页面失败");
  }
  return res.json() as Promise<InsertPageAsyncResponse>;
};

/**
 * 中止正在生成的绘本
 */
export const terminateStorybook = async (storybookId: number): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_BASE}/${storybookId}/terminate`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    await handleWriteError(res, "中止失败");
  }
  return res.json() as Promise<{ success: boolean; message: string }>;
};

/**
 * 页面重新生成请求
 */
export interface RegeneratePageRequest {
  regenerate_text: boolean;
  text_instruction: string;
  regenerate_storyboard: boolean;
  storyboard_instruction: string;
  regenerate_image: boolean;
  image_instruction: string;
  reference_page_ids: number[];
}

export interface RegeneratePageResponse {
  storybook_id: number;
  page_id: number;
  status: string;
}

/**
 * 页面重新生成（异步，轮询绘本 status: updating → finished/error）
 * 按 text -> storyboard -> image 顺序执行，不清空已有图层。
 */
export const regeneratePage = async (
  pageId: number,
  req: RegeneratePageRequest,
): Promise<RegeneratePageResponse> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    await handleWriteError(res, '页面重新生成失败');
  }
  return res.json() as Promise<RegeneratePageResponse>;
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

// ============ Layer API Functions ============

interface LayerCreateData {
  layer_type: string;
  layer_index?: number;
  content?: Record<string, unknown>;
}

interface LayerUpdateData {
  layer_type?: string;
  layer_index?: number;
  visible?: boolean;
  locked?: boolean;
  content?: Record<string, unknown>;
}

/**
 * 创建图层
 */
export const createLayer = async (
  pageId: number,
  data: LayerCreateData
): Promise<StorybookLayer> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}/layers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    await handleWriteError(res, '创建图层失败');
  }
  return res.json() as Promise<StorybookLayer>;
};

/**
 * 更新图层
 */
export const updateLayer = async (
  pageId: number,
  layerId: number,
  data: LayerUpdateData
): Promise<StorybookLayer> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}/layers/${layerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    await handleWriteError(res, '更新图层失败');
  }
  return res.json() as Promise<StorybookLayer>;
};

/**
 * 删除图层
 */
export const deleteLayer = async (
  pageId: number,
  layerId: number
): Promise<void> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}/layers/${layerId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    await handleWriteError(res, '删除图层失败');
  }
};

/**
 * 批量调整图层顺序
 */
export const reorderLayers = async (
  pageId: number,
  layerIds: number[]
): Promise<StorybookLayer[]> => {
  const res = await fetch(`${PAGE_API_BASE}/${pageId}/layers/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ layer_ids: layerIds }),
  });
  if (!res.ok) {
    await handleWriteError(res, '调整图层顺序失败');
  }
  return res.json() as Promise<StorybookLayer[]>;
};

/**
 * 将 OSS 公开直链转换为后端 API 代理路径（用于 Canvas 绘制，避免 CORS）
 * 例：https://bucket.oss-cn-xxx.aliyuncs.com/storybooks/1/page_1.png
 *  → /api/v1/oss/storybooks/1/page_1.png
 */
export const toApiUrl = (url: string): string => {
  if (!url || url.startsWith("data:") || url.startsWith("/")) return url;
  try {
    const { pathname } = new URL(url);
    // pathname 形如 /storybooks/1/page_1.png，去掉开头的 /
    return `/api/v1/oss/${pathname.replace(/^\//, "")}`;
  } catch {
    return url;
  }
};
