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

export interface StorybookCreateResponse {
  id: number;
  title: string;
  status: StorybookStatus;
}

export interface EditPageAsyncResponse {
  storybook_id: number;
  status: StorybookStatus;
}

export interface RegeneratePageAsyncResponse {
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
  imageUrl: string,
  instruction: string
): Promise<string> => {
  const res = await fetch(`${API_BASE}/image/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ instruction, image: imageUrl }),
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
export const regeneratePages = async (
  storybookId: number,
  pageIndices: number[],
  count: number,
  instruction?: string
): Promise<RegeneratePageAsyncResponse> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ page_indices: pageIndices, count, instruction }),
  });
  if (!res.ok) {
    await handleWriteError(res, "融合页面失败");
  }
  return res.json() as Promise<RegeneratePageAsyncResponse>;
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

/**
 * 将 OSS 公开直链转换为后端 API 代理路径（用于 Canvas 绘制，避免 CORS）
 * 例：https://bucket.oss-cn-xxx.aliyuncs.com/storybooks/1/page_1.png
 *  → /api/v1/oss/storybooks/1/page_1.png
 */
const toApiUrl = (url: string): string => {
  if (!url || url.startsWith("data:") || url.startsWith("/")) return url;
  try {
    const { pathname } = new URL(url);
    // pathname 形如 /storybooks/1/page_1.png，去掉开头的 /
    return `/api/v1/oss/${pathname.replace(/^\//, "")}`;
  } catch {
    return url;
  }
};

/**
 * 加载图片为 HTMLImageElement（用于 Canvas 绘制）
 * OSS 直链先转为同源的 /api/v1/oss/... 路径，避免 CORS 污染 Canvas。
 */
const loadImage = async (url: string): Promise<HTMLImageElement | null> => {
  if (!url) return null;
  const src = toApiUrl(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

/**
 * 在浏览器端用 Canvas 为每页单独生成图片，然后合并成 PDF 下载
 * 布局与 EditorView 一致：图片全屏 + 底部渐变遮罩 + 白色文字
 */
export const downloadStorybookImage = async (
  storybook: Storybook,
): Promise<void> => {
  // 动态导入 jsPDF，避免在文件顶部导入导致类型问题
  const { default: jsPDF } = await import('jspdf');

  const pages = storybook.pages || [];
  if (pages.length === 0) throw new Error('绘本无页面内容');

  // 并行加载所有图片
  const images = await Promise.all(pages.map(p => loadImage(p.image_url)));
  const validImages = images.filter((img): img is HTMLImageElement => img !== null);

  // 计算单页尺寸（使用原始图片尺寸，保持分辨率）
  const rawW = validImages.length > 0 ? Math.max(...validImages.map(img => img.naturalWidth)) : 800;
  const rawH = validImages.length > 0 ? Math.max(...validImages.map(img => img.naturalHeight)) : 800;

  // 限制单页最大尺寸，避免内存溢出
  const MAX_PANEL_W = 2000;
  const MAX_PANEL_H = 2000;
  const PANEL_W = Math.min(rawW, MAX_PANEL_W);
  const PANEL_H = Math.min(rawH, MAX_PANEL_H);

  const GRAD_RATIO = 0.42;
  const gradH = Math.floor(PANEL_H * GRAD_RATIO);
  const padding = Math.floor(PANEL_W * 0.05);
  const fontSize = Math.max(22, Math.floor(PANEL_H * 0.030));
  const maxTextW = PANEL_W - padding * 2;

  const fontStack = `${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;

  // 为每一页生成图片
  const pageImages: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // 创建单页 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = PANEL_W;
    canvas.height = PANEL_H;
    const ctx = canvas.getContext('2d')!;

    // 面板底色
    ctx.fillStyle = 'rgb(20, 20, 28)';
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);

    // 图片（letterbox fit，不裁剪）
    const img = images[i];
    if (img) {
      const scale = Math.min(PANEL_W / img.naturalWidth, PANEL_H / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (PANEL_W - w) / 2, (PANEL_H - h) / 2, w, h);
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    }

    // 底部渐变遮罩（transparent → black/75）
    const gradY = PANEL_H - gradH;
    const grad = ctx.createLinearGradient(0, gradY, 0, PANEL_H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gradY, PANEL_W, gradH);

    // 白色文字（带阴影）
    ctx.font = fontStack;
    ctx.textBaseline = 'top';

    const text = page.text || '';
    const lines: string[] = [];
    let cur = '';
    for (const ch of text) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxTextW && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);

    const lineH = fontSize * 1.55;
    const totalH = lines.length * lineH;
    let textY = gradY + (gradH - totalH) / 2;
    textY = Math.max(gradY + padding / 2, textY);

    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'white';
    for (const line of lines) {
      const lw = ctx.measureText(line).width;
      ctx.fillText(line, (PANEL_W - lw) / 2, textY);
      textY += lineH;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 将 Canvas 转换为 JPEG Data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    pageImages.push(dataUrl);
  }

  // 创建 PDF
  const pdf = new jsPDF({
    orientation: PANEL_W > PANEL_H ? 'landscape' : 'portrait',
    unit: 'px',
    format: [PANEL_W, PANEL_H],
  });

  // 将每页图片添加到 PDF
  pageImages.forEach((dataUrl, index) => {
    if (index > 0) {
      pdf.addPage([PANEL_W, PANEL_H]);
    }
    pdf.addImage(dataUrl, 'JPEG', 0, 0, PANEL_W, PANEL_H);
  });

  // 触发下载
  pdf.save(`${storybook.title || 'storybook'}_${storybook.id}.pdf`);
};
