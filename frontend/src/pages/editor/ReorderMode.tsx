import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Storybook, reorderPages } from '../../services/storybookService';

interface ReorderModeProps {
  storybook: Storybook;
  onStorybookChange: (storybook: Storybook) => void;
  onExit: () => void;
}

const ReorderMode: React.FC<ReorderModeProps> = ({ storybook, onStorybookChange, onExit }) => {
  const { toast } = useToast();
  const pages = storybook.pages || [];
  const aspectRatio = storybook.aspect_ratio || '16:9';
  const [draft, setDraft] = useState<number[]>(() => pages.map((_, i) => i));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  // 根据比例获取 Tailwind 类名
  const getAspectRatioClass = (ratio: string): string => {
    switch (ratio) {
      case '1:1':
        return 'aspect-square';
      case '4:3':
        return 'aspect-[4/3]';
      case '16:9':
      default:
        return 'aspect-[16/9]';
    }
  };

  const handleDragStart = (pos: number) => {
    dragIndexRef.current = pos;
  };

  const handleDragOver = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === pos) return;
    setDraft(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(pos, 0, item);
      dragIndexRef.current = pos;
      return next;
    });
  };

  const moveLeft = (pos: number) => {
    if (pos === 0) return;
    setDraft(prev => {
      const next = [...prev];
      [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
      return next;
    });
  };

  const moveRight = (pos: number) => {
    if (pos === draft.length - 1) return;
    setDraft(prev => {
      const next = [...prev];
      [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
      return next;
    });
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await reorderPages(storybook.id, draft);
      onStorybookChange(updated);
      onExit();
    } catch (err) {
      toast({ variant: 'destructive', title: '排序失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 flex justify-center flex-col items-center">
      <div className="text-center space-y-1">
        <p className="text-slate-700 font-medium">拖动缩略图调整顺序</p>
        <p className="text-slate-400 text-sm">也可使用左右箭头微调位置</p>
      </div>

      {/* Page grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-5xl">
        {draft.map((origIdx, pos) => {
          const page = pages[origIdx];
          if (!page) return null;
          return (
            <div
              key={origIdx}
              draggable
              onDragStart={() => handleDragStart(pos)}
              onDragOver={(e) => handleDragOver(e, pos)}
              className="rounded-xl overflow-hidden ring-2 ring-slate-200 hover:ring-[#00CDD4] transition-all select-none cursor-grab active:cursor-grabbing bg-white shadow-sm"
            >
              <div className={`relative ${getAspectRatioClass(aspectRatio)} h-[150px] md:h-[180px]`}>
                <img src={page.image_url} alt={`第 ${pos + 1} 页`} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                  第 {pos + 1} 页
                </div>
              </div>
              <div className="flex justify-between bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => moveLeft(pos)}
                  disabled={pos === 0}
                  className="flex-1 flex justify-center py-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => moveRight(pos)}
                  disabled={pos === draft.length - 1}
                  className="flex-1 flex justify-center py-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onExit} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
          确认排序
        </Button>
      </div>
    </div>
  );
};

export default ReorderMode;
