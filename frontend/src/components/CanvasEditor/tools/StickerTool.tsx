import React, { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { CanvasLayer } from '../types';

interface StickerToolProps {
  stageWidth: number;
  stageHeight: number;
  onAddLayer: (layer: CanvasLayer) => void;
}

const StickerTool: React.FC<StickerToolProps> = ({ stageWidth, stageHeight, onAddLayer }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // 保持原始宽高比，限制最大宽度为画布的 40%
        const maxW = Math.round(stageWidth * 0.4);
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = Math.min(img.naturalWidth, maxW);
        const h = Math.round(w / ratio);
        onAddLayer({
          id: `sticker-${Date.now()}`,
          type: 'image',
          src,
          x: Math.round((stageWidth - w) / 2),
          y: Math.round((stageHeight - h) / 2),
          width: w,
          height: h,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">上传任意图片作为贴纸叠加到画布上。</p>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#00CDD4] hover:text-[#00CDD4] transition-colors"
      >
        <ImagePlus size={16} />
        点击上传贴图
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
};

export default StickerTool;
