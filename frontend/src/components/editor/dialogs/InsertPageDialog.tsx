/**
 * 插入页面对话框组件
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Storybook } from '@/services/storybookService';
import { getAspectRatioClass } from '@/utils/editorUtils';

interface InsertPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
  onInsert: (position: number, count: number, instruction: string) => void | Promise<void>;
}

export const InsertPageDialog: React.FC<InsertPageDialogProps> = ({
  open,
  onOpenChange,
  storybook,
  onInsert,
}) => {
  const pages = storybook?.pages || [];
  const aspectRatio = storybook?.aspect_ratio || '16:9';

  const [insertPosition, setInsertPosition] = useState<number>(pages.length);
  const [count, setCount] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setInsertPosition(pages.length);
  }, [pages.length, open]);

  const positionLabel = (pos: number) => {
    if (pos <= 0) return '开头';
    if (pos >= pages.length) return '末尾';
    return `第 ${pos} 页后`;
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onInsert(insertPosition, count, instruction || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>插入新页面</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 位置选择 */}
          <div>
            <p className="text-sm text-slate-600 mb-2">选择插入位置：{positionLabel(insertPosition)}</p>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {pages.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => setInsertPosition(idx + 1)}
                  className={`relative aspect-video rounded-lg overflow-hidden ring-2 transition-all ${
                    insertPosition === idx + 1
                      ? 'ring-[#00CDD4] scale-[1.02]'
                      : 'ring-transparent hover:ring-slate-300'
                  }`}
                >
                  <img src={page.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 leading-3">
                    第 {idx + 1} 页
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 数量和指令 */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">生成页数</label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCount(Math.max(1, count - 1))}
                  disabled={count <= 1}
                >
                  -
                </Button>
                <span className="text-lg font-semibold w-8 text-center">{count}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCount(Math.min(10, count + 1))}
                  disabled={count >= 10}
                >
                  +
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">生成指令（可选）</label>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 resize-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
                placeholder="描述要生成的页面内容，例如：'小兔子在花园里遇到了朋友'..."
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="bg-[#00CDD4] hover:bg-[#00b8be] text-white">
            {isSubmitting ? '生成中...' : '开始生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InsertPageDialog;
