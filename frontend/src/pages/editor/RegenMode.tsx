import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Storybook,
  regeneratePages,
  InsufficientPointsError,
} from '../../services/storybookService';

interface RegenModeProps {
  storybook: Storybook;
  onStorybookChange: (storybook: Storybook) => void;
  onStartPolling: (id: number) => void;
  onExit: () => void;
}

const RegenMode: React.FC<RegenModeProps> = ({
  storybook,
  onStorybookChange,
  onStartPolling,
  onExit,
}) => {
  const { toast } = useToast();
  const pages = storybook.pages || [];

  const [selected, setSelected] = useState<number[]>([]);
  const [count, setCount] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 5) return prev;
      return [...prev, idx];
    });
  };

  const handleConfirm = async () => {
    if (selected.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await regeneratePages(storybook.id, selected, count, instruction || undefined);
      onStorybookChange({ ...storybook, status: 'updating' });
      onStartPolling(storybook.id);
      onExit();
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({ variant: 'destructive', title: '再生成失败', description: err instanceof Error ? err.message : undefined });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="text-center space-y-1">
        <p className="text-slate-700 font-medium">选择参考页面，再生成新页面</p>
        <p className="text-slate-400 text-sm">已选 {selected.length} / 5 页</p>
      </div>

      {/* Page selection grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {pages.map((page, idx) => (
          <div
            key={idx}
            onClick={() => toggleSelect(idx)}
            className={`relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer ring-4 transition-all ${
              selected.includes(idx)
                ? 'ring-[#00CDD4] scale-[0.97]'
                : 'ring-transparent hover:ring-slate-300'
            }`}
          >
            <img src={page.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
              <p className="text-white text-xs line-clamp-2">{page.text}</p>
            </div>
            {selected.includes(idx) && (
              <div className="absolute top-2 right-2 bg-[#00CDD4] rounded-full p-1">
                <Check size={14} className="text-white" />
              </div>
            )}
            <div className="absolute top-2 left-2 bg-black/50 rounded px-1.5 py-0.5 text-white text-xs">
              第 {idx + 1} 页
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3">
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="再生成指令，例如：继续后面的故事"
          rows={2}
          className="w-full max-w-lg text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] leading-relaxed placeholder:text-slate-400"
        />
        <div className="flex justify-center gap-3 items-center">
          <Button variant="outline" onClick={onExit} disabled={isSubmitting}>
            取消
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>生成</span>
            <select
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="border border-slate-200 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>张</span>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selected.length === 0 || isSubmitting}
            className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            再生成
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegenMode;
