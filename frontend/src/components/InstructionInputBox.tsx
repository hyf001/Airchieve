import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2, X, Upload, Palette } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateListItem } from '../services/templateService';
import { CliType, AspectRatio, ImageSize } from '../services/storybookService';

interface InstructionInputBoxProps {
  placeholder?: string;
  collapsedPlaceholder?: string;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  loadingMessage?: string;
  mode?: string;
  disabled?: boolean;
  showCancelButton?: boolean;
  visible?: boolean;
  selectedTemplate?: TemplateListItem | null;
  onTemplateSelect?: (template: TemplateListItem | null) => void;
  uploadedImages?: string[];
  onImageAdd?: (images: string[]) => void;
  onImageRemove?: (index: number) => void;
  cliType?: CliType;
  onCliTypeChange?: (value: CliType) => void;
  pageCount?: number;
  onPageCountChange?: (value: number) => void;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (value: AspectRatio) => void;
  imageSize?: ImageSize;
  onImageSizeChange?: (value: ImageSize) => void;
}

const InstructionInputBox: React.FC<InstructionInputBoxProps> = ({
  placeholder = "描述您想要的修改...",
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
  loadingMessage = "处理中...",
  mode,
  disabled = false,
  showCancelButton = false,
  visible = true,
  selectedTemplate = null,
  onTemplateSelect,
  uploadedImages = [],
  onImageAdd,
  onImageRemove,
  cliType = 'gemini',
  onCliTypeChange,
  pageCount = 10,
  onPageCountChange,
  aspectRatio = '16:9',
  onAspectRatioChange,
  imageSize = '1k',
  onImageSizeChange,
}) => {
  const [prompt, setPrompt] = useState('');
  const [localImages, setLocalImages] = useState<string[]>(uploadedImages);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalImages(uploadedImages); }, [uploadedImages]);
  useEffect(() => { if (!visible) setPrompt(''); }, [visible]);

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading || disabled) return;
    onSubmit(prompt);
    setPrompt('');
  };


  const compressImage = (file: File): Promise<string> => {
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // 未超限直接返回
        if (file.size <= MAX_SIZE) { resolve(dataUrl); return; }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          // 逐步降低质量直到小于 2MB
          let quality = 0.9;
          let result = canvas.toDataURL('image/jpeg', quality);
          while (result.length * 0.75 > MAX_SIZE && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(result);
        };
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const allFiles = Array.from(files);
    Promise.all(allFiles.map((file) => compressImage(file))).then((newImages) => {
      setLocalImages((prev) => [...prev, ...newImages]);
      onImageAdd?.(newImages);
    });
    e.target.value = '';
  };

  const displayImages = uploadedImages.length > 0 ? uploadedImages : localImages;

  if (!visible) return null;

  return (
    <div className="w-full relative">
      {/* 蓝色光晕层 — 让玻璃卡片在浅色背景上清晰可见 */}
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-sky-300/50 via-blue-300/40 to-cyan-300/45 blur-2xl pointer-events-none" />
      {/* 次级光晕，增加层次 */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/60 to-sky-100/30 blur-md pointer-events-none" />

      {/* 玻璃卡片 */}
      <div className="relative rounded-2xl overflow-hidden
                      bg-white/72 backdrop-blur-2xl
                      border border-white/70
                      shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]">

        <div className="px-5 pt-4 pb-3">
          {/* Error */}
          {error && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-red-50/80 border border-red-200/70">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-sky-50/80 border border-sky-200/60">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-sky-500 animate-spin" />
                <p className="text-sm text-sky-700">{loadingMessage}</p>
              </div>
            </div>
          )}

          {/* Selected template badge */}
          {selectedTemplate && (
            <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-xl
                            bg-sky-50/80 border border-sky-200/70 backdrop-blur-sm">
              <Palette size={13} className="text-sky-500 shrink-0" />
              <span className="text-xs font-semibold text-sky-700 flex-1 truncate">
                {selectedTemplate.name}
              </span>
              {selectedTemplate.description && (
                <span className="text-[11px] text-sky-500/80 truncate max-w-[140px] hidden sm:block">
                  {selectedTemplate.description}
                </span>
              )}
              <button
                onClick={() => onTemplateSelect?.(null)}
                className="shrink-0 p-0.5 rounded hover:bg-sky-100 transition-colors"
                title="取消选择风格"
              >
                <X size={12} className="text-sky-400 hover:text-sky-600" />
              </button>
            </div>
          )}

          {/* Textarea */}
          <Textarea
            rows={4}
            className="resize-none bg-transparent border-0 shadow-none focus-visible:ring-0
                       text-[15px] leading-relaxed text-slate-800
                       placeholder:text-slate-500 placeholder:font-medium p-0"
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}

            disabled={disabled}
          />

          {/* Image thumbnails */}
          {displayImages.length > 0 && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-0.5">
              {displayImages.map((src, i) => (
                <div
                  key={i}
                  className="group/thumb relative shrink-0 w-11 h-11 rounded-lg overflow-hidden
                             border border-white/60 shadow-sm"
                >
                  <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setLocalImages((prev) => prev.filter((_, idx) => idx !== i));
                      onImageRemove?.(i);
                    }}
                    className="absolute inset-0 flex items-center justify-center
                               bg-black/40 opacity-0 group-hover/thumb:opacity-100
                               transition-opacity duration-150"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center gap-2 px-4 py-3 flex-nowrap
                        border-t border-white/50 bg-white/20">
          {/* Upload */}
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
          {/* Upload — pill shape, glassy */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="上传参考图片"
            className="group flex items-center gap-1.5 px-3.5 h-8 rounded-full
                       bg-white/40 backdrop-blur-sm
                       border border-white/60
                       text-slate-500 text-xs font-medium
                       shadow-sm
                       hover:bg-white/60 hover:text-slate-700 hover:shadow-md
                       active:scale-95 transition-all duration-200"
          >
            <Upload size={13} className="shrink-0" />
            <span>上传图片</span>
          </button>

          {/* Options */}
          <div className="flex items-center gap-2 shrink-0">
            <Select value={cliType} onValueChange={(v) => onCliTypeChange?.(v as CliType)}>
              <SelectTrigger className="h-8 w-[110px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                <SelectValue placeholder="CLI 类型" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 border-white/70">
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(pageCount)} onValueChange={(v) => onPageCountChange?.(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">页数</span>
                  <SelectValue placeholder="数量" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white/95 border-white/70">
                {Array.from({ length: 20 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={aspectRatio} onValueChange={(v) => onAspectRatioChange?.(v as AspectRatio)}>
              <SelectTrigger className="h-8 w-[96px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                <SelectValue placeholder="尺寸比例" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 border-white/70">
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>

            <Select value={imageSize} onValueChange={(v) => onImageSizeChange?.(v as ImageSize)}>
              <SelectTrigger className="h-8 w-[80px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                <SelectValue placeholder="分辨率" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 border-white/70">
                <SelectItem value="1k">1K</SelectItem>
                <SelectItem value="2k">2K</SelectItem>
                <SelectItem value="4k">4K</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hint */}
          <div className="flex-1 min-w-0 text-xs text-slate-400/70 select-none text-center truncate whitespace-nowrap hidden md:block">
            {mode ?? (displayImages.length > 0
              ? `已上传 ${displayImages.length} 张图片`
              : '')}
          </div>

          {/* Cancel */}
          {showCancelButton && (
            <button
              onClick={() => { setPrompt(''); onCancel?.(); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-full hover:bg-white/60 transition-colors"
            >
              取消
            </button>
          )}

          {/* Send — magic wand pill */}
          <button
            disabled={!prompt.trim() || isLoading || disabled}
            onClick={handleSubmit}
            className={`
              shrink-0 flex items-center gap-2 px-4 h-10
              rounded-full text-white text-sm font-semibold
              transition-all duration-200
              ${prompt.trim() && !isLoading && !disabled
                ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-300/50 hover:shadow-purple-400/60 hover:scale-105 active:scale-95'
                : 'bg-slate-200/70 text-slate-400/60 cursor-not-allowed'}
            `}
          >
            {isLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <Wand2 size={16} strokeWidth={2} />
            }
            <span>{isLoading ? '创作中...' : '使用魔法'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionInputBox;
