const API_BASE = "/api/v1/templates";

// ============ Types ============
export interface Template {
  id: number;
  name: string;
  description: string | null;
  creator: string;
  modifier: string | null;
  instruction: string;
  systemprompt: string | null;
  storybook_id: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateListItem {
  id: number;
  name: string;
  description: string | null;
  creator: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateTemplateRequest {
  name: string;
  instruction: string;
  creator: string;
  description?: string;
  systemprompt?: string;
  storybook_id?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  instruction?: string;
  systemprompt?: string;
  storybook_id?: number;
  is_active?: boolean;
  sort_order?: number;
  modifier?: string;
}

// ============ API Functions ============

/**
 * 获取模版列表
 */
export const listTemplates = async (params?: {
  creator?: string;
  is_active?: boolean;
  keyword?: string;
  limit?: number;
  offset?: number;
}): Promise<TemplateListItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.creator) queryParams.append("creator", params.creator);
  if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
  if (params?.keyword) queryParams.append("keyword", params.keyword);
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `${API_BASE}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
  return res.json() as Promise<TemplateListItem[]>;
};

/**
 * 获取模版详情
 */
export const getTemplate = async (templateId: number): Promise<Template> => {
  const res = await fetch(`${API_BASE}/${templateId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("模版不存在");
    throw new Error(`Failed to get template: ${res.status}`);
  }
  return res.json() as Promise<Template>;
};

/**
 * 创建模版
 */
export const createTemplate = async (req: CreateTemplateRequest): Promise<Template> => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to create template: ${res.status}`);
  }
  return res.json() as Promise<Template>;
};

/**
 * 更新模版
 */
export const updateTemplate = async (
  templateId: number,
  req: UpdateTemplateRequest
): Promise<Template> => {
  const res = await fetch(`${API_BASE}/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to update template: ${res.status}`);
  }
  return res.json() as Promise<Template>;
};

/**
 * 删除模版
 */
export const deleteTemplate = async (templateId: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/${templateId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to delete template: ${res.status}`);
  }
};
