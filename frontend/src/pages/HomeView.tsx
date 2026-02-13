
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react';
import { CreateStorybookRequest, listStorybooks, StorybookListItem } from '../services/storybookService';
import { listTemplates, TemplateListItem } from '../services/templateService';
import StorybookPreview from '../components/StorybookPreview';
import FloatingInputBox from '../components/FloatingInputBox';

interface HomeViewProps {
  onStart?: (params: CreateStorybookRequest) => void;
  onShowMyWorks?: () => void;
  onShowMyTemplates?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, onShowMyWorks, onShowMyTemplates }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [publicStorybooks, setPublicStorybooks] = useState<StorybookListItem[]>([]);
  const [loadingPublicBooks, setLoadingPublicBooks] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const carouselSectionRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [needsCarousel, setNeedsCarousel] = useState(false);

  // Load templates from API
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const data = await listTemplates({ is_active: true, limit: 50 });
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
        setError('无法加载模版列表');
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // Load public storybooks for Community Creations
  useEffect(() => {
    const fetchPublicStorybooks = async () => {
      try {
        setLoadingPublicBooks(true);
        const data = await listStorybooks({
          is_public: true,
          status: 'finished',
          limit: 100
        });
        setPublicStorybooks(data);
      } catch (err) {
        console.error('Failed to load public storybooks:', err);
      } finally {
        setLoadingPublicBooks(false);
      }
    };
    fetchPublicStorybooks();
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    // Close user menu when clicking outside the menu
    if (
      userMenuOpen &&
      userMenuRef.current &&
      !userMenuRef.current.contains(e.target as Node)
    ) {
      setUserMenuOpen(false);
    }
  }, [userMenuOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleStart = (instruction: string) => {
    if (!instruction.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);
    setGenerationStatus('正在跳转到编辑器...');

    try {
      // 不发起请求，直接跳转到 EditorView 并传递创建参数
      const createParams: CreateStorybookRequest = {
        instruction,
        template_id: selectedTemplate?.id,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        creator: 'user'
      };

      if (onStart) {
        onStart(createParams);
      }
    } catch (err) {
      console.error('Failed to navigate to editor:', err);
      setError(err instanceof Error ? err.message : '跳转失败，请重试');
    } finally {
      setIsCreating(false);
      setGenerationStatus(null);
    }
  };

  const handleImageAdd = (newImages: string[]) => {
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  const handleImageRemove = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Carousel auto-scroll — smooth continuous motion via requestAnimationFrame
  useEffect(() => {
    if (carouselPaused || selectedTemplate) return;
    const el = carouselRef.current;
    if (!el) return;

    // 只有当内容宽度超出容器宽度时才启动自动滚动
    const isOverflowing = el.scrollWidth > el.clientWidth;
    setNeedsCarousel(isOverflowing);
    if (!isOverflowing) return;

    let animId: number;
    const speed = 0.5; // px per frame
    const step = () => {
      const halfScroll = el.scrollWidth / 2;
      if (el.scrollLeft >= halfScroll) {
        el.scrollLeft -= halfScroll;
      }
      el.scrollLeft += speed;
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [carouselPaused, selectedTemplate, templates.length]);

  const scrollCarousel = (dir: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  return (
    <div className="relative flex-1 flex flex-col items-center py-12 px-4 pb-32 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <header className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm mb-4">
          <Sparkles size={14} />
          <span>Powered by AI</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold font-lexend text-slate-900 mb-4 tracking-tight">
          Create Your <span className="text-indigo-600">Magic Story</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Transform your imagination into a beautifully illustrated picture book in seconds.
          Just describe your story and pick a style.
        </p>
      </header>

      {/* User Avatar - Fixed Top Right */}
      <div className="fixed top-6 right-6 z-50">
        <div className="relative">
          {/* Avatar Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-11 h-11 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          >
            {/* Custom User Icon - 简洁现代风格 */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Head */}
              <circle cx="10" cy="7" r="3.5" stroke="#64748B" strokeWidth="1.5" fill="none"/>
              {/* Shoulders/Body */}
              <path d="M4.5 17C4.5 14.5 6.5 13 10 13C13.5 13 15.5 14.5 15.5 17" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div ref={userMenuRef} className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  onShowMyWorks?.();
                  setUserMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200 flex items-center gap-2"
              >
                <Sparkles size={16} className="text-indigo-500" />
                <span>我的作品</span>
              </button>
              <button
                onClick={() => {
                  onShowMyTemplates?.();
                  setUserMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200 flex items-center gap-2 border-t border-slate-100"
              >
                <FileText size={16} className="text-indigo-500" />
                <span>我的模版</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Style Templates — Carousel */}
      <section className="w-full mb-16">
        <h2 className="text-2xl font-bold font-lexend text-slate-900 mb-8 text-center">选择你的艺术风格</h2>
        <div
          ref={carouselSectionRef}
          className="relative group/carousel"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          {/* Left arrow */}
          <button
            onClick={() => scrollCarousel(-1)}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-10
                       w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-slate-200
                       shadow-lg flex items-center justify-center
                       opacity-0 group-hover/carousel:opacity-100
                       transition-opacity duration-300 hover:bg-white"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>

          {/* Scrollable track */}
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-auto px-8 pb-2
                       [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {loadingTemplates ? (
              <div className="flex items-center justify-center w-full py-12">
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex items-center justify-center w-full py-12 text-slate-500">
                暂无可用模版
              </div>
            ) : (
              // 只有在需要轮播时才复制模版，否则显示原始列表
              (needsCarousel ? [...templates, ...templates] : templates).map((tmpl, idx) => (
                <button
                  key={`${tmpl.id}-${idx}`}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`group shrink-0 w-60 flex flex-col text-left rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                    selectedTemplate?.id === tmpl.id
                    ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-lg'
                    : 'border-white bg-white hover:border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="h-40 overflow-hidden bg-slate-100 flex items-center justify-center">
                    <span className="text-4xl">📚</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 mb-1">{tmpl.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{tmpl.description || '暂无描述'}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scrollCarousel(1)}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-10
                       w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-slate-200
                       shadow-lg flex items-center justify-center
                       opacity-0 group-hover/carousel:opacity-100
                       transition-opacity duration-300 hover:bg-white"
          >
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>
      </section>

      {/* Showcase Area */}
      <section className="w-full bg-slate-900 rounded-[3rem] py-16 px-8 text-center text-white my-16">
        <h2 className="text-3xl font-bold font-lexend mb-4">Community Creations</h2>
        <p className="text-slate-400 mb-10">See what others have imagined with AIrchieve.</p>

        {loadingPublicBooks ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-indigo-400 animate-spin" />
          </div>
        ) : publicStorybooks.length === 0 ? (
          <div className="py-12 text-slate-500">
            <p className="text-lg">还没有公开的作品</p>
            <p className="text-sm mt-2">成为第一个分享作品的人吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {publicStorybooks.slice(0, 10).map((book) => (
              <StorybookPreview
                key={book.id}
                storybook={book}
                onClick={(id) => {
                  // TODO: 可以添加点击后查看详情的功能
                  console.log('View storybook:', id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Floating Input Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl">
        <FloatingInputBox
          placeholder="描述你的故事创意... 比如：一只名叫 Nutty 的小松鼠在一棵老橡树中发现了一扇神秘的门..."
          collapsedPlaceholder="今天你想创作什么故事？"
          onSubmit={handleStart}
          isLoading={isCreating}
          error={error}
          loadingMessage={generationStatus || '处理中...'}
          templates={templates}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={setSelectedTemplate}
          loadingTemplates={loadingTemplates}
          uploadedImages={uploadedImages}
          onImageAdd={handleImageAdd}
          onImageRemove={handleImageRemove}
        />
      </div>
    </div>
  );
};

export default HomeView;
