
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Loader2, FileText, BookOpen, LogOut, Coins, Crown, User } from 'lucide-react';
import { CreateStorybookRequest, listStorybooks, getStorybook, StorybookListItem, Storybook } from '../services/storybookService';
import { listTemplates, TemplateListItem, Template } from '../services/templateService';
import StorybookPreview from '../components/StorybookPreview';
import FloatingInputBox from '../components/FloatingInputBox';
import { useAuth } from '../contexts/AuthContext';

interface HomeViewProps {
  onStart?: (params: CreateStorybookRequest) => void;
  onShowMyWorks?: () => void;
  onShowMyTemplates?: () => void;
  onShowProfile?: () => void;
}

const MEMBERSHIP_LABEL: Record<string, string> = {
  free: '', lite: 'Lite', pro: 'Pro', max: 'Max',
};

const HomeView: React.FC<HomeViewProps> = ({ onStart, onShowMyWorks, onShowMyTemplates, onShowProfile }) => {
  const { user, logout, openLoginModal } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateStorybooks, setTemplateStorybooks] = useState<Map<number, Storybook>>(new Map());
  const [templateStorybookIds, setTemplateStorybookIds] = useState<Map<number, number>>(new Map());
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
  const [pendingCreateParams, setPendingCreateParams] = useState<CreateStorybookRequest | null>(null);

  // 登录后自动执行待处理的创作跳转
  useEffect(() => {
    if (user && pendingCreateParams) {
      setPendingCreateParams(null);
      onStart?.(pendingCreateParams);
    }
  }, [user, pendingCreateParams, onStart]);

  // Load storybooks associated with templates
  const loadTemplateStorybooks = async (templateList: TemplateListItem[]) => {
    try {
      const storybookIds = new Set<number>();
      const templateIdMap = new Map<number, number>();

      // 获取每个模版的详细信息以获得 storybook_id
      const templateDetails = await Promise.all(
        templateList.map(async (t) => {
          try {
            const response = await fetch(`/api/v1/templates/${t.id}`);
            if (response.ok) {
              return await response.json() as Template;
            }
          } catch (err) {
            console.error(`Failed to load template ${t.id} details:`, err);
          }
          return null;
        })
      );

      // 收集所有 storybook_id 和建立映射
      templateDetails.forEach(t => {
        if (t?.storybook_id) {
          storybookIds.add(t.storybook_id);
          templateIdMap.set(t.id, t.storybook_id);
        }
      });

      setTemplateStorybookIds(templateIdMap);

      // 批量获取 storybooks
      if (storybookIds.size > 0) {
        const storybookMap = new Map<number, Storybook>();
        await Promise.all(
          Array.from(storybookIds).map(async (id) => {
            try {
              const storybook = await getStorybook(id);
              storybookMap.set(id, storybook);
            } catch (err) {
              console.error(`Failed to load storybook ${id}:`, err);
            }
          })
        );
        setTemplateStorybooks(storybookMap);
      }
    } catch (err) {
      console.error('Failed to load template storybooks:', err);
    }
  };

  // Load templates from API
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const data = await listTemplates({ is_active: true, limit: 50 });
        setTemplates(data);
        // 加载关联的样本绘本
        await loadTemplateStorybooks(data);
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

    // 未登录时，先弹出登录框，登录完成后再跳转
    if (!user) {
      const createParams: CreateStorybookRequest = {
        instruction,
        template_id: selectedTemplate?.id,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      };
      setPendingCreateParams(createParams);
      openLoginModal();
      return;
    }

    setIsCreating(true);
    setError(null);
    setGenerationStatus('正在跳转到编辑器...');

    try {
      // 不发起请求，直接跳转到 EditorView 并传递创建参数
      const createParams: CreateStorybookRequest = {
        instruction,
        template_id: selectedTemplate?.id,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
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
    <div className="relative flex-1 flex flex-col items-center py-12 px-4 pb-20 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <header className="text-center mb-8">
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

      {/* Input Box — sticky, inline below hero */}
      <div className="sticky top-4 z-40 w-full max-w-2xl mx-auto mb-14">
        <FloatingInputBox
          placeholder="描述你的故事创意... 比如：一只名叫 Nutty 的小松鼠在一棵老橡树中发现了一扇神秘的门..."
          collapsedPlaceholder="今天你想创作什么故事？"
          onSubmit={handleStart}
          isLoading={isCreating}
          error={error}
          loadingMessage={generationStatus || '处理中...'}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={setSelectedTemplate}
          uploadedImages={uploadedImages}
          onImageAdd={handleImageAdd}
          onImageRemove={handleImageRemove}
        />
      </div>

      {/* User Avatar - Fixed Top Right */}
      <div className="fixed top-6 right-6 z-50">
        {user ? (
        <div className="relative" ref={userMenuRef}>
          {/* Avatar Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-11 h-11 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:border-indigo-300 hover:bg-slate-50 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md overflow-hidden"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-indigo-600">
                {user?.nickname?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.nickname}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <Coins size={12} />
                    {user?.points_balance ?? 0} 积分
                  </span>
                  {user && user.membership_level !== 'free' && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600">
                      <Crown size={12} />
                      {MEMBERSHIP_LABEL[user.membership_level]}
                    </span>
                  )}
                  {user && user.free_creation_remaining > 0 && (
                    <span className="text-xs text-emerald-600">
                      免费 ×{user.free_creation_remaining}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => { onShowProfile?.(); setUserMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 border-t border-slate-100"
              >
                <User size={16} className="text-indigo-500" />
                <span>个人主页</span>
              </button>
              <button
                onClick={() => { onShowMyWorks?.(); setUserMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Sparkles size={16} className="text-indigo-500" />
                <span>我的作品</span>
              </button>
              <button
                onClick={() => { onShowMyTemplates?.(); setUserMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 border-t border-slate-100"
              >
                <FileText size={16} className="text-indigo-500" />
                <span>我的模版</span>
              </button>
              <button
                onClick={() => { logout(); setUserMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100"
              >
                <LogOut size={16} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
        ) : (
          <button
            onClick={openLoginModal}
            className="px-4 py-2 rounded-full bg-white border-2 border-slate-200 text-sm font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
          >
            登录
          </button>
        )}
      </div>

      {/* Style Templates — Carousel */}
      <section className="w-full mb-16">
        <h2 className="text-2xl font-bold font-lexend text-slate-900 mb-8 text-center">选择你的艺术风格</h2>
        <div
          ref={carouselSectionRef}
          className="relative group/carousel overflow-visible"
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

          {/* Scrollable track - wrapper without overflow */}
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-5 overflow-x-auto px-8 pb-2
                         [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ overflowY: 'visible' }}
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
              (needsCarousel ? [...templates, ...templates] : templates).map((tmpl, idx) => {
                // 获取该模版关联的样本绘本
                const storybookId = templateStorybookIds.get(tmpl.id);
                const sampleStorybook = storybookId ? templateStorybooks.get(storybookId) : null;

                return (
                  <div
                    key={`${tmpl.id}-${idx}`}
                    className={`group shrink-0 w-60 flex flex-col text-left rounded-2xl transition-all duration-500 relative ${
                      selectedTemplate?.id === tmpl.id
                      ? 'shadow-[0_8px_30px_rgb(251,191,36,0.3),0_0_0_3px_rgb(251,191,36,0.4)] bg-gradient-to-br from-amber-50 via-white to-orange-50'
                      : 'border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-indigo-200 hover:from-indigo-50/30 hover:to-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* 已选中标记 */}
                    {selectedTemplate?.id === tmpl.id && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[11px] font-bold shadow-sm">
                        ✓ 已选择
                      </div>
                    )}
                    {/* 样本绘本预览 - 直接使用 StorybookPreview */}
                    {sampleStorybook ? (
                      <div className="rounded-t-2xl overflow-hidden">
                        <StorybookPreview
                          storybook={sampleStorybook as any}
                          popupPosition="center"
                          popupMaxWidth="80vw"
                          popupScale={2.5}
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-slate-100 rounded-t-2xl flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedTemplate(selectedTemplate?.id === tmpl.id ? null : tmpl)}
                      className="p-4 text-left w-full hover:bg-slate-50/50 transition-colors rounded-b-2xl"
                    >
                      <h3 className="font-bold text-slate-900 mb-1">{tmpl.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{tmpl.description || '暂无描述'}</p>
                      {sampleStorybook && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-indigo-600">
                          <BookOpen size={12} />
                          <span>样本绘本</span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
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

    </div>
  );
};

export default HomeView;
