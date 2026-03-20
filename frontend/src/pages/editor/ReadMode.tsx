import React, { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorybookPage } from '../../services/storybookService';

interface ReadModeProps {
  pages: StorybookPage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isGenerating?: boolean;
}

const ReadMode: React.FC<ReadModeProps> = ({ pages, currentIndex, onIndexChange, isGenerating }) => {
  const prev = useCallback(() => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange]);

  const next = useCallback(() => {
    if (currentIndex < pages.length - 1) onIndexChange(currentIndex + 1);
  }, [currentIndex, pages.length, onIndexChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, prev]);

  const page = pages[currentIndex];
  if (!page) return null;
  const pageTypeLabel = page.page_type === 'cover'
    ? '封面'
    : page.page_type === 'back_cover'
      ? '封底'
      : '内页';

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <div className="relative w-full">
        {/* Left nav */}
        <Button
          variant="ghost" size="icon"
          onClick={prev}
          disabled={currentIndex === 0}
          className="absolute -left-4 md:-left-14 top-[45%] -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full shadow-lg z-40 disabled:opacity-0 hover:scale-110 h-12 w-12"
        >
          <ChevronLeft size={28} />
        </Button>

        {/* Page card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
            <img
              src={page.image_url}
              alt={`第 ${currentIndex + 1} 页`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-md">
              {pageTypeLabel}
            </div>
            {page.text && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-6 pt-10 pb-4">
                <p className="text-white text-sm md:text-base lg:text-lg font-lexend leading-relaxed text-center drop-shadow">
                  {page.text}
                </p>
              </div>
            )}
          </div>
          <div className="py-2.5 px-4 flex items-center justify-center border-t border-slate-100">
            <span className="text-sm text-slate-500 font-medium">
              {currentIndex + 1} / {pages.length} 页
            </span>
          </div>
        </div>


        {isGenerating && currentIndex === pages.length - 1 && (
          <div className="mt-3 flex items-center justify-center text-xs text-[#00b0b8] font-medium">
            下一页正在绘制中…
          </div>
        )}

        <Button
          variant="ghost" size="icon"
          onClick={next}
          disabled={currentIndex >= pages.length - 1}
          className="absolute -right-4 md:-right-14 top-[45%] -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full shadow-lg z-40 disabled:opacity-0 hover:scale-110 h-12 w-14"
        >
          <ChevronRight size={28} />
        </Button>
      </div>

      {/* Dot navigation */}
      <div className="mt-4 flex gap-2 items-center">
        {pages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => onIndexChange(idx)}
            className={`h-1.5 transition-all duration-500 rounded-full ${
              currentIndex === idx ? 'w-8 bg-[#00CDD4]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
        {isGenerating && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#00CDD4] animate-pulse" />
        )}
      </div>
    </div>
  );
};

export default ReadMode;
