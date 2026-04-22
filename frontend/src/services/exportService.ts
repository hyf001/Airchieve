import {
  Storybook,
  StorybookPage,
  StorybookPageWithLayers,
  StorybookLayer,
  TextLayerContent,
  DrawLayerContent,
  ImageLayerContent,
  getPageDetail,
  toApiUrl,
} from './storybookService';

// ============ Types ============

export type ExportFormat = 'pdf' | 'png' | 'jpg';
export type PaperSize = 'original' | 'a4' | 'a5' | 'square-210';
export type PaperOrientation = 'auto' | 'portrait' | 'landscape';
export type FitMode = 'contain' | 'cover';

export interface ExportOptions {
  format: ExportFormat;
  paperSize: PaperSize;
  orientation: PaperOrientation;
  fitMode: FitMode;
  safeMargin: boolean;
  showPageNumbers: boolean;
  dpi: number;
  jpgQuality: number;
}

export interface ExportRuntimeOptions {
  signal?: AbortSignal;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  paperSize: 'original',
  orientation: 'auto',
  fitMode: 'contain',
  safeMargin: false,
  showPageNumbers: true,
  dpi: 300,
  jpgQuality: 0.92,
};

export const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  'square-210': { width: 210, height: 210 },
};

export const JPG_QUALITY_OPTIONS = [
  { label: '高质量', value: 0.92 },
  { label: '标准质量', value: 0.82 },
  { label: '小体积', value: 0.72 },
];

const MAX_CANVAS_SIDE = 30000;
const SAFE_MARGIN_MM = 5;
const FALLBACK_CANVAS_WIDTH = 800;

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new Error('导出已取消');
  }
};

// ============ Image Loading ============

const loadImage = (url: string, signal?: AbortSignal): Promise<HTMLImageElement | null> => {
  if (!url) return Promise.resolve(null);
  const src = toApiUrl(url);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('导出已取消'));
      return;
    }
    const img = new Image();
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      img.src = '';
      reject(new Error('导出已取消'));
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      resolve(null);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    img.src = src;
  });
};

// ============ Page Detail Loading ============

