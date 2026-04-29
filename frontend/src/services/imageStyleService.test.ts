import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createImageStyleReferenceImage,
  deleteImageStyleAsset,
  deleteImageStyleVersion,
  listAdminImageStyles,
  listImageStyleAssets,
  updateImageStyleAsset,
  updateImageStyleVersion,
  uploadImageStyleAsset,
} from './imageStyleService';

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

describe('imageStyleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthHeadersMock.mockReturnValue({ Authorization: 'Bearer test-token' });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('serializes admin style filters and sends auth headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await listAdminImageStyles({ is_active: false, limit: 20, offset: 40 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/image-styles/admin?is_active=false&limit=20&offset=40',
      { headers: { Authorization: 'Bearer test-token' } },
    );
  });

  it('serializes asset filters and sends auth headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await listImageStyleAssets({
      is_active: true,
      style_type: '水彩',
      tag: '柔和',
      limit: 10,
      offset: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/image-style-assets?is_active=true&style_type=%E6%B0%B4%E5%BD%A9&tag=%E6%9F%94%E5%92%8C&limit=10&offset=5',
      { headers: { Authorization: 'Bearer test-token' } },
    );
  });

  it('uploads image style assets with metadata FormData and no JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 3, name: '参考图' }));
    const file = new File(['fake-image'], 'ref.png', { type: 'image/png' });

    await uploadImageStyleAsset(file, {
      name: '参考图',
      description: '柔和水彩',
      tags: ['水彩', '儿童'],
      style_type: '水彩',
      color_tags: ['暖色'],
      texture_tags: ['纸纹'],
      scene_tags: ['森林'],
      subject_tags: ['儿童'],
      composition_tags: ['中心构图'],
      age_group_tags: ['低幼'],
    });

    const [url, init] = lastFetchCall();
    const body = init?.body as FormData;

    expect(url).toBe('/api/v1/image-style-assets/upload');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(body.get('file')).toBe(file);
    expect(body.get('name')).toBe('参考图');
    expect(body.getAll('tags')).toEqual(['水彩', '儿童']);
    expect(body.getAll('color_tags')).toEqual(['暖色']);
    expect(body.getAll('texture_tags')).toEqual(['纸纹']);
    expect(body.getAll('scene_tags')).toEqual(['森林']);
    expect(body.getAll('subject_tags')).toEqual(['儿童']);
    expect(body.getAll('composition_tags')).toEqual(['中心构图']);
    expect(body.getAll('age_group_tags')).toEqual(['低幼']);
  });

  it('creates reference images with asset_id instead of raw urls', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 9, asset_id: 3, url: '/ref.png' }));

    await createImageStyleReferenceImage(1, 2, {
      asset_id: 3,
      is_cover: true,
      sort_order: 4,
      note: '封面参考',
    });

    const [, init] = lastFetchCall();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/image-styles/1/versions/2/reference-images',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      }),
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      asset_id: 3,
      is_cover: true,
      sort_order: 4,
      note: '封面参考',
    });
  });

  it('triggers unauthorized handling for protected endpoints', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: '未登录' }, { status: 401 }));

    await expect(listImageStyleAssets()).rejects.toThrow('请先登录');
    expect(triggerUnauthorizedMock).toHaveBeenCalledTimes(1);
  });

  // ---- 三期新增 service 测试 ----

  it('updates draft version via PUT with partial body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 11, generation_prompt: '新提示词' }));

    const result = await updateImageStyleVersion(1, 11, { generation_prompt: '新提示词' });

    const [url, init] = lastFetchCall();
    expect(url).toBe('/api/v1/image-styles/1/versions/11');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ generation_prompt: '新提示词' });
    expect(result.generation_prompt).toBe('新提示词');
  });

  it('deletes draft version via DELETE', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteImageStyleVersion(1, 11);

    const [url, init] = lastFetchCall();
    expect(url).toBe('/api/v1/image-styles/1/versions/11');
    expect(init?.method).toBe('DELETE');
  });

  it('updates image style asset via PUT', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 3, name: '新名称', is_active: false }));

    const result = await updateImageStyleAsset(3, { name: '新名称', is_active: false });

    const [url, init] = lastFetchCall();
    expect(url).toBe('/api/v1/image-style-assets/3');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ name: '新名称', is_active: false });
    expect(result.name).toBe('新名称');
  });

  it('deletes image style asset via DELETE', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteImageStyleAsset(3);

    const [url, init] = lastFetchCall();
    expect(url).toBe('/api/v1/image-style-assets/3');
    expect(init?.method).toBe('DELETE');
  });
});
