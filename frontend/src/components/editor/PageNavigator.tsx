/**
 * 页面导航组件 - 显示页面缩略图和当前页面计数
 */

import React from 'react';
import { StorybookPage } from '@/services/storybookService';

interface PageNavigatorProps {
  pages: StorybookPage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isTerminated?: boolean;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  currentIndex,
  onIndexChange,
  isTerminated,
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
            isTerminated={isTerminated}
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
  isTerminated?: boolean;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({ page, index, isActive, onClick, isTerminated }) => {
  const status = page.status || (page.image_url ? 'finished' : isTerminated ? 'pending' : 'generating');
  const pageTypeLabel =
    page.page_type === 'cover'
      ? '封面'
      : page.page_type === 'back_cover'
      ? '封底'
      : `第 ${page.page_index} 页`;

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-video rounded-lg overflow-hidden ring-4 transition-all shadow-sm ${
        isActive
          ? 'ring-[#00CDD4] shadow-[#00CDD4]/30 scale-[1.03]'
          : 'ring-transparent hover:ring-slate-300 hover:scale-[1.02]'
      }`}
    >
      {page.image_url && status !== 'generating' ? (
        <img
          src={page.image_url}
          alt={pageTypeLabel}
          className="w-full h-full object-cover"
        />
      ) : status === 'error' ? (
        <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center gap-2 px-2">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-red-500 text-[10px] leading-tight">生成失败</span>
        </div>
      ) : status === 'pending' || isTerminated ? (
        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-slate-400 text-[10px]">未生成</span>
        </div>
      ) : (
        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-[10px]">生成中...</span>
        </div>
      )}
      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 leading-4 backdrop-blur-sm">
        {pageTypeLabel}
      </span>
    </button>
  );
};

export default PageNavigator;
