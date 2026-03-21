import React, { useState } from 'react';
import { BookImage, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Storybook,
  StorybookPage,
  generateCover,
  InsufficientPointsError,
  toApiUrl,
} from '../../services/storybookService';

interface CoverModeProps {
  storybook: Storybook;
  onCoverGenerating: () => void;
}

/** 默认选取参考页索引（在全部 pages 数组中的下标） */
function defaultSelectedIndices(pages: StorybookPage[]): number[] {
  const contentIndices = pages
    .map((p, i) => (p.page_type === 'content' ? i : -1))
    .filter(i => i >= 0);

  const n = contentIndices.length;
  if (n === 0) return pages.slice(0, 3).map((_, i) => i);
  if (n <= 3) return contentIndices;
  const mid = Math.floor(n / 2);
  return [contentIndices[0], contentIndices[mid], contentIndices[n - 1]];
}

const CoverMode: React.FC<CoverModeProps> = ({ storybook, onCoverGenerating }) => {
  const { toast } = useToast();
  const pages = storybook.pages || [];

  const [selected, setSelected] = useState<number[]>(() => defaultSelectedIndices(pages));
  const [isGenerating, setIsGenerating] = useState(false);

  const togglePage = (idx: number) => {
    setSelected(prev => {
      if (prev.includes(idx)) {
        // 至少保留1张
        return prev.length > 1 ? prev.filter(i => i !== idx) : prev;
      }
      // 最多3张：替换最早选的
      if (prev.length >= 3) return [...prev.slice(1), idx];
      return [...prev, idx];
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateCover(storybook.id, selected);
      onCoverGenerating();
      toast({ title: '封面生成中', description: '请稍候，生成完成后将自动刷新' });
    } catch (e) {
      if (e instanceof InsufficientPointsError) {
        toast({ title: '积分不足', description: e.message, variant: 'destructive' });
      } else {
        toast({ title: '生成失败', description: (e as Error).message || '请稍后重试', variant: 'destructive' });
      }
      setIsGenerating(false);
    }
  };

  // 只展示内页供选择（封面/封底不显示）
  const selectablePages = pages
    .map((p, i) => ({ page: p, index: i }))
    .filter(({ page }) => page.page_type === 'content');

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">
      {/* 说明 */}
      <p className="text-sm text-slate-500">
        选择 <span className="font-medium text-slate-700">3 张</span> 参考页，AI 将提取画风和角色生成封面。
        已默认选取首、中、尾页，点击可替换。
      </p>

      {/* 图片选择网格 */}
      {selectablePages.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">暂无可用内页</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {selectablePages.map(({ page, index }) => {
            const isSelected = selected.includes(index);
            const selOrder = selected.indexOf(index);
            return (
              <button
                key={index}
                onClick={() => togglePage(index)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-[#00CDD4] shadow-md scale-[1.03]'
                    : 'border-transparent hover:border-slate-300'
                }`}
              >
                <img
                  src={toApiUrl(page.image_url)}
                  alt={`第 ${index + 1} 页`}
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#00CDD4] flex items-center justify-center shadow">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-[#00CDD4]/80 rounded px-1 leading-4">
                    {selOrder + 1}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 text-[9px] text-white/80 bg-black/30 rounded px-1 leading-4">
                  P{index + 1}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 已选预览 */}
      {selected.length > 0 && (
        <div className="flex gap-2">
          {selected.map((idx, order) => (
            <div key={idx} className="flex-1 aspect-video rounded-lg overflow-hidden border border-[#00CDD4]/40">
              <img
                src={toApiUrl(pages[idx].image_url)}
                alt={`参考 ${order + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* 生成按钮 */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || selected.length === 0}
        className="w-full bg-[#00CDD4] hover:bg-[#00b0b8] text-white h-11 rounded-xl font-medium"
      >
        {isGenerating ? (
          <><Loader2 size={16} className="mr-2 animate-spin" />生成中…</>
        ) : (
          <><BookImage size={16} className="mr-2" />生成封面（{selected.length} 张参考）</>
        )}
      </Button>
    </div>
  );
};

export default CoverMode;
