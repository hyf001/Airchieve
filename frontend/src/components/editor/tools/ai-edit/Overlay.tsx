/**
 * AI 改图画布叠加层
 * 生成中显示加载遮罩覆盖画布图片
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface AIEditOverlayProps {
  isGenerating: boolean;
}

export const AIEditOverlay: React.FC<AIEditOverlayProps> = ({ isGenerating }) => {
  if (!isGenerating) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-lg">
      <div className="flex flex-col items-center gap-3 px-6 py-4 bg-white/90 rounded-2xl shadow-lg">
        <Loader2 size={28} className="text-[#00CDD4] animate-spin" />
        <span className="text-sm font-medium text-slate-700">AI 编辑中...</span>
      </div>
    </div>
  );
};

export default AIEditOverlay;
