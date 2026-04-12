/**
 * AI 改图工具面板组件
 */

import React, { forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AIEditRef } from './types';
import { useAIEditState } from './hooks';
import { AIEditOverlay } from './Overlay';

interface AIEditPanelProps {
  storybookId: string | number;
  baseImageUrl: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onIsGeneratingChange?: (isGenerating: boolean) => void;
}

const AIEditPanel = forwardRef<AIEditRef, AIEditPanelProps>(({
  storybookId,
  baseImageUrl,
  onApply,
  containerRef,
  onIsGeneratingChange,
}, ref) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    instruction,
    setInstruction,
    uploadedImages,
    isGenerating,
    error,
    setError,
    addImages,
    removeImage,
    clearImages,
    generate,
    reset,
  } = useAIEditState(storybookId, baseImageUrl, onApply);

  // 通知父组件生成状态变化
  useEffect(() => {
    onIsGeneratingChange?.(isGenerating);
  }, [isGenerating, onIsGeneratingChange]);

  // 文件选择处理
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { failed } = await addImages(Array.from(files));
    if (failed > 0) {
      toast({ variant: 'destructive', title: '上传失败', description: `${failed} 张图片处理失败` });
    }
    e.target.value = '';
  }, [addImages, toast]);

  // 生成按钮点击
  const handleGenerate = useCallback(async () => {
    try {
      await generate();
      toast({ title: '图片已生成' });
    } catch {
      // 错误已在 hook 中处理
    }
  }, [generate, toast]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getInstruction: () => instruction,
    getUploadedImages: () => uploadedImages,
    getIsGenerating: () => isGenerating,
    generate: handleGenerate,
    reset,
  }), [instruction, uploadedImages, isGenerating, handleGenerate, reset]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部：标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">AI改图</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearImages}
            disabled={uploadedImages.length === 0}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
            title="清空参考图"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* 指令输入 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Label className="text-xs text-slate-500 mb-2 block">编辑指令</Label>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder="描述您想要的图片修改，例如：把天空改成夜晚..."
          rows={4}
          className="flex-1 w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] placeholder:text-slate-400"
          disabled={isGenerating}
        />

        {/* 参考图上传 */}
        <div className="mt-3">
          <Label className="text-xs text-slate-500 mb-2 block">参考图（可选）</Label>
          {uploadedImages.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {uploadedImages.map((src, i) => (
                <div
                  key={i}
                  className="group/thumb relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200"
                >
                  <img src={src} alt={`参考图 ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="w-full text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <Paperclip size={14} className="mr-1.5" />
            上传参考图
            {uploadedImages.length > 0 && ` (${uploadedImages.length})`}
          </Button>
        </div>
      </div>

      {/* 底部：生成按钮 */}
      <div className="pt-4 mt-3 border-t border-slate-200">
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!instruction.trim() || isGenerating}
          className="w-full bg-[#00CDD4] hover:bg-[#00b8be] text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="mr-1.5 animate-spin" />
              编辑中...
            </>
          ) : (
            <>
              <Sparkles size={14} className="mr-1.5" />
              编辑图片
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

AIEditPanel.displayName = 'AIEditPanel';

// 导出工具对象
export const AIEditTool = {
  Panel: AIEditPanel,
  Overlay: AIEditOverlay,
};

export default AIEditTool;