export const loadPageDetails = async (
  pages: StorybookPage[],
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<StorybookPageWithLayers[]> => {
  const details: StorybookPageWithLayers[] = [];
  for (let i = 0; i < pages.length; i++) {
    throwIfAborted(signal);
    const detail = await getPageDetail(pages[i].id);
    details.push(detail);
    onProgress?.(i + 1, pages.length);
  }
  return details;
};

// ============ Layer Rendering ============

const isTextContent = (c: unknown): c is TextLayerContent =>
  typeof c === 'object' && c !== null && 'text' in c && 'fontFamily' in c;

const isDrawContent = (c: unknown): c is DrawLayerContent =>
  typeof c === 'object' && c !== null && 'strokes' in c && !('text' in c);

const isImageContent = (c: unknown): c is ImageLayerContent =>
  typeof c === 'object' && c !== null && 'url' in c && !('strokes' in c);

type ScalableLayerContent = {
  canvasWidth?: number;
  canvasHeight?: number;
};

const getFallbackCanvasSize = (
  storybook: Storybook | undefined,
  outputW: number,
  outputH: number,
) => {
  const aspectRatio = storybook?.aspect_ratio;
  if (aspectRatio === '1:1') return { width: FALLBACK_CANVAS_WIDTH, height: FALLBACK_CANVAS_WIDTH };
  if (aspectRatio === '4:3') return { width: FALLBACK_CANVAS_WIDTH, height: Math.round(FALLBACK_CANVAS_WIDTH * 3 / 4) };
  if (aspectRatio === '16:9') return { width: FALLBACK_CANVAS_WIDTH, height: Math.round(FALLBACK_CANVAS_WIDTH * 9 / 16) };

  const ratio = outputW / outputH;
  return { width: FALLBACK_CANVAS_WIDTH, height: Math.round(FALLBACK_CANVAS_WIDTH / ratio) };
};

const getLayerScale = (
  content: ScalableLayerContent,
  outputW: number,
  outputH: number,
  storybook?: Storybook,
) => {
  const sourceW = content.canvasWidth && content.canvasWidth > 0
    ? content.canvasWidth
    : getFallbackCanvasSize(storybook, outputW, outputH).width;
  const sourceH = content.canvasHeight && content.canvasHeight > 0
    ? content.canvasHeight
    : getFallbackCanvasSize(storybook, outputW, outputH).height;

  return {
    scaleX: outputW / sourceW,
    scaleY: outputH / sourceH,
  };
};

const getPoint = (point: number[] | { x: number; y: number }) => {
  if (Array.isArray(point)) return { x: point[0] ?? 0, y: point[1] ?? 0 };
  return point;
};

const renderTextLayer = async (
  ctx: CanvasRenderingContext2D,
  content: TextLayerContent,
  scaleX: number,
  scaleY: number,
) => {
  ctx.save();

  const x = content.x * scaleX;
  const y = content.y * scaleY;
  const w = content.width * scaleX;
  const h = content.height * scaleY;
  const fontSize = content.fontSize * Math.min(scaleX, scaleY);
  const fontFamily = content.fontFamily || '"PingFang SC", "Microsoft YaHei", sans-serif';
  const fontWeight = content.fontWeight || 'normal';
  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  if ('fonts' in document) {
    try {
      await document.fonts.load(font);
    } catch (err) {
      console.warn('导出字体加载失败，使用浏览器默认回退字体:', err);
    }
  }

  ctx.translate(x + w / 2, y + h / 2);
  if (content.rotation) {
    ctx.rotate((content.rotation * Math.PI) / 180);
  }

  const localX = -w / 2;
  const localY = -h / 2;

  if (content.backgroundColor && content.backgroundColor !== 'transparent') {
    const radius = (content.borderRadius || 0) * Math.min(scaleX, scaleY);
    ctx.fillStyle = content.backgroundColor;
    if (radius > 0) {
      roundRect(ctx, localX, localY, w, h, radius);
      ctx.fill();
    } else {
      ctx.fillRect(localX, localY, w, h);
    }
  }

  ctx.font = font;
  ctx.fillStyle = content.fontColor || '#000000';
  ctx.textBaseline = 'top';
  ctx.textAlign = (content.textAlign as CanvasTextAlign) || 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(1, fontSize * 0.12);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, fontSize * 0.04);

  const lineHeight = fontSize * (content.lineHeight || 1.4);
  const padding = fontSize * 0.15;
  const maxW = w - padding * 2;

  const lines = wrapText(ctx, content.text || '', maxW);
  const totalTextH = lines.length * lineHeight;
  const startY = localY + (h - totalTextH) / 2;

  let textX: number;
  if (content.textAlign === 'center') {
    textX = 0;
  } else if (content.textAlign === 'right') {
    textX = localX + w - padding;
  } else {
    textX = localX + padding;
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, startY + i * lineHeight);
  }

  ctx.restore();
};

