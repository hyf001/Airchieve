import { CanvasLayer, ImageFilters, buildFilterString } from './types';

const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 900;

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 将底图 + 滤镜 + 所有图层合并导出为 JPEG base64。
 * stageWidth/stageHeight 是预览区的 CSS 像素尺寸，用于计算坐标缩放比。
 */
export async function exportCanvasToBase64(
  baseImageUrl: string,
  filters: ImageFilters,
  layers: CanvasLayer[],
  stageWidth: number,
  stageHeight: number,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const scaleX = EXPORT_WIDTH / stageWidth;
  const scaleY = EXPORT_HEIGHT / stageHeight;

  // Draw base image with filters
  const filterStr = buildFilterString(filters);
  if (filterStr) ctx.filter = filterStr;
  const baseImg = await loadImageEl(baseImageUrl);
  ctx.drawImage(baseImg, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.filter = 'none';

  // Draw layers in order
  for (const layer of layers) {
    if (layer.type === 'image' && layer.src) {
      const img = await loadImageEl(layer.src);
      ctx.drawImage(
        img,
        Math.round(layer.x * scaleX),
        Math.round(layer.y * scaleY),
        Math.round(layer.width * scaleX),
        Math.round(layer.height * scaleY),
      );
    } else if (layer.type === 'text' && layer.text) {
      const fontSize = Math.round((layer.fontSize ?? 24) * scaleY);
      ctx.font = `${layer.bold ? 'bold ' : ''}${fontSize}px ${layer.fontFamily ?? 'sans-serif'}`;
      ctx.fillStyle = layer.color ?? '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = Math.round(4 * scaleY);
      ctx.fillText(
        layer.text,
        Math.round((layer.x + layer.width / 2) * scaleX),
        Math.round((layer.y + layer.height / 2) * scaleY),
      );
      ctx.shadowBlur = 0;
    }
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}
