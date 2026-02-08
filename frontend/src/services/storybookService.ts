const API_BASE = "/api/v1/storybooks";

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
}

export interface StorybookListItem {
  id: number;
  title: string;
  description: string | null;
  creator: string;
  status: StorybookStatus;
  created_at: string;
}

export interface CreateStorybookRequest {
  instruction: string;
  style_prefix: string;
  images?: string[];
  creator?: string;
}

export interface EditStorybookRequest {
  instruction: string;
}

export interface StreamEvent {
  type: "storybook_created" | "generation_started" | "generation_completed" | "generation_error" | "error";
  data: {
    id?: number;
    title?: string;
    status?: string;
    pages_count?: number;
    message?: string;
    error?: string;
  };
}

export type StreamEventHandler = (event: StreamEvent) => void;

// ============ API Functions ============

/**
 * 流式创建绘本
 * @param req 创建请求
 * @param onEvent 事件回调函数
 * @returns Promise，在流结束时 resolve，返回最终的 storybook ID
 */
export const createStorybookStream = async (
  req: CreateStorybookRequest,
  onEvent: StreamEventHandler
): Promise<number> => {
  const res = await fetch(`${API_BASE}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction: req.instruction,
      style_prefix: req.style_prefix,
      images: req.images || [],
      creator: req.creator || "user",
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to create storybook: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let storybookId: number | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 处理 SSE 格式的数据
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // 保留未完成的行

      for (const line of lines) {
        if (!line.trim()) continue;

        // 解析 SSE 数据行
        const dataLine = line.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;

        const data = dataLine.slice(6); // 移除 "data: " 前缀

        if (data === "[DONE]") {
          return storybookId!;
        }

        try {
          const event: StreamEvent = JSON.parse(data);
          onEvent(event);

          // 提取 storybook ID
          if (event.type === "storybook_created" && event.data.id) {
            storybookId = event.data.id;
          }
        } catch (e) {
          console.error("Failed to parse SSE event:", e);
        }
      }
    }

    return storybookId!;
  } finally {
    reader.releaseLock();
  }
};

/**
 * 获取绘本列表
 */
export const listStorybooks = async (params?: {
  creator?: string;
  title?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<StorybookListItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.creator) queryParams.append("creator", params.creator);
  if (params?.title) queryParams.append("title", params.title);
  if (params?.status) queryParams.append("status", params.status);
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${API_BASE}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list storybooks: ${res.status}`);
  return res.json() as Promise<StorybookListItem[]>;
};

/**
 * 获取绘本详情
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
 * 编辑绘本
 */
export const editStorybook = async (
  storybookId: number,
  req: EditStorybookRequest
): Promise<Storybook> => {
  const res = await fetch(`${API_BASE}/${storybookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction: req.instruction,
    }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to edit storybook: ${res.status}`);
  }
  return res.json() as Promise<Storybook>;
};

/**
 * 编辑绘本单页
 */
export const editStorybookPage = async (
  storybookId: number,
  pageIndex: number,
  req: EditStorybookRequest
): Promise<Storybook> => {
  const res = await fetch(`${API_BASE}/${storybookId}/pages/${pageIndex}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction: req.instruction,
    }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to edit page: ${res.status}`);
  }
  return res.json() as Promise<Storybook>;
};

/**
 * 删除绘本
 */
export const deleteStorybook = async (storybookId: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/${storybookId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to delete storybook: ${res.status}`);
  }
};
