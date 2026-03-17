export interface CanvasLayer {
  id: string;
  type: 'image' | 'text';
  // image layer
  src?: string;
  // text layer
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  // layout (stage pixels)
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageFilters {
  brightness: number;  // 100 = normal
  contrast: number;    // 100 = normal
  saturation: number;  // 100 = normal
  blur: number;        // 0 = none (px)
}

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
};

export type ToolType = 'headswap' | 'sticker' | 'text' | 'filter';

export function buildFilterString(filters: ImageFilters): string {
  const parts: string[] = [];
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  return parts.join(' ');
}
