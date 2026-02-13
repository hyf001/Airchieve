import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, Loader2, X, ChevronLeft, ChevronRight, Upload, FileText } from 'lucide-react';
import { TemplateListItem } from '../services/templateService';

interface FloatingInputBoxProps {
  placeholder?: string;
  collapsedPlaceholder?: string;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  loadingMessage?: string;
  mode?: string; // e.g., "编辑绘本", "编辑第 3 页"
  disabled?: boolean;
  showCancelButton?: boolean;
  visible?: boolean; // 控制悬浮框是否显示
  // 模版选择相关
  templates?: TemplateListItem[];
  selectedTemplate?: TemplateListItem | null;
  onTemplateSelect?: (template: TemplateListItem | null) => void;
  loadingTemplates?: boolean;
  // 图片上传相关
  uploadedImages?: string[];
  onImageAdd?: (images: string[]) => void;
  onImageRemove?: (index: number) => void;
}

const FloatingInputBox: React.FC<FloatingInputBoxProps> = ({
  placeholder = "描述你想要的修改...",
  collapsedPlaceholder = "开始编辑...",
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
  loadingMessage = "处理中...",
  mode,
  disabled = false,
  showCancelButton = false,
  visible = true,
  templates = [],
  selectedTemplate = null,
  onTemplateSelect,
  loadingTemplates = false,
  uploadedImages = [],
  onImageAdd,
  onImageRemove,
}) => {
  const [prompt, setPrompt] = useState('');
  const [inputExpanded, setInputExpanded] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>(uploadedImages);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const templateScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expand = useCallback(() => {
    if (!disabled) {
      setInputExpanded(true);
    }
  }, [disabled]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      barRef.current &&
      !barRef.current.contains(e.target as Node) &&
      !prompt.trim()
    ) {
      setInputExpanded(false);
    }
  }, [prompt]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading || disabled) return;
    onSubmit(prompt);
    setPrompt('');
    setInputExpanded(false);
  };

  const handleCancel = () => {
    setPrompt('');
    setInputExpanded(false);
    onCancel?.();
  };

  // 当visible变为true时，自动展开
  useEffect(() => {
    if (visible) {
      setInputExpanded(true);
    } else {
      setInputExpanded(false);
      setPrompt('');
    }
  }, [visible]);

  useEffect(() => {
    setLocalImages(uploadedImages);
  }, [uploadedImages]);

  const scrollTemplates = (direction: number) => {
    const el = templateScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileCount = files.length; // 保存文件数量,因为清空 input 后 files.length 会变成 0
    const newImages: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        // 当所有文件都读取完成后，调用回调
        if (newImages.length === fileCount) {
          setLocalImages((prev) => [...prev, ...newImages]);
          onImageAdd?.(newImages);
          // 上传图片后自动展开输入框
          setInputExpanded(true);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset so re-selecting the same file still triggers onChange
    e.target.value = '';
  };

  const displayImages = uploadedImages.length > 0 ? uploadedImages : localImages;
  const isOpen = inputExpanded || !!prompt.trim() || displayImages.length > 0 || !!selectedTemplate;

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      className="w-full max-w-2xl animate-in zoom-in-95 duration-300"
      onMouseEnter={expand}
    >
      {/* Glassmorphism container */}
      <div
        className={`
          relative overflow-hidden rounded-2xl
          border border-white/30
          bg-gradient-to-br from-white/70 via-white/60 to-indigo-50/50
          backdrop-blur-xl
          shadow-[0_8px_40px_rgba(99,102,241,0.12)]
          transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${isOpen ? 'p-5' : 'p-3'}
        `}
      >
        {/* Subtle shimmer overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />

        {/* Error message */}
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Loading status */}
        {isLoading && (
          <div className="mb-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="text-indigo-600 animate-spin" />
              <p className="text-sm text-indigo-600">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Expanded textarea area */}
        <div
          className={`
            transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden
            ${isOpen ? 'max-h-40 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}
          `}
        >
          <textarea
            className="w-full p-3 rounded-xl
                       bg-white/50 border border-white/40 backdrop-blur-sm
                       focus:bg-white/70 focus:ring-0 focus:outline-none
                       transition-all duration-300 text-sm text-slate-800
                       placeholder:text-slate-400 resize-none leading-relaxed"
            rows={3}
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={expand}
            disabled={disabled}
          />
        </div>

        {/* Thumbnails row (template + images) */}
        {(selectedTemplate || displayImages.length > 0) && (
          <div className="relative flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            {/* Template thumbnail */}
            {selectedTemplate && (
              <div
                className="group/thumb relative shrink-0 w-12 h-12 rounded-lg overflow-hidden
                           border-2 border-indigo-300 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <FileText size={20} className="text-indigo-600" />
                </div>
                <button
                  onClick={() => {
                    onTemplateSelect?.(null);
                    setShowTemplateSelector(false);
                  }}
                  className="absolute inset-0 flex items-center justify-center
                             bg-black/40 opacity-0 group-hover/thumb:opacity-100
                             transition-opacity duration-200"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}

            {/* Image thumbnails */}
            {displayImages.map((src, i) => (
              <div
                key={i}
                className="group/thumb relative shrink-0 w-12 h-12 rounded-lg overflow-hidden
                           border border-white/40 shadow-sm"
              >
                <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setLocalImages((prev) => prev.filter((_, idx) => idx !== i));
                    onImageRemove?.(i);
                  }}
                  className="absolute inset-0 flex items-center justify-center
                             bg-black/40 opacity-0 group-hover/thumb:opacity-100
                             transition-opacity duration-200"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Template Selector Dropdown */}
        {showTemplateSelector && templates.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-slate-600">选择模版</h3>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                收起
              </button>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="relative group/templates">
                {/* Left arrow */}
                {templates.length > 3 && (
                  <button
                    onClick={() => scrollTemplates(-1)}
                    className="absolute -left-2 top-1/2 -translate-y-1/2 z-10
                               w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-slate-200
                               shadow-md flex items-center justify-center
                               opacity-0 group-hover/templates:opacity-100
                               transition-opacity duration-300 hover:bg-white"
                  >
                    <ChevronLeft size={14} className="text-slate-600" />
                  </button>
                )}

                {/* Scrollable templates */}
                <div
                  ref={templateScrollRef}
                  className="flex gap-2 overflow-x-auto pb-1
                             [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        onTemplateSelect?.(template);
                        setShowTemplateSelector(false);
                      }}
                      className={`
                        shrink-0 w-32 flex flex-col text-left rounded-lg overflow-hidden
                        border-2 transition-all duration-300
                        ${selectedTemplate?.id === template.id
                          ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-md'
                          : 'border-white/60 bg-white/40 hover:border-indigo-200 hover:bg-white/60'}
                      `}
                    >
                      <div className="h-16 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                        <FileText size={24} className="text-indigo-600" />
                      </div>
                      <div className="p-2 bg-white/60">
                        <h4 className="text-xs font-semibold text-slate-800 truncate">
                          {template.name}
                        </h4>
                        {template.description && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right arrow */}
                {templates.length > 3 && (
                  <button
                    onClick={() => scrollTemplates(1)}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 z-10
                               w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-slate-200
                               shadow-md flex items-center justify-center
                               opacity-0 group-hover/templates:opacity-100
                               transition-opacity duration-300 hover:bg-white"
                  >
                    <ChevronRight size={14} className="text-slate-600" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom action row */}
        <div className="relative flex items-center gap-2">
          {/* Template selection button */}
          {templates.length > 0 && (
            <button
              onClick={() => {
                setShowTemplateSelector(!showTemplateSelector);
                setInputExpanded(true);
              }}
              className={`
                flex items-center justify-center shrink-0
                rounded-xl border border-white/40 bg-white/40 backdrop-blur-sm
                hover:bg-white/70 transition-all duration-500
                ${isOpen
                  ? 'w-10 h-10 opacity-100 scale-100'
                  : 'w-0 h-10 opacity-0 scale-75 border-0 p-0 overflow-hidden'}
                ${selectedTemplate ? 'border-indigo-300 bg-indigo-50/60' : ''}
              `}
              title="选择模版"
            >
              <FileText size={16} className={selectedTemplate ? 'text-indigo-600' : 'text-slate-500'} />
            </button>
          )}

          {/* Upload button */}
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
            className={`
              flex items-center justify-center shrink-0
              rounded-xl border border-white/40 bg-white/40 backdrop-blur-sm
              hover:bg-white/70 transition-all duration-500
              ${isOpen
                ? 'w-10 h-10 opacity-100 scale-100'
                : 'w-0 h-10 opacity-0 scale-75 border-0 p-0 overflow-hidden'}
            `}
            title="上传参考图片"
          >
            <Upload size={16} className="text-slate-500" />
          </button>

          {/* Collapsed: placeholder bar */}
          {!isOpen && (
            <div
              className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-white/40 border border-white/40 backdrop-blur-sm
                         cursor-text text-slate-400 text-sm
                         hover:bg-white/60 transition-all duration-300"
              onClick={expand}
            >
              <Sparkles size={14} className="text-indigo-400 shrink-0" />
              <span>{collapsedPlaceholder}</span>
            </div>
          )}

          {/* Expanded: mode/status pill */}
          {isOpen && (
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl
                            bg-white/30 border border-white/30 text-xs text-slate-500 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${selectedTemplate || displayImages.length > 0 ? 'bg-indigo-400' : 'bg-slate-300'}`} />
              <span className="truncate flex-1">
                {mode || (selectedTemplate && displayImages.length > 0
                  ? `${selectedTemplate.name} + ${displayImages.length} 张图片`
                  : selectedTemplate
                  ? selectedTemplate.name
                  : displayImages.length > 0
                  ? `已选 ${displayImages.length} 张图片`
                  : '未选择模版和图片')}
              </span>
              {showCancelButton && (
                <button
                  onClick={handleCancel}
                  className="ml-1 p-0.5 hover:bg-white/50 rounded transition-colors"
                  title="取消"
                >
                  <X size={12} className="text-slate-400" />
                </button>
              )}
            </div>
          )}

          {/* Send button */}
          <button
            disabled={!prompt.trim() || isLoading || disabled}
            onClick={handleSubmit}
            className={`
              shrink-0 flex items-center justify-center w-10 h-10
              rounded-xl font-bold text-white
              transition-all duration-500
              ${prompt.trim() && !isLoading && !disabled
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/60 hover:scale-105 active:scale-95'
                : 'bg-slate-300/60 backdrop-blur-sm cursor-not-allowed'}
            `}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingInputBox;