const renderDrawLayer = (
  ctx: CanvasRenderingContext2D,
  content: DrawLayerContent,
  scaleX: number,
  scaleY: number,
) => {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of content.strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.strokeStyle = stroke.color;
    const brushSize = stroke.brushSize ?? stroke.size ?? 1;
    ctx.lineWidth = brushSize * Math.min(scaleX, scaleY);
    const firstPoint = getPoint(stroke.points[0]);
    if (stroke.points.length === 1) {
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(firstPoint.x * scaleX, firstPoint.y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
    for (let i = 1; i < stroke.points.length; i++) {
      const point = getPoint(stroke.points[i]);
      ctx.lineTo(point.x * scaleX, point.y * scaleY);
    }
    ctx.stroke();
  }

  ctx.restore();
};

const renderImageLayer = async (
  ctx: CanvasRenderingContext2D,
  content: ImageLayerContent,
  scaleX: number,
  scaleY: number,
  signal?: AbortSignal,
) => {
  const img = await loadImage(content.url, signal);
  if (!img) return;

  ctx.save();

  const x = content.x * scaleX;
  const y = content.y * scaleY;
  const w = content.width * scaleX;
  const h = content.height * scaleY;

  if (content.opacity !== undefined && content.opacity < 1) {
    ctx.globalAlpha = content.opacity;
  }

  if (content.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((content.rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
};

const renderLayer = async (
  ctx: CanvasRenderingContext2D,
  layer: StorybookLayer,
  outputW: number,
  outputH: number,
  storybook?: Storybook,
  signal?: AbortSignal,
) => {
  if (!layer.visible || !layer.content) return;

  if (layer.layer_type === 'text' && isTextContent(layer.content)) {
    const { scaleX, scaleY } = getLayerScale(layer.content, outputW, outputH, storybook);
    await renderTextLayer(ctx, layer.content, scaleX, scaleY);
  } else if (layer.layer_type === 'draw' && isDrawContent(layer.content)) {
    const { scaleX, scaleY } = getLayerScale(layer.content, outputW, outputH, storybook);
    renderDrawLayer(ctx, layer.content, scaleX, scaleY);
  } else if (layer.layer_type === 'image' && isImageContent(layer.content)) {
    const { scaleX, scaleY } = getLayerScale(layer.content, outputW, outputH, storybook);
    await renderImageLayer(ctx, layer.content, scaleX, scaleY, signal);
  }
  // sticker/adjustment layers skipped
};

// ============ Page Artwork Rendering ============

export const renderPageArtwork = async (
  pageDetail: StorybookPageWithLayers,
  storybook?: Storybook,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> => {
  throwIfAborted(signal);
  const img = await loadImage(pageDetail.image_url, signal);
  const w = img?.naturalWidth || 1024;
  const h = img?.naturalHeight || 1024;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Draw base image
  if (img) {
    ctx.drawImage(img, 0, 0, w, h);
  }

  // Render visible layers in order
  const layers = (pageDetail.layers || [])
    .filter((l) => l.visible && l.content)
    .sort((a, b) => a.layer_index - b.layer_index);

  for (const layer of layers) {
    throwIfAborted(signal);
    await renderLayer(ctx, layer, w, h, storybook, signal);
  }

  return canvas;
};

// ============ PDF Export ============

const getPaperSizeMm = (
  paperSize: PaperSize,
  imageW: number,
  imageH: number,
  dpi: number,
): { widthMm: number; heightMm: number } => {
  if (paperSize === 'original') {
    return {
      widthMm: (imageW / dpi) * 25.4,
      heightMm: (imageH / dpi) * 25.4,
    };
  }
  const size = PAPER_SIZES[paperSize];
  return { widthMm: size.width, heightMm: size.height };
};

const resolveOrientation = (
  orientation: PaperOrientation,
  imageW: number,
  imageH: number,
  shortSide: number,
  longSide: number,
): 'portrait' | 'landscape' => {
  if (orientation !== 'auto') return orientation;
  const imgRatio = imageW / imageH;
  const portraitRatio = shortSide / longSide;
  const landscapeRatio = longSide / shortSide;
  return Math.abs(imgRatio - portraitRatio) < Math.abs(imgRatio - landscapeRatio)
    ? 'portrait'
    : 'landscape';
};

const getFitRect = (
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  fitMode: FitMode,
): { x: number; y: number; w: number; h: number } => {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  if ((fitMode === 'contain' && imgRatio > boxRatio) || (fitMode === 'cover' && imgRatio <= boxRatio)) {
    const w = boxW;
    const h = boxW / imgRatio;
    return { x: 0, y: (boxH - h) / 2, w, h };
  }
  const h = boxH;
  const w = boxH * imgRatio;
  return { x: (boxW - w) / 2, y: 0, w, h };
};

export const exportAsPdf = async (
  storybook: Storybook,
  pageDetails: StorybookPageWithLayers[],
  options: ExportOptions,
  onProgress?: (page: number, total: number) => void,
  runtime?: ExportRuntimeOptions,
) => {
  const { default: jsPDF } = await import('jspdf');

  if (pageDetails.length === 0) throw new Error('绘本无页面');
  throwIfAborted(runtime?.signal);

  // Get first page dimensions as reference
  const firstImg = await loadImage(pageDetails[0].image_url, runtime?.signal);
  const imgW = firstImg?.naturalWidth || 1024;
  const imgH = firstImg?.naturalHeight || 1024;

  const { widthMm, heightMm } = getPaperSizeMm(options.paperSize, imgW, imgH, options.dpi);
  const orientation = resolveOrientation(
    options.orientation,
    imgW,
    imgH,
    Math.min(widthMm, heightMm),
    Math.max(widthMm, heightMm),
  );

  const paperW = orientation === 'portrait' ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm);
  const paperH = orientation === 'portrait' ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm);

  const margin = options.safeMargin ? SAFE_MARGIN_MM : 0;
  const contentW = paperW - margin * 2;
  const contentH = paperH - margin * 2;

  let contentPageNum = 0;

  // Render pages sequentially to manage memory
  const pdf = new jsPDF({ orientation, unit: 'mm', format: [paperW, paperH] });

  for (let i = 0; i < pageDetails.length; i++) {
    throwIfAborted(runtime?.signal);
    const pageDetail = pageDetails[i];
    const isCover = pageDetail.page_type === 'cover' || pageDetail.page_type === 'back_cover';

    if (i > 0) pdf.addPage([paperW, paperH]);

    // Render page artwork
    const artwork = await renderPageArtwork(pageDetail, storybook, runtime?.signal);

    // Get artwork dimensions
    const artW = artwork.width;
    const artH = artwork.height;

    // Calculate fit within content box
    const fit = getFitRect(artW, artH, contentW, contentH, options.fitMode);
    const destX = margin + fit.x;
    const destY = margin + fit.y;

    // Convert artwork to data URL
    const dataUrl = artwork.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', destX, destY, fit.w, fit.h);
    artwork.width = 0;
    artwork.height = 0;

    // Page numbers for content pages only
    if (!isCover) {
      contentPageNum++;
      if (options.showPageNumbers) {
        const pageNumSize = Math.max(12, paperW * 0.06);
        const circleRadius = pageNumSize * 0.5;
        const padding = 2;

        // 页码位置在图片区域的右下角
        const x = destX + fit.w - circleRadius - padding;
        const y = destY + fit.h - circleRadius - padding;

        // 绘制圆形背景（半透明灰色）
        pdf.setFillColor(100, 100, 100, 0.5);
        pdf.circle(x, y, circleRadius, 'F');

        // 绘制页码（白色粗体）
        pdf.setFontSize(pageNumSize);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${contentPageNum}`, x, y, { align: 'center', baseline: 'middle' });
      }
    }

    onProgress?.(i + 1, pageDetails.length);
  }

  pdf.save(sanitizeFilename(`${storybook.title || 'storybook'}.pdf`));
};

// ============ PNG/JPG Long Image Export ============

export const exportAsLongImage = async (
  storybook: Storybook,
  pageDetails: StorybookPageWithLayers[],
  options: ExportOptions,
  onProgress?: (page: number, total: number) => void,
  runtime?: ExportRuntimeOptions,
) => {
  if (pageDetails.length === 0) throw new Error('绘本无页面');
  throwIfAborted(runtime?.signal);

  const firstImg = await loadImage(pageDetails[0].image_url, runtime?.signal);
  const pageW = firstImg?.naturalWidth || 1024;
  const pageH = firstImg?.naturalHeight || 1024;

  const totalPages = pageDetails.length;
  const totalH = pageH * totalPages;

  const isJpg = options.format === 'jpg';
  const ext = isJpg ? 'jpg' : 'png';
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const quality = isJpg ? options.jpgQuality : undefined;

  // Check if we need to split
  if (totalH <= MAX_CANVAS_SIDE) {
    await renderAndDownloadSingleLong(storybook, pageDetails, pageW, pageH, mimeType, quality, ext, storybook.title, onProgress, runtime);
  } else {
    await renderAndDownloadSplit(storybook, pageDetails, pageW, pageH, mimeType, quality, ext, storybook.title, onProgress, runtime);
  }
};

const renderAndDownloadSingleLong = async (
  storybook: Storybook,
  pageDetails: StorybookPageWithLayers[],
  pageW: number,
  pageH: number,
  mimeType: string,
  quality: number | undefined,
  ext: string,
  title?: string,
  onProgress?: (page: number, total: number) => void,
  runtime?: ExportRuntimeOptions,
) => {
  throwIfAborted(runtime?.signal);
  const canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH * pageDetails.length;
  const ctx = canvas.getContext('2d')!;

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < pageDetails.length; i++) {
    throwIfAborted(runtime?.signal);
    const artwork = await renderPageArtwork(pageDetails[i], storybook, runtime?.signal);
    ctx.drawImage(artwork, 0, i * pageH, pageW, pageH);
    artwork.width = 0;
    artwork.height = 0;
    onProgress?.(i + 1, pageDetails.length);
  }

  throwIfAborted(runtime?.signal);
  downloadCanvas(canvas, mimeType, quality, sanitizeFilename(`${title || 'storybook'}.${ext}`));
};

const renderAndDownloadSplit = async (
  storybook: Storybook,
  pageDetails: StorybookPageWithLayers[],
  pageW: number,
  pageH: number,
  mimeType: string,
  quality: number | undefined,
  ext: string,
  title?: string,
  onProgress?: (page: number, total: number) => void,
  runtime?: ExportRuntimeOptions,
) => {
  const maxPagesPerPart = Math.max(1, Math.floor(MAX_CANVAS_SIDE / pageH));
  const parts = Math.ceil(pageDetails.length / maxPagesPerPart);
  const baseName = sanitizeFilename(title || 'storybook');

  for (let part = 0; part < parts; part++) {
    throwIfAborted(runtime?.signal);
    const start = part * maxPagesPerPart;
    const end = Math.min(start + maxPagesPerPart, pageDetails.length);
    const chunk = pageDetails.slice(start, end);

    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH * chunk.length;
    const ctx = canvas.getContext('2d')!;

    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let i = 0; i < chunk.length; i++) {
      throwIfAborted(runtime?.signal);
      const artwork = await renderPageArtwork(chunk[i], storybook, runtime?.signal);
      ctx.drawImage(artwork, 0, i * pageH, pageW, pageH);
      artwork.width = 0;
      artwork.height = 0;
      onProgress?.(start + i + 1, pageDetails.length);
    }

    throwIfAborted(runtime?.signal);
    const filename = parts > 1 ? `${baseName}_part-${part + 1}.${ext}` : `${baseName}.${ext}`;
    downloadCanvas(canvas, mimeType, quality, filename);
  }
};

// ============ Main Export Function ============

export const exportStorybook = async (
  storybook: Storybook,
  options: ExportOptions,
  onProgress?: (stage: string, progress: number) => void,
  runtime?: ExportRuntimeOptions,
) => {
  const pages = storybook.pages || [];
  if (pages.length === 0) throw new Error('绘本无页面，无法导出');
  throwIfAborted(runtime?.signal);

  // Load page details
  onProgress?.('加载页面数据...', 0);
  const pageDetails = await loadPageDetails(pages, (loaded, total) => {
    onProgress?.('加载页面数据...', (loaded / total) * 30);
  }, runtime?.signal);

  // Export based on format
  if (options.format === 'pdf') {
    await exportAsPdf(storybook, pageDetails, options, (page, total) => {
      onProgress?.('导出 PDF...', 30 + (page / total) * 70);
    }, runtime);
  } else {
    await exportAsLongImage(storybook, pageDetails, options, (page, total) => {
      onProgress?.('导出图片...', 30 + (page / total) * 70);
    }, runtime);
  }
};

// ============ Preview Helpers ============

export interface LongImageEstimate {
  pageWidth: number;
  pageHeight: number;
  totalPages: number;
  longHeight: number;
  willSplit: boolean;
  parts: number;
}

export const estimateLongImage = async (
  pages: StorybookPage[],
): Promise<LongImageEstimate | null> => {
  if (pages.length === 0) return null;
  const img = await loadImage(pages[0].image_url);
  const pageW = img?.naturalWidth || 1024;
  const pageH = img?.naturalHeight || 1024;
  const longHeight = pageH * pages.length;
  const maxPagesPerPart = Math.max(1, Math.floor(MAX_CANVAS_SIDE / pageH));
  return {
    pageWidth: pageW,
    pageHeight: pageH,
    totalPages: pages.length,
    longHeight,
    willSplit: longHeight > MAX_CANVAS_SIDE,
    parts: Math.ceil(pages.length / maxPagesPerPart),
  };
};

// ============ Utility ============

const downloadCanvas = (canvas: HTMLCanvasElement, mimeType: string, quality: number | undefined, filename: string) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL(mimeType, quality);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 200);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const ch of paragraph) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};
