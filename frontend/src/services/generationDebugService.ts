import { getAuthHeaders, triggerUnauthorized } from './authService';

const API_BASE = '/api/v1/generation-debug';

export interface GenerationDebugStoryboard {
  summary: string;
  visual_brief: string;
  anchor_refs: string[];
  must_include: string[];
  composition: string;
  avoid: string[];
}

export interface GenerationDebugVisualAnchor {
  id: string;
  type: string;
  name: string;
  description: string;
  key_attributes: string[];
}

export interface PageGenerationDebugParams {
  cli_type: string;
  page_index: number;
  story_text: string;
  storyboard: GenerationDebugStoryboard | null;
  story_context: string[];
  visual_anchors: GenerationDebugVisualAnchor[];
  image_style_id: number | null;
  image_style_version_id: number | null;
  style_name: string;
  style_generation_prompt: string;
  style_negative_prompt: string;
  style_reference_images: string[];
  aspect_ratio: string;
  image_size: string;
  image_instruction: string;
  previous_page_image: string | null;
  character_reference_images: string[];
  selected_reference_page_images: string[];
}

export interface GenerationDebugStorybookItem {
  id: number;
  title: string;
  status: string;
  image_style_id: number | null;
  image_style_version_id: number | null;
  cli_type: string;
  page_count: number;
  created_at: string;
}

export interface GenerationDebugPageItem {
  id: number;
  page_index: number;
  content_page_index: number;
  text: string;
  image_url: string;
  status: string;
  storyboard: Record<string, unknown> | null;
}

export interface GenerationDebugPageContext {
  display_context: {
    storybook_id: number;
    storybook_title: string;
    page_id: number;
    page_index: number;
    content_page_index: number;
    page_status: string;
    image_url: string;
    story_text: string;
    storyboard: Record<string, unknown> | null;
    visual_anchors: Record<string, unknown>[];
    image_style_id: number | null;
    image_style_version_id: number | null;
    style_name: string;
  };
  debug_params: PageGenerationDebugParams;
}

export interface GenerationDebugInputResource {
  role: string;
  url: string;
  source: string;
  source_id: number | null;
  sort_order: number;
  note: string;
}

export interface GenerationDebugPromptPreview {
  prompt: string;
  input_resources: GenerationDebugInputResource[];
}

export interface GenerationDebugRun {
  id: number;
  storybook_id: number;
  page_id: number;
  admin_user_id: number;
  status: string;
  debug_params: PageGenerationDebugParams;
  output_image_url: string | null;
  error_message: string | null;
  rating: number | null;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    triggerUnauthorized();
    throw new Error('请先登录');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || '请求失败');
  return data as T;
};

export const searchDebugStorybooks = (q: string): Promise<GenerationDebugStorybookItem[]> =>
  request(`${API_BASE}/storybooks?q=${encodeURIComponent(q)}`);

export const listDebugPages = (storybookId: number): Promise<GenerationDebugPageItem[]> =>
  request(`${API_BASE}/storybooks/${storybookId}/pages`);

export const getDebugPageContext = (pageId: number): Promise<GenerationDebugPageContext> =>
  request(`${API_BASE}/pages/${pageId}/context`);

export const previewDebugPrompt = (
  pageId: number,
  params: PageGenerationDebugParams,
): Promise<GenerationDebugPromptPreview> =>
  request(`${API_BASE}/pages/${pageId}/prompt-preview`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const createDebugRun = (
  pageId: number,
  params: PageGenerationDebugParams,
): Promise<GenerationDebugRun> =>
  request(`${API_BASE}/pages/${pageId}/runs`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const listDebugRuns = (pageId: number): Promise<GenerationDebugRun[]> =>
  request(`${API_BASE}/pages/${pageId}/runs`);

export const updateDebugRun = (
  runId: number,
  req: { rating?: number | null; tags?: string[]; notes?: string },
): Promise<GenerationDebugRun> =>
  request(`${API_BASE}/runs/${runId}`, {
    method: 'PATCH',
    body: JSON.stringify(req),
  });
