/**
 * 分镜相关 API
 */
import { getAuthHeaders, triggerUnauthorized } from './authService';
import type { CliType } from './storybookService';
import type { StoryboardItem, VisualAnchor } from '../types/creation';

const API_BASE = '/api/v1/storybooks';

// ============ Types ============

export interface GenerateStoryboardRequest {
  title?: string;
  story_content: string;
  page_count: number;
  cli_type: CliType;
  image_style_id: number;
  has_character_reference_images: boolean;
}

export interface GenerateStoryboardResponse {
  storyboards: StoryboardItem[];
  visual_anchors: VisualAnchor[];
}

// ============ API Functions ============

/**
 * 生成分镜（不扣费，不保存）
 */
export async function generateStoryboard(
  req: GenerateStoryboardRequest
): Promise<GenerateStoryboardResponse> {
  const res = await fetch(`${API_BASE}/storyboard`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    if (res.status === 401) {
      triggerUnauthorized();
      throw new Error('请先登录');
    }
    const error = await res.json().catch(() => ({ detail: '生成分镜失败' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : '生成分镜失败');
  }

  return res.json();
}
