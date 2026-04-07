/**
 * 生成封面对话框组件
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Storybook } from '@/services/storybookService';

interface GenerateCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
  onGenerate: (selectedPages: number[]) => void | Promise<void>;
}

export const GenerateCoverDialog: React.FC<GenerateCoverDialogProps> = ({
  open,
  onOpenChange,
  storybook,
  onGenerate,
}) => {
  const pages = storybook?.pages || [];

  // 默认选择：首页、中间页、尾页
  const defaultSelected = (): number[] => {
    if (pages.length === 0) return [];
    if (pages.length <= 3) return pages.map((_, i) => i);
    return [0, Math.floor(pages.length / 2), pages.length - 1];
  };

  const [selected, setSelected] = useState<number[]>(defaultSelected);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setSelected(defaultSelected());
  }, [pages.length, open]);

  const togglePage = (idx: number) => {
    setSelected(prev => {
      if (prev.includes(idx)) {
        return prev.length > 1 ? prev.filter(i => i !== idx) : prev;
      }
      if (prev.length >= 3) return [...prev.slice(1), idx];
      return [...prev, idx];
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate(selected);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生成封面</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            选择 <span className="font-medium text-slate-700">最多 3 张</span> 参考页，AI 将提取画风和角色生成封面
          </p>

          {/* 页面选择 */}
          {pages.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无可用页面</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {pages.map((page, idx) => {
                const isSelected = selected.includes(idx);
                const selOrder = selected.indexOf(idx) + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => togglePage(idx)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-[#00CDD4] shadow-md scale-[1.03]'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={page.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-[#00CDD4] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                        {selOrder}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selected.length === 0 || isGenerating || pages.length === 0}
            className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
          >
            {isGenerating ? '生成中...' : '开始生成封面'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateCoverDialog;
