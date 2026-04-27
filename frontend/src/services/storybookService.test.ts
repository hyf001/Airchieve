import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStory,
  createStorybookFromStory,
  editPageImage,
  getStorybookStatus,
  InsufficientPointsError,
  listStorybooks,
  regeneratePage,
  toApiUrl,
} from './storybookService';

const { getAuthHeadersMock, triggerUnauthorizedMock } = vi.hoisted(() => ({
  getAuthHeadersMock: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  triggerUnauthorizedMock: vi.fn(),
}));

vi.mock('./authService', () => ({
  getAuthHeaders: getAuthHeadersMock,
  triggerUnauthorized: triggerUnauthorizedMock,
}));

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const lastFetchCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];

const lastJsonBody = () => {
  const [, init] = lastFetchCall();
  return JSON.parse(init?.body as string);
};

describe('storybookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthHeadersMock.mockReturnValue({ Authorization: 'Bearer test-token' });
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('createStory', () => {
    it('posts defaults and auth headers when optional fields are omitted', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ title: '星星灯', content: '故事内容' }));

      const result = await createStory({ instruction: '写一个睡前故事' });

      expect(result).toEqual({ title: '星星灯', content: '故事内容' });
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/storybooks/story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          instruction: '写一个睡前故事',
          word_count: 500,
          story_type: 'fairy_tale',
          language: 'zh',
          age_group: '3_6',
          cli_type: 'gemini',
        }),
      });
    });

    it('throws InsufficientPointsError for 402 insufficient points responses', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { detail: { code: 'INSUFFICIENT_POINTS', message: '积分不足' } },
        { status: 402 },
      ));

      const promise = createStory({ instruction: '写一个故事' });

      await expect(promise).rejects.toMatchObject({
        name: 'InsufficientPointsError',
        message: '积分不足',
      });
      await expect(promise).rejects.toBeInstanceOf(InsufficientPointsError);
    });

    it('triggers unauthorized handling for 401 responses', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: '未登录' }, { status: 401 }));

      await expect(createStory({ instruction: '写一个故事' })).rejects.toThrow('请先登录');
      expect(triggerUnauthorizedMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('createStorybookFromStory', () => {
    it('posts pages with creation defaults', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7, title: '星星灯', status: 'init' }));

      await createStorybookFromStory({
        title: '星星灯',
        description: '一只小熊寻找星星灯',
        image_style_id: 1,
        pages: [
          {
            text: '封面',
            page_type: 'cover',
            storyboard: {
              summary: '小熊站在森林里',
              scene: '森林',
              characters: '小熊',
              shot: '封面构图',
            },
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/storybooks/from-story', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      }));
      expect(lastJsonBody()).toEqual({
        title: '星星灯',
        description: '一只小熊寻找星星灯',
        image_style_id: 1,
        images: [],
        cli_type: 'gemini',
        aspect_ratio: '16:9',
        image_size: '1k',
        pages: [
          {
            text: '封面',
            page_type: 'cover',
            storyboard: {
              summary: '小熊站在森林里',
              scene: '森林',
              characters: '小熊',
              shot: '封面构图',
            },
          },
        ],
      });
    });
  });

  describe('listStorybooks', () => {
    it('serializes filters into query parameters', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await listStorybooks({
        creator: '42',
        title: '星星',
        status: 'finished',
        is_public: false,
        limit: 10,
        offset: 20,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/storybooks?creator=42&title=%E6%98%9F%E6%98%9F&status=finished&is_public=false&limit=10&offset=20',
      );
    });

    it('throws status-specific error on failed list requests', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'oops' }, { status: 500 }));

      await expect(listStorybooks()).rejects.toThrow('Failed to list storybooks: 500');
    });
  });

  describe('getStorybookStatus', () => {
    it('returns status progress payload', async () => {
      const payload = {
        id: 9,
        status: 'creating',
        error_message: null,
        updated_at: '2026-04-23T00:00:00',
        total_pages: 4,
        completed_pages: 2,
        generating_pages: 1,
        failed_pages: 0,
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(payload));

      await expect(getStorybookStatus(9)).resolves.toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/storybooks/9/status');
    });

    it('maps 404 to a user-facing missing storybook error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'not found' }, { status: 404 }));

      await expect(getStorybookStatus(404)).rejects.toThrow('绘本不存在');
    });
  });

  describe('editPageImage', () => {
    it('posts image edit payload and returns the generated image', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ image: 'data:image/png;base64,ok' }));

      const image = await editPageImage(3, '/page.png', '换成夜晚', '/ref.png');

      expect(image).toBe('data:image/png;base64,ok');
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/storybooks/image/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          instruction: '换成夜晚',
          image_to_edit: '/page.png',
          referenced_image: '/ref.png',
          storybook_id: 3,
        }),
      });
    });
  });

  describe('regeneratePage', () => {
    it('posts regenerate request to the page endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        storybook_id: 8,
        page_id: 12,
        status: 'updating',
      }));
      const request = {
        regenerate_text: true,
        text_instruction: '文字更温柔',
        regenerate_storyboard: true,
        storyboard_instruction: '构图更近',
        regenerate_image: true,
        image_instruction: '画面更明亮',
        reference_page_ids: [2, 4],
      };

      const result = await regeneratePage(12, request);

      expect(result).toEqual({ storybook_id: 8, page_id: 12, status: 'updating' });
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/pages/12/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(request),
      });
    });

    it('uses readable fallback text when regenerate response has no JSON detail', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));

      await expect(regeneratePage(12, {
        regenerate_text: false,
        text_instruction: '',
        regenerate_storyboard: false,
        storyboard_instruction: '',
        regenerate_image: true,
        image_instruction: '',
        reference_page_ids: [],
      })).rejects.toThrow('页面重新生成失败');
    });
  });

  describe('toApiUrl', () => {
    it('keeps data urls and relative urls unchanged', () => {
      expect(toApiUrl('data:image/png;base64,ok')).toBe('data:image/png;base64,ok');
      expect(toApiUrl('/local.png')).toBe('/local.png');
    });

    it('converts remote oss urls to backend proxy urls', () => {
      expect(toApiUrl('https://bucket.oss-cn.example.com/storybooks/1/page.png'))
        .toBe('/api/v1/oss/storybooks/1/page.png');
    });

    it('keeps invalid urls unchanged', () => {
      expect(toApiUrl('not a url')).toBe('not a url');
    });
  });
});
