
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, FileText, BookOpen, LogOut, Coins, Crown, User, Shield } from 'lucide-react';
import { CreateStorybookRequest, createStorybook, InsufficientPointsError, listStorybooks, StorybookListItem, CliType, AspectRatio, ImageSize } from '../services/storybookService';
import { listTemplates, TemplateListItem } from '../services/templateService';
import StorybookPreview from '../components/StorybookPreview';
import InstructionInputBox from '../components/InstructionInputBox';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface HomeViewProps {
  onStart?: (storybookId: number) => void;
  onShowMyWorks?: () => void;
  onShowMyTemplates?: () => void;
  onShowProfile?: () => void;
  onShowAdmin?: () => void;
}

const MEMBERSHIP_LABEL: Record<string, string> = {
  free: '', lite: 'Lite', pro: 'Pro', max: 'Max',
};

const HomeView: React.FC<HomeViewProps> = ({ onStart, onShowMyWorks, onShowMyTemplates, onShowProfile, onShowAdmin }) => {
  const { user, logout, openLoginModal } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [publicStorybooks, setPublicStorybooks] = useState<StorybookListItem[]>([]);
  const [loadingPublicBooks, setLoadingPublicBooks] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [cliType, setCliType] = useState<CliType>('gemini');
  const [pageCount, setPageCount] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [imageSize, setImageSize] = useState<ImageSize>('1k');
  const carouselSectionRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [needsCarousel, setNeedsCarousel] = useState(false);
  const [pendingCreateParams, setPendingCreateParams] = useState<CreateStorybookRequest | null>(null);

  // 登录后自动执行待处理的创作跳转
  useEffect(() => {
    if (user && pendingCreateParams) {
      const params = pendingCreateParams;
      setPendingCreateParams(null);
      setIsCreating(true);
      createStorybook(params)
        .then((res) => { onStart?.(res.id); })
        .catch((err) => {
          if (err instanceof InsufficientPointsError) {
            toast({ variant: "destructive", title: "积分不足", description: err.message });
          } else {
            toast({ variant: "destructive", title: "创建失败", description: err instanceof Error ? err.message : '请重试' });
          }
        })
        .finally(() => setIsCreating(false));
    }
  }, [user, pendingCreateParams, onStart]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const data = await listTemplates({ is_active: true, limit: 50 });
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
        toast({ variant: "destructive", title: "无法加载模版列表" });
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

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

  const handleStart = async (instruction: string) => {
    if (!instruction.trim() || isCreating) return;

    if (!user) {
      const params: CreateStorybookRequest = {
        instruction,
        template_id: selectedTemplate?.id,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        cli_type: cliType,
        page_count: pageCount,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      };
      setPendingCreateParams(params);
      openLoginModal();
      return;
    }

    setIsCreating(true);
    setGenerationStatus('正在创建绘本...');

    try {
      const res = await createStorybook({
        instruction,
        template_id: selectedTemplate?.id,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        cli_type: cliType,
        page_count: pageCount,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      });
      onStart?.(res.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: "destructive", title: "积分不足", description: err.message });
      } else {
        toast({ variant: "destructive", title: "创建失败", description: err instanceof Error ? err.message : '请重试' });
      }
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

  // Carousel auto-scroll
  useEffect(() => {
    if (carouselPaused || selectedTemplate) return;
    const el = carouselRef.current;
    if (!el) return;

    const isOverflowing = el.scrollWidth > el.clientWidth;
    setNeedsCarousel(isOverflowing);
    if (!isOverflowing) return;

    let animId: number;
    const speed = 0.5;
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
    <div className="relative flex-1 flex flex-col w-full">

      {/* ── Main Content ── */}
      <div className="flex flex-col items-center px-4 pb-20 max-w-6xl mx-auto w-full pt-12">

        {/* ── Hero: 抠图 + 书法标题 ── */}
        <header className="flex items-center justify-center gap-6 md:gap-8 mb-6">
          <img
            src="/caterpillar.png"
            alt="毛毛虫"
            className="w-28 h-28 md:w-36 md:h-36 drop-shadow-2xl shrink-0"
            style={{ filter: 'drop-shadow(0 4px 20px rgba(77,217,192,0.25))' }}
          />
          <h1 className="mao-title text-6xl md:text-7xl lg:text-8xl select-none">
            毛毛虫
          </h1>
        </header>

        {/* Tagline */}
        <p className="text-sm text-sky-200/65 max-w-xl mx-auto leading-relaxed text-center mb-10">
          用 AI 将您的想象变成精美绘本，描述故事创意，选择画风，即刻生成。
          <span className="inline-flex items-center gap-1 ml-2 text-xs text-sky-300/45 align-middle">
            <Sparkles size={10} />
            Powered by AI
          </span>
        </p>

        {/* Input Box */}
        <div className="w-full max-w-2xl mx-auto mb-14">
          <InstructionInputBox
            placeholder="描述您的故事创意... 比如：一只名叫 Nutty 的小松鼠在一棵老橡树中发现了一扇神秘的门..."
            collapsedPlaceholder="今天您想创作什么故事？"
            onSubmit={handleStart}
            isLoading={isCreating}
            loadingMessage={generationStatus || '处理中...'}
            selectedTemplate={selectedTemplate}
            onTemplateSelect={setSelectedTemplate}
            uploadedImages={uploadedImages}
            onImageAdd={handleImageAdd}
            onImageRemove={handleImageRemove}
            cliType={cliType}
            onCliTypeChange={setCliType}
            pageCount={pageCount}
            onPageCountChange={setPageCount}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            imageSize={imageSize}
            onImageSizeChange={setImageSize}
          />
        </div>

        {/* ── Style Templates Carousel ── */}
        <section className="w-full mb-16">
          <h2 className="text-2xl font-bold font-lexend mb-8 text-center">
            <span className="text-teal-400">选择</span>
            <span className="text-slate-100">您的艺术风格</span>
          </h2>
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
                         w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-slate-600/60
                         shadow-lg flex items-center justify-center
                         opacity-0 group-hover/carousel:opacity-100
                         transition-opacity duration-300 hover:bg-slate-700/80"
            >
              <ChevronLeft size={18} className="text-slate-300" />
            </button>

            <div className="relative">
              <div
                ref={carouselRef}
                className="flex gap-5 overflow-x-auto px-8 pb-2
                           [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ overflowY: 'visible' }}
              >
                {loadingTemplates ? (
                  <LoadingSpinner size={32} color="text-teal-400" className="w-full py-12" />
                ) : templates.length === 0 ? (
                  <div className="flex items-center justify-center w-full py-12 text-slate-400">
                    暂无可用模版
                  </div>
                ) : (
                  (needsCarousel ? [...templates, ...templates] : templates).map((tmpl, idx) => {
                    const previewStorybook = tmpl.storybook_id && tmpl.cover_image
                      ? {
                          id: tmpl.storybook_id,
                          title: tmpl.name,
                          description: tmpl.description,
                          creator: tmpl.creator,
                          status: 'finished' as const,
                          is_public: false,
                          created_at: tmpl.created_at,
                          pages: [{ image_url: tmpl.cover_image, text: '', page_type: 'cover' as const }],
                        }
                      : null;

                    return (
                      <div
                        key={`${tmpl.id}-${idx}`}
                        className={`group shrink-0 w-60 flex flex-col text-left rounded-2xl transition-all duration-500 relative ${
                          selectedTemplate?.id === tmpl.id
                          ? 'shadow-[0_8px_30px_rgba(251,191,36,0.25)] bg-amber-400/5 backdrop-blur-sm'
                          : 'border border-slate-600/40 bg-slate-800/50 backdrop-blur-sm hover:border-teal-400/40 hover:bg-slate-700/50 shadow-sm hover:shadow-md hover:shadow-teal-900/20'
                        }`}
                      >
                        {/* 选中边框 - 用独立元素避免被遮挡 */}
                        {selectedTemplate?.id === tmpl.id && (
                          <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/50 pointer-events-none" />
                        )}
                        {/* 已选中标记 */}
                        {selectedTemplate?.id === tmpl.id && (
                          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[11px] font-bold shadow-sm">
                            ✓ 已选择
                          </div>
                        )}
                        {/* 样本绘本预览 */}
                        {previewStorybook ? (
                          <div className="rounded-t-2xl overflow-hidden">
                            <StorybookPreview storybook={previewStorybook as any} />
                          </div>
                        ) : (
                          <div className="h-40 bg-slate-700/50 rounded-t-2xl flex items-center justify-center">
                            <span className="text-4xl">📚</span>
                          </div>
                        )}

                        <button
                          onClick={() => setSelectedTemplate(selectedTemplate?.id === tmpl.id ? null : tmpl)}
                          className="p-4 text-left w-full hover:bg-slate-700/30 transition-colors rounded-b-2xl"
                        >
                          <h3 className="font-bold text-slate-100 mb-1">{tmpl.name}</h3>
                          <p className="text-xs text-slate-400 line-clamp-2">{tmpl.description || '暂无描述'}</p>
                          {previewStorybook && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-teal-400">
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
                         w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-slate-600/60
                         shadow-lg flex items-center justify-center
                         opacity-0 group-hover/carousel:opacity-100
                         transition-opacity duration-300 hover:bg-slate-700/80"
            >
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          </div>
        </section>

        {/* ── Community Showcase ── */}
        <section className="w-full rounded-[2.5rem] py-14 px-8 text-center my-8
                            bg-slate-900/40 backdrop-blur-sm border border-slate-700/40">
          <h2 className="text-3xl font-bold font-lexend mb-3 text-slate-100">大家的创作</h2>
          <p className="text-slate-400 mb-10 text-sm">看看其他人都在用毛毛虫创作什么故事</p>

          {loadingPublicBooks ? (
            <LoadingSpinner size={32} color="text-teal-400" className="py-12" />
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
                    console.log('View storybook:', id);
                  }}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── User Avatar — Fixed Top Right ── */}
      <div className="fixed top-6 right-6 z-50">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-11 h-11 rounded-full bg-slate-800/80 backdrop-blur border-2 border-slate-600/60
                           flex items-center justify-center
                           hover:border-teal-400/60 hover:bg-slate-700/80
                           transition-all duration-300 hover:scale-105 active:scale-95
                           shadow-md hover:shadow-teal-900/30 overflow-hidden"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-teal-300">
                    {user?.nickname?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-slate-900/95 backdrop-blur-xl border-slate-700/60 text-slate-300"
            >
              <DropdownMenuLabel className="bg-slate-800/50 border-b border-slate-700/60">
                <p className="text-sm font-semibold text-slate-100 truncate">{user?.nickname}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Coins size={12} />
                    {user?.points_balance ?? 0} 积分
                  </span>
                  {user && user.membership_level !== 'free' && (
                    <span className="flex items-center gap-1 text-xs text-teal-400">
                      <Crown size={12} />
                      {MEMBERSHIP_LABEL[user.membership_level]}
                    </span>
                  )}
                  {user && user.free_creation_remaining > 0 && (
                    <span className="text-xs text-emerald-400">免费 ×{user.free_creation_remaining}</span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onShowProfile?.()} className="gap-2 focus:bg-slate-700/50 focus:text-slate-100">
                <User size={16} className="text-teal-400" /> 个人主页
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <DropdownMenuItem onClick={() => onShowAdmin?.()} className="gap-2 focus:bg-slate-700/50 focus:text-slate-100">
                  <Shield size={16} className="text-rose-400" /> 用户管理
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onShowMyWorks?.()} className="gap-2 focus:bg-slate-700/50 focus:text-slate-100">
                <Sparkles size={16} className="text-teal-400" /> 我的作品
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700/40" />
              <DropdownMenuItem onClick={() => onShowMyTemplates?.()} className="gap-2 focus:bg-slate-700/50 focus:text-slate-100">
                <FileText size={16} className="text-teal-400" /> 我的模版
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700/40" />
              <DropdownMenuItem onClick={() => logout()} className="gap-2 text-red-400 focus:bg-red-900/30 focus:text-red-300">
                <LogOut size={16} /> 退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={openLoginModal}
            className="px-4 py-2 rounded-full
                       bg-slate-800/70 backdrop-blur
                       border border-sky-500/40
                       text-sm font-semibold text-sky-300
                       hover:border-sky-400/70 hover:bg-slate-700/70 hover:text-sky-200
                       transition-all shadow-md shadow-slate-900/30"
          >
            登录
          </button>
        )}
      </div>

    </div>
  );
};

export default HomeView;
