import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2, X, Upload, Palette } from 'lucide-react';
import { TemplateListItem } from '../services/templateService';

interface FloatingInputBoxProps {
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
}

const FloatingInputBox: React.FC<FloatingInputBoxProps> = ({
  placeholder = "描述你想要的修改...",
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileCount = files.length;
    const newImages: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        if (newImages.length === fileCount) {
          setLocalImages((prev) => [...prev, ...newImages]);
          onImageAdd?.(newImages);
        }
      };
      reader.readAsDataURL(file);
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
          <textarea
            rows={4}
            className="w-full resize-none bg-transparent focus:outline-none
                       text-[15px] leading-relaxed text-slate-800
                       placeholder:text-slate-400/70"
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
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
        <div className="flex items-center gap-2 px-4 py-3
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-8 h-8 rounded-lg
                       text-slate-400 hover:text-slate-600
                       hover:bg-white/60 transition-all duration-200"
            title="上传参考图片"
          >
            <Upload size={15} />
          </button>

          {/* Hint */}
          <div className="flex-1 text-xs text-slate-400/80 select-none">
            {mode ?? (displayImages.length > 0
              ? `已上传 ${displayImages.length} 张图片`
              : '⌘ + Enter 发送')}
          </div>

          {/* Cancel */}
          {showCancelButton && (
            <button
              onClick={() => { setPrompt(''); onCancel?.(); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
            >
              取消
            </button>
          )}

          {/* Send */}
          <button
            disabled={!prompt.trim() || isLoading || disabled}
            onClick={handleSubmit}
            className={`
              shrink-0 flex items-center justify-center w-9 h-9
              rounded-xl text-white font-medium
              transition-all duration-200
              ${prompt.trim() && !isLoading && !disabled
                ? 'bg-gradient-to-br from-blue-500 to-sky-400 shadow-md shadow-blue-300/50 hover:shadow-blue-400/60 hover:scale-105 active:scale-95'
                : 'bg-slate-200/80 text-slate-400 cursor-not-allowed'}
            `}
          >
            {isLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <ArrowRight size={16} />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingInputBox;
