import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { StorybookListItem, StorybookPage, getStorybook } from '../services/storybookService';

interface StorybookPreviewProps {
  storybook: StorybookListItem;
  onClick?: (id: number) => void;
  className?: string;
}

const StorybookPreview: React.FC<StorybookPreviewProps> = ({
  storybook,
  onClick,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [fullPages, setFullPages] = useState<StorybookPage[] | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const coverImage = storybook.pages && storybook.pages.length > 0
    ? (storybook.pages.find(p => p.page_type === 'cover')?.image_url || storybook.pages[0].image_url)
    : null;

  const handleClick = () => {
    if (onClick) onClick(storybook.id);
    setOpen(true);
    setPageIndex(0);
    if (fullPages) return;
    setLoadingPages(true);
    getStorybook(storybook.id)
      .then(detail => setFullPages(detail.pages ?? []))
      .catch(() => setFullPages(storybook.pages ?? []))
      .finally(() => setLoadingPages(false));
  };

  const pages = fullPages ?? storybook.pages ?? [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowLeft' && pageIndex > 0) setPageIndex(pageIndex - 1);
      if (e.key === 'ArrowRight' && pageIndex < pages.length - 1) setPageIndex(pageIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, pageIndex, pages.length]);

  const currentPage = pages[pageIndex];

  return (
    <div className={`relative ${className}`}>
      {/* 封面卡片 */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        className="group relative aspect-square bg-slate-800 rounded-2xl overflow-hidden hover:opacity-80 transition-all duration-300 hover:scale-105 w-full cursor-pointer"
      >
        {coverImage ? (
          <img src={coverImage} alt={storybook.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-6xl">
            📖
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <div className="text-left w-full">
            <h3 className="font-semibold text-sm line-clamp-2 text-white">{storybook.title}</h3>
            {storybook.description && (
              <p className="text-xs text-slate-300 line-clamp-1 mt-1">{storybook.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* shadcn Dialog，无遮罩背景 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          {/* 不渲染 DialogOverlay，只渲染内容 */}
          <DialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2',
              'bg-white rounded-2xl shadow-2xl border border-slate-200',
              'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            )}
          >
            {/* 标题栏 */}
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 pr-8">
                <BookOpen size={18} className="text-indigo-500 shrink-0" />
                <DialogTitle className="text-base font-semibold text-slate-900 truncate">
                  {storybook.title}
                </DialogTitle>
                {!loadingPages && pages.length > 0 && (
                  <span className="ml-auto text-xs text-slate-400 shrink-0">
                    {pageIndex + 1} / {pages.length}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* 图片区域 */}
            <div className="relative bg-slate-950 rounded-b-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {loadingPages ? (
                <div className="w-full h-full flex items-center justify-center">
                  <LoadingSpinner size={36} />
                </div>
              ) : currentPage?.image_url ? (
                <img
                  src={currentPage.image_url}
                  alt={`第 ${pageIndex + 1} 页`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl text-slate-500">
                  {pageIndex + 1}
                </div>
              )}

              {/* 上一页 */}
              {pageIndex > 0 && (
                <button
                  onClick={() => setPageIndex(pageIndex - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all hover:scale-110"
                >
                  <ChevronLeft size={22} className="text-slate-800" />
                </button>
              )}

              {/* 下一页 */}
              {!loadingPages && pageIndex < pages.length - 1 && (
                <button
                  onClick={() => setPageIndex(pageIndex + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all hover:scale-110"
                >
                  <ChevronRight size={22} className="text-slate-800" />
                </button>
              )}

              {/* 正文文字 */}
              {!loadingPages && currentPage?.text && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 py-5">
                  <p className="text-white text-sm leading-relaxed">{currentPage.text}</p>
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <DialogClose className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 transition-colors hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:outline-none">
              <span className="sr-only">关闭</span>
              ✕
            </DialogClose>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export default StorybookPreview;
