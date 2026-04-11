/**
 * 页面导航组件 - 显示页面缩略图和当前页面计数
 */

import React from 'react';
import { StorybookPage } from '@/services/storybookService';

interface PageNavigatorProps {
  pages: StorybookPage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  currentIndex,
  onIndexChange,
}) => {
  if (pages.length === 0) {
    return (
      <aside className="w-44 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="text-center text-xs text-slate-600 font-medium">
            <div className="text-[10px] text-slate-400 mb-0.5">当前页面</div>
            <div className="text-sm font-bold text-slate-800">
              第 0 <span className="text-slate-400 font-normal">/</span> 0
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400">暂无页面</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-44 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      {/* 页面计数器 */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="text-center text-xs text-slate-600 font-medium">
          <div className="text-[10px] text-slate-400 mb-0.5">当前页面</div>
          <div className="text-sm font-bold text-slate-800">
            第 {currentIndex + 1} <span className="text-slate-400 font-normal">/</span> {pages.length}
          </div>
        </div>
      </div>

      {/* 缩略图列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30">
        {pages.map((page, idx) => (
          <PageThumbnail
            key={idx}
            page={page}
            index={idx}
            isActive={currentIndex === idx}
            onClick={() => onIndexChange(idx)}
          />
        ))}
      </div>
    </aside>
  );
};

interface PageThumbnailProps {
  page: StorybookPage;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({ page, index, isActive, onClick }) => {
  const pageTypeLabel =
    page.page_type === 'cover'
      ? '封面'
      : page.page_type === 'back_cover'
      ? '封底'
      : `第 ${index + 1} 页`;

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-video rounded-lg overflow-hidden ring-4 transition-all shadow-sm ${
        isActive
          ? 'ring-[#00CDD4] shadow-[#00CDD4]/30 scale-[1.03]'
          : 'ring-transparent hover:ring-slate-300 hover:scale-[1.02]'
      }`}
    >
      {page.image_url ? (
        <img
          src={page.image_url}
          alt={pageTypeLabel}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
          {pageTypeLabel}
        </div>
      )}
      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 leading-4 backdrop-blur-sm">
        {pageTypeLabel}
      </span>
    </button>
  );
};

export default PageNavigator;
