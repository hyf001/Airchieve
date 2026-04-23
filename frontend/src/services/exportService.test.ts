import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EXPORT_OPTIONS,
  exportAsZip,
  estimateLongImage,
  exportAsLongImage,
  exportAsPdf,
  exportStorybook,
  loadPageDetails,
} from './exportService';
import type { Storybook, StorybookPage, StorybookPageWithLayers } from './storybookService';

const {
  createObjectURLMock,
  getPageDetailMock,
  jsPDFMock,
  JSZipMock,
  pdfInstance,
  revokeObjectURLMock,
  toApiUrlMock,
  zipInstance,
} = vi.hoisted(() => {
  const pdfInstance = {
    addPage: vi.fn(),
    addImage: vi.fn(),
    circle: vi.fn(),
    setFillColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  };
  const zipInstance = {
    file: vi.fn(),
    generateAsync: vi.fn(),
  };

  return {
    createObjectURLMock: vi.fn(() => 'blob:storybook-export'),
    getPageDetailMock: vi.fn(),
    jsPDFMock: vi.fn(function JsPDF() {
      return pdfInstance;
    }),
    JSZipMock: vi.fn(function JSZip() {
      return zipInstance;
    }),
    pdfInstance,
    revokeObjectURLMock: vi.fn(),
    toApiUrlMock: vi.fn((url: string) => `/api${url}`),
    zipInstance,
  };
});

vi.mock('./storybookService', () => ({
  getPageDetail: getPageDetailMock,
  toApiUrl: toApiUrlMock,
}));

vi.mock('jspdf', () => ({
  default: jsPDFMock,
}));

vi.mock('jszip', () => ({
  default: JSZipMock,
}));

const canvasContext = {
  save: vi.fn(),
  restore: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  set fillStyle(_value: string) {},
  set font(_value: string) {},
  set globalAlpha(_value: number) {},
  set lineCap(_value: CanvasLineCap) {},
  set lineJoin(_value: CanvasLineJoin) {},
  set lineWidth(_value: number) {},
  set shadowBlur(_value: number) {},
  set shadowColor(_value: string) {},
  set shadowOffsetX(_value: number) {},
  set shadowOffsetY(_value: number) {},
  set strokeStyle(_value: string) {},
  set textAlign(_value: CanvasTextAlign) {},
  set textBaseline(_value: CanvasTextBaseline) {},
};

type ImageSize = {
  width: number;
  height: number;
};

const imageSizes = new Map<string, ImageSize>();

class MockImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = '';

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    if (!value) return;

    const size = imageSizes.get(value);
    queueMicrotask(() => {
      if (!size) {
        this.onerror?.();
        return;
      }
      this.naturalWidth = size.width;
      this.naturalHeight = size.height;
      this.onload?.();
    });
  }
}

const storybook: Storybook = {
  id: 10,
  title: 'Dream:/Story*Book?',
  description: null,
  creator: 'tester',
  pages: [
    { id: 1, text: 'cover', image_url: '/cover.png', page_type: 'cover' },
    { id: 2, text: 'page', image_url: '/page.png', page_type: 'content' },
    { id: 3, text: 'back', image_url: '/back.png', page_type: 'back_cover' },
  ],
  status: 'finished',
  aspect_ratio: '4:3',
};

const pageDetails: StorybookPageWithLayers[] = [
  {
    id: 1,
    text: 'cover',
    image_url: '/cover.png',
    page_type: 'cover',
    storybook_id: 10,
    page_index: 0,
    created_at: '',
    updated_at: '',
    layers: [],
  },
  {
    id: 2,
    text: 'page',
    image_url: '/page.png',
    page_type: 'content',
    storybook_id: 10,
    page_index: 1,
    created_at: '',
    updated_at: '',
    layers: [],
  },
  {
    id: 3,
    text: 'back',
    image_url: '/back.png',
    page_type: 'back_cover',
    storybook_id: 10,
    page_index: 2,
    created_at: '',
    updated_at: '',
    layers: [],
  },
];

