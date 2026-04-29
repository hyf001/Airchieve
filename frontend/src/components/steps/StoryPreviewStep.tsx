/**
 * 故事预览/编辑步骤组件
 * 用户可以查看和编辑 AI 生成的故事内容，设置页面数量
 */
import React, { useState, useCallback } from 'react';
import { Check, FileText, Image as ImageIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageStyleListItem } from '../../services/imageStyleService';
import { toApiUrl } from '@/services/storybookService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StoryPreviewStepProps {
  initialTitle: string;
  initialContent: string;
  initialPageCount?: number;
  imageStyles: ImageStyleListItem[];
  selectedImageStyle: ImageStyleListItem | null;
  onImageStyleChange: (style: ImageStyleListItem) => void;
  onNext: (title: string, content: string, pageCount: number, hasCharacterReferenceImages: boolean) => void;
  onBack: () => void;
}

const StoryPreviewStep: React.FC<StoryPreviewStepProps> = ({
  initialTitle,
  initialContent,
  initialPageCount = 10,
  imageStyles,
  selectedImageStyle,
  onImageStyleChange,
  onNext,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [hasCharacterReferenceImages, setHasCharacterReferenceImages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleMissing = title.trim().length === 0;
  const contentMissing = content.trim().length === 0;
  const styleMissing = !selectedImageStyle;

  const handleNext = useCallback(async () => {
    if (!title.trim() || !content.trim() || isSubmitting) return;
    if (!selectedImageStyle) return;

    setIsSubmitting(true);
    try {
      await onNext(title.trim(), content.trim(), pageCount, hasCharacterReferenceImages);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, content, pageCount, hasCharacterReferenceImages, selectedImageStyle, isSubmitting, onNext]);

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">预览故事</h2>
          <p className="text-sm text-slate-400">查看并编辑故事内容，填写故事标题</p>
        </div>
      </div>

      {/* 输入框区域（蓝色光晕玻璃态） */}
      <div className="w-full relative">
        {/* 蓝色光晕层 */}
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-sky-300/50 via-blue-300/40 to-cyan-300/45 blur-2xl pointer-events-none" />
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/60 to-sky-100/30 blur-md pointer-events-none" />

        {/* 玻璃卡片 */}
        <div className="relative rounded-2xl overflow-hidden bg-white/72 backdrop-blur-2xl border border-white/70 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="px-5 pt-4 pb-3 space-y-4">
            {/* 故事标题输入 */}
            <div>
	              <div className="mb-2 flex items-center justify-between">
	                <label className="block text-sm font-medium text-slate-700">故事标题</label>
	                {titleMissing && <span className="text-xs text-amber-600">请输入标题</span>}
	              </div>
	              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入故事标题"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/60 border border-slate-300/50 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">图片画风</label>
                {styleMissing && imageStyles.length > 0 && (
                  <span className="text-xs text-amber-600">请选择一个画风</span>
                )}
              </div>
              {imageStyles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 bg-white/50 px-4 py-6 text-center text-sm text-slate-500">
                  暂无可用画风
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {imageStyles.map((style) => {
                    const isSelected = selectedImageStyle?.id === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => onImageStyleChange(style)}
                        disabled={isSubmitting}
                        className={`group relative overflow-hidden rounded-xl border bg-white/70 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-70 ${
                          isSelected
                            ? 'border-amber-500 ring-2 ring-amber-400/40'
                            : 'border-slate-300/60 hover:border-amber-300 hover:shadow-md'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="aspect-[4/3] bg-slate-100">
                          {style.cover_image ? (
                            <img
                              src={toApiUrl(style.cover_image)}
                              alt={style.name}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 px-3 py-2">
                          <div className="truncate text-sm font-semibold text-slate-800">{style.name}</div>
                          <div className="min-h-[2rem] text-xs leading-4 text-slate-500 line-clamp-2">
                            {style.description || '暂无描述'}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 故事内容输入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
	                <label className="block text-sm font-medium text-slate-700">故事内容</label>
	                <span className={`text-xs ${contentMissing ? 'text-amber-600' : 'text-slate-500'}`}>
	                  {contentMissing ? '请输入故事内容' : `${content.length} 字`}
	                </span>
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="输入故事内容"
                rows={12}
                disabled={isSubmitting}
                className="resize-none bg-white/60 border border-slate-300/50 text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all rounded-lg"
              />
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex flex-col gap-3 px-4 py-3 border-t border-white/50 bg-white/20 sm:flex-row sm:items-center">
            {/* 页面数量参数 */}
            <div className="flex flex-wrap items-center gap-3 sm:flex-1 sm:justify-start">
              <span className="text-sm text-slate-600">页面数量</span>
              <Select
                value={String(pageCount)}
                onValueChange={(v) => setPageCount(Number(v))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs bg-white/60 border-slate-300/50 text-slate-700 shadow-sm focus:ring-amber-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-slate-300/50">
                  <SelectItem value="5">5页</SelectItem>
                  <SelectItem value="8">8页</SelectItem>
                  <SelectItem value="10">10页</SelectItem>
                  <SelectItem value="12">12页</SelectItem>
                  <SelectItem value="16">16页</SelectItem>
                  <SelectItem value="20">20页</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={hasCharacterReferenceImages}
                  onCheckedChange={(checked) => setHasCharacterReferenceImages(checked === true)}
                  disabled={isSubmitting}
                />
                会上传角色参考图
              </label>

            </div>

            {/* 生成分镜按钮 */}
            <Button
              onClick={handleNext}
              disabled={titleMissing || contentMissing || styleMissing || isSubmitting}
              variant="gradient-rose"
              className="w-full shrink-0 shadow-lg transition-all hover:scale-105 hover:shadow-purple-400/60 active:scale-95 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>正在生成分镜...</span>
                </>
              ) : (
                <>
                  <FileText size={16} strokeWidth={2} />
                  <span>生成分镜</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryPreviewStep;
