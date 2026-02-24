import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StorybookListItem } from '../services/storybookService';

interface StorybookPreviewProps {
  storybook: StorybookListItem;
  onClick?: (id: number) => void;
  className?: string;
  popupPosition?: 'top' | 'center'; // 弹出位置：top=父元素上方（默认），center=屏幕中央
  popupMaxWidth?: string; // 弹出层最大宽度，默认 '90vw'
  popupScale?: number; // 弹出层缩放比例，默认 3
}

const StorybookPreview: React.FC<StorybookPreviewProps> = ({
  storybook,
  onClick,
  className = '',
  popupPosition = 'top',
  popupMaxWidth = '90vw',
  popupScale = 3,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (onClick) {
      onClick(storybook.id);
    }
  };

  // 获取封面图（第一页的图片）
  const coverImage = storybook.pages && storybook.pages.length > 0
    ? storybook.pages[0].image_url
    : null;

  // 检查是否可以滚动
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  // 滚动到指定位置
  const scrollTo = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current && cardRef.current) {
      const cardWidth = cardRef.current.offsetWidth;
      const gap = 16; // gap-4 = 16px
      const scrollAmount = cardWidth + gap;
      const newPosition = direction === 'left'
        ? scrollPosition - scrollAmount
        : scrollPosition + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
      setScrollPosition(newPosition);
    }
  };

  // 监听滚动事件
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, [isHovered]);

  // 监听ESC键关闭放大视图，左右箭头键切换页面
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPageIndex === null) return;

      if (e.key === 'Escape') {
        setSelectedPageIndex(null);
      } else if (e.key === 'ArrowLeft' && selectedPageIndex > 0) {
        setSelectedPageIndex(selectedPageIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedPageIndex < storybook.pages.length - 1) {
        setSelectedPageIndex(selectedPageIndex + 1);
      }
    };

    if (selectedPageIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedPageIndex, storybook.pages.length]);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 主卡片 - 显示封面 */}
      <div ref={cardRef}>
        <button
          onClick={handleClick}
          className="group relative aspect-square bg-slate-800 rounded-2xl overflow-hidden hover:opacity-80 transition-all duration-300 hover:scale-105 w-full"
        >
          {/* 封面图片或占位符 */}
          {coverImage ? (
            <img
              src={coverImage}
              alt={storybook.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-6xl">
              📖
            </div>
          )}

          {/* 悬浮时显示标题 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <div className="text-left w-full">
              <h3 className="font-semibold text-sm line-clamp-2 text-white">{storybook.title}</h3>
              {storybook.description && (
                <p className="text-xs text-slate-300 line-clamp-1 mt-1">{storybook.description}</p>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* 悬浮弹出层 - 显示所有页面 */}
      {isHovered && storybook.pages && storybook.pages.length > 0 && (
        popupPosition === 'center' ? (
          // 屏幕中央模态框模式
          <div
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setIsHovered(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
              style={{
                width: cardRef.current ? `${cardRef.current.offsetWidth * popupScale + 64}px` : '600px',
                maxWidth: popupMaxWidth,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* 标题和关闭按钮 */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                  <BookOpen size={20} className="text-indigo-600" />
                  <h3 className="font-bold text-lg">{storybook.title}</h3>
                  <span className="text-xs text-slate-500 ml-2">共 {storybook.pages.length} 页</span>
                </div>
                <button
                  onClick={() => setIsHovered(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 页面预览轮播 */}
              <div className="relative px-6 py-5">
                {/* 左箭头 */}
                {canScrollLeft && (
                  <button
                    onClick={() => scrollTo('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-200 hover:scale-110 ml-1"
                  >
                    <ChevronLeft size={20} className="text-slate-700" />
                  </button>
                )}

                {/* 右箭头 */}
                {canScrollRight && (
                  <button
                    onClick={() => scrollTo('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-200 hover:scale-110 mr-1"
                  >
                    <ChevronRight size={20} className="text-slate-700" />
                  </button>
                )}

                {/* 滚动容器 */}
                <div
                  ref={scrollContainerRef}
                  className="overflow-x-auto scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div className="flex gap-4">
                    {storybook.pages.map((page, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedPageIndex(index)}
                        className="flex-shrink-0 group/page relative rounded-xl overflow-hidden bg-slate-100 hover:ring-2 hover:ring-indigo-500 transition-all duration-300 hover:shadow-xl cursor-pointer"
                        style={{
                          width: cardRef.current ? `${cardRef.current.offsetWidth}px` : '200px',
                          aspectRatio: '16/9'
                        }}
                      >
                        {/* 页面图片 */}
                        {page.image_url ? (
                          <img
                            src={page.image_url}
                            alt={`Page ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-4xl text-slate-500">
                            {index + 1}
                          </div>
                        )}

                        {/* 页码标签 */}
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg font-medium shadow-lg">
                          {index + 1}
                        </div>

                        {/* 文字悬浮层 */}
                        {page.text && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent opacity-0 group-hover/page:opacity-100 transition-all duration-300 px-3 py-2.5 max-h-[45%] overflow-hidden">
                            <p className="text-white text-[0.7rem] leading-snug line-clamp-3">
                              {page.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // 父元素上方模式（默认）
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{
              width: cardRef.current ? `${cardRef.current.offsetWidth * popupScale + 64}px` : '600px',
              maxWidth: popupMaxWidth,
              paddingBottom: '24px' // 桥接区域
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* 标题 */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-center gap-2 text-slate-900">
                <BookOpen size={20} className="text-indigo-600" />
                <h3 className="font-bold text-lg">{storybook.title}</h3>
                <span className="text-xs text-slate-500 ml-auto">共 {storybook.pages.length} 页</span>
              </div>
            </div>

            {/* 页面预览轮播 */}
            <div className="relative px-6 py-5">
              {/* 左箭头 */}
              {canScrollLeft && (
                <button
                  onClick={() => scrollTo('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-200 hover:scale-110 ml-1"
                >
                  <ChevronLeft size={20} className="text-slate-700" />
                </button>
              )}

              {/* 右箭头 */}
              {canScrollRight && (
                <button
                  onClick={() => scrollTo('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-200 hover:scale-110 mr-1"
                >
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
              )}

              {/* 滚动容器 */}
              <div
                ref={scrollContainerRef}
                className="overflow-x-auto scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="flex gap-4">
                  {storybook.pages.map((page, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedPageIndex(index)}
                      className="flex-shrink-0 group/page relative rounded-xl overflow-hidden bg-slate-100 hover:ring-2 hover:ring-indigo-500 transition-all duration-300 hover:shadow-xl cursor-pointer"
                      style={{
                        width: cardRef.current ? `${cardRef.current.offsetWidth}px` : '200px',
                        aspectRatio: '16/9'
                      }}
                    >
                      {/* 页面图片 */}
                      {page.image_url ? (
                        <img
                          src={page.image_url}
                          alt={`Page ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-4xl text-slate-500">
                          {index + 1}
                        </div>
                      )}

                      {/* 页码标签 */}
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg font-medium shadow-lg">
                        {index + 1}
                      </div>

                      {/* 文字悬浮层 */}
                      {page.text && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent opacity-0 group-hover/page:opacity-100 transition-all duration-300 px-3 py-2.5 max-h-[45%] overflow-hidden">
                          <p className="text-white text-[0.7rem] leading-snug line-clamp-3">
                            {page.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

            {/* 箭头指示器 */}
            <div className="w-3 h-3 bg-white border-b border-r border-slate-200 absolute left-1/2 -translate-x-1/2 -bottom-1.5 rotate-45" />
          </div>
        )
      )}

      {/* 放大视图模态框 */}
      {selectedPageIndex !== null && storybook.pages[selectedPageIndex] && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedPageIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedPageIndex(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
            >
              <X size={32} />
            </button>

            {/* 左箭头 - 上一页 */}
            {selectedPageIndex > 0 && (
              <button
                onClick={() => setSelectedPageIndex(selectedPageIndex - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-2xl rounded-full p-3 transition-all duration-200 hover:scale-110"
              >
                <ChevronLeft size={28} className="text-slate-800" />
              </button>
            )}

            {/* 右箭头 - 下一页 */}
            {selectedPageIndex < storybook.pages.length - 1 && (
              <button
                onClick={() => setSelectedPageIndex(selectedPageIndex + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-2xl rounded-full p-3 transition-all duration-200 hover:scale-110"
              >
                <ChevronRight size={28} className="text-slate-800" />
              </button>
            )}

            {/* 放大的图片 */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900">
              {storybook.pages[selectedPageIndex].image_url ? (
                <img
                  src={storybook.pages[selectedPageIndex].image_url}
                  alt={`Page ${selectedPageIndex + 1}`}
                  className="w-full h-auto"
                  style={{ aspectRatio: '16/9' }}
                />
              ) : (
                <div
                  className="w-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-6xl text-slate-400"
                  style={{ aspectRatio: '16/9' }}
                >
                  {selectedPageIndex + 1}
                </div>
              )}

              {/* 页码标签 */}
              <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-xl font-medium shadow-lg">
                第 {selectedPageIndex + 1} 页
              </div>

              {/* 文字内容 - 放大后显示在底部 */}
              {storybook.pages[selectedPageIndex].text && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent px-8 py-6">
                  <p className="text-white text-base md:text-lg leading-relaxed">
                    {storybook.pages[selectedPageIndex].text}
                  </p>
                </div>
              )}
            </div>

            {/* 导航提示 */}
            <div className="mt-6 text-center text-slate-400 text-sm">
              <span>点击图片外部或按 ESC 键关闭</span>
              {storybook.pages.length > 1 && (
                <>
                  <span className="mx-2">|</span>
                  <span>← → 切换页面</span>
                  <span className="mx-2">|</span>
                  <span className="font-medium text-slate-300">
                    {selectedPageIndex + 1} / {storybook.pages.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorybookPreview;