describe('exportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageSizes.clear();
    imageSizes.set('/api/cover.png', { width: 800, height: 600 });
    imageSizes.set('/api/page.png', { width: 800, height: 600 });
    imageSizes.set('/api/back.png', { width: 800, height: 600 });
    vi.stubGlobal('Image', MockImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/mock;base64,ok');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });
    zipInstance.generateAsync.mockResolvedValue(new Blob(['zip']));
    getPageDetailMock.mockImplementation((id: number) => {
      const detail = pageDetails.find((page) => page.id === id);
      return Promise.resolve(detail);
    });
  });

  it('loads page details in order and reports progress', async () => {
    const progress = vi.fn();

    const details = await loadPageDetails(storybook.pages as StorybookPage[], progress);

    expect(getPageDetailMock).toHaveBeenNthCalledWith(1, 1);
    expect(getPageDetailMock).toHaveBeenNthCalledWith(2, 2);
    expect(getPageDetailMock).toHaveBeenNthCalledWith(3, 3);
    expect(details.map((page) => page.id)).toEqual([1, 2, 3]);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(progress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('stops loading page details when the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(loadPageDetails(storybook.pages as StorybookPage[], undefined, controller.signal))
      .rejects.toThrow('导出已取消');
    expect(getPageDetailMock).not.toHaveBeenCalled();
  });

  it('estimates long image dimensions and split count from the first page image', async () => {
    imageSizes.set('/api/cover.png', { width: 1200, height: 12000 });

    const estimate = await estimateLongImage(storybook.pages as StorybookPage[]);

    expect(toApiUrlMock).toHaveBeenCalledWith('/cover.png');
    expect(estimate).toEqual({
      pageWidth: 1200,
      pageHeight: 12000,
      totalPages: 3,
      longHeight: 36000,
      willSplit: true,
      parts: 2,
    });
  });

  it('returns null when estimating an empty page list', async () => {
    await expect(estimateLongImage([])).resolves.toBeNull();
  });

  it('exports a pdf with sanitized filename and content page numbers only', async () => {
    const progress = vi.fn();

    await exportAsPdf(
      storybook,
      pageDetails,
      {
        ...DEFAULT_EXPORT_OPTIONS,
        paperSize: 'a4',
        orientation: 'auto',
        safeMargin: true,
        showPageNumbers: true,
      },
      progress,
    );

    expect(jsPDFMock).toHaveBeenCalledWith({
      orientation: 'landscape',
      unit: 'mm',
      format: [297, 210],
    });
    expect(pdfInstance.addPage).toHaveBeenCalledTimes(2);
    expect(pdfInstance.addImage).toHaveBeenCalledTimes(3);
    expect(pdfInstance.setFillColor).toHaveBeenCalledWith(100, 100, 100, 0.5);
    expect(pdfInstance.circle).toHaveBeenCalledTimes(1);
    expect(pdfInstance.setFont).toHaveBeenCalledWith(undefined, 'bold');
    expect(pdfInstance.text).toHaveBeenCalledTimes(1);
    expect(pdfInstance.text).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number), {
      align: 'center',
      baseline: 'middle',
    });
    expect(pdfInstance.save).toHaveBeenCalledWith('Dream__Story_Book_.pdf');
    expect(progress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(progress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('exports a single long png and clicks a download link', async () => {
    const progress = vi.fn();

    await exportAsLongImage(
      storybook,
      pageDetails,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'png' },
      progress,
    );

    const link = document.querySelector('a');
    expect(link).toBeNull();
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenLastCalledWith('image/png', undefined);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(progress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('reports export storybook progress from loaded and exported page counts', async () => {
    const progress = vi.fn();

    await exportStorybook(
      storybook,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'png' },
      progress,
    );

    expect(progress).toHaveBeenNthCalledWith(1, '加载页面数据...', 0);
    expect(progress).toHaveBeenNthCalledWith(2, '加载页面数据...', 10);
    expect(progress).toHaveBeenNthCalledWith(3, '加载页面数据...', 20);
    expect(progress).toHaveBeenNthCalledWith(4, '加载页面数据...', 30);
    expect(progress).toHaveBeenNthCalledWith(5, '导出图片...', 30 + (1 / 3) * 70);
    expect(progress).toHaveBeenNthCalledWith(6, '导出图片...', 30 + (2 / 3) * 70);
    expect(progress).toHaveBeenNthCalledWith(7, '导出图片...', 100);
  });

  it('exports split jpg files when the long image exceeds browser canvas limits', async () => {
    imageSizes.set('/api/cover.png', { width: 800, height: 16000 });
    imageSizes.set('/api/page.png', { width: 800, height: 16000 });
    imageSizes.set('/api/back.png', { width: 800, height: 16000 });

    await exportAsLongImage(
      storybook,
      pageDetails,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'jpg', jpgQuality: 0.72 },
    );

    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.72);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.72);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenNthCalledWith(3, 'image/jpeg', 0.72);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(3);
  });

  it('exports one image per page into a sanitized zip file', async () => {
    const progress = vi.fn();

    await exportAsZip(
      storybook,
      pageDetails,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'jpg', exportMode: 'zip', jpgQuality: 0.72 },
      progress,
    );

    expect(JSZipMock).toHaveBeenCalledTimes(1);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(3);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenLastCalledWith('image/jpeg', 0.72);
    expect(canvasContext.fillRect).toHaveBeenCalledTimes(3);
    expect(zipInstance.file).toHaveBeenNthCalledWith(
      1,
      'Dream__Story_Book_/Dream__Story_Book__1.jpg',
      'ok',
      { base64: true },
    );
    expect(zipInstance.file).toHaveBeenNthCalledWith(
      3,
      'Dream__Story_Book_/Dream__Story_Book__3.jpg',
      'ok',
      { base64: true },
    );
    expect(zipInstance.generateAsync).toHaveBeenCalledWith({ type: 'blob' }, expect.any(Function));
    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:storybook-export');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(progress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('routes zip export through exportStorybook with zip progress text', async () => {
    const progress = vi.fn();

    await exportStorybook(
      storybook,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'png', exportMode: 'zip' },
      progress,
    );

    expect(zipInstance.file).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenNthCalledWith(1, '加载页面数据...', 0);
    expect(progress).toHaveBeenNthCalledWith(2, '加载页面数据...', 10);
    expect(progress).toHaveBeenNthCalledWith(3, '加载页面数据...', 20);
    expect(progress).toHaveBeenNthCalledWith(4, '加载页面数据...', 30);
    expect(progress).toHaveBeenNthCalledWith(5, '导出压缩包...', 30 + (1 / 3) * 70);
    expect(progress).toHaveBeenNthCalledWith(6, '导出压缩包...', 30 + (2 / 3) * 70);
    expect(progress).toHaveBeenNthCalledWith(7, '导出压缩包...', 100);
  });

  it('cancels zip export while the zip file is being generated', async () => {
    const controller = new AbortController();
    zipInstance.generateAsync.mockImplementationOnce((_options, onUpdate) => {
      controller.abort();
      onUpdate();
      return Promise.resolve(new Blob(['zip']));
    });

    await expect(exportAsZip(
      storybook,
      pageDetails,
      { ...DEFAULT_EXPORT_OPTIONS, format: 'png', exportMode: 'zip' },
      undefined,
      { signal: controller.signal },
    )).rejects.toThrow('导出已取消');

    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('rejects exporting a storybook without pages', async () => {
    await expect(exportStorybook({ ...storybook, pages: [] }, DEFAULT_EXPORT_OPTIONS))
      .rejects.toThrow('绘本无页面，无法导出');
  });
});
