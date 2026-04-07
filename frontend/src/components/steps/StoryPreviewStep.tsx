/**
 * 故事预览/编辑步骤组件
 * 用户可以查看和编辑 AI 生成的故事内容，设置页面数量
 */
import React, { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  onNext: (title: string, content: string, pageCount: number) => void;
  onBack: () => void;
}

const StoryPreviewStep: React.FC<StoryPreviewStepProps> = ({
  initialTitle,
  initialContent,
  initialPageCount = 10,
  onNext,
  onBack,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = useCallback(async () => {
    if (!title.trim() || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onNext(title.trim(), content.trim(), pageCount);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, content, pageCount, isSubmitting, onNext]);

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">预览故事</h2>
          <p className="text-sm text-slate-400">查看并编辑 AI 生成的故事内容</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">故事标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入故事标题"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/60 border border-slate-300/50 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all"
              />
            </div>

            {/* 故事内容输入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">故事内容</label>
                <span className="text-xs text-slate-500">{content.length} 字</span>
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
          <div className="flex items-center gap-2 px-4 py-3 flex-nowrap border-t border-white/50 bg-white/20">
            {/* 上一步按钮 */}
            <Button
              onClick={onBack}
              disabled={isSubmitting}
              variant="outline"
              className="shrink-0"
            >
              上一步
            </Button>

            {/* 页面数量参数 */}
            <div className="flex-1 flex items-center justify-center gap-3">
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
            </div>

            {/* 生成分镜按钮 */}
            <Button
              onClick={handleNext}
              disabled={!title.trim() || !content.trim() || isSubmitting}
              variant="gradient-rose"
              className="shrink-0 shadow-lg hover:shadow-purple-400/60 hover:scale-105 active:scale-95 transition-all"
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
