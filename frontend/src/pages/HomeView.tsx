/**
 * 首页 - 绘本创建入口
 * 支持向导式创建流程：输入指令 → 预览故事 → 编辑分镜 → 创建绘本
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, BookOpen, LogOut, Coins, Crown, User, Shield } from 'lucide-react';
import { listTemplates, TemplateListItem } from '../services/templateService';
import { createStory, createStorybookFromStory, InsufficientPointsError, listStorybooks, StorybookListItem } from '../services/storybookService';
import { generateStoryboard } from '../services/storyboardService';
import StorybookPreview from '../components/StorybookPreview';
import LoadingSpinner from '../components/LoadingSpinner';
import InstructionInputStep from '../components/steps/InstructionInputStep';
import StoryPreviewStep from '../components/steps/StoryPreviewStep';
import StoryboardEditStep from '../components/steps/StoryboardEditStep';
import CreateStorybookStep from '../components/steps/CreateStorybookStep';
import { useAuth } from '../contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { CreationState, StoryParams, CreationParams, StoryboardItem } from '../types/creation';

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

const defaultStoryParams: StoryParams = {
  word_count: 500,
  story_type: 'fairy_tale',
  language: 'zh',
  age_group: '3_6',
};

const defaultCreationParams: CreationParams = {
  page_count: 10,
  aspect_ratio: '16:9',
  image_size: '1k',
  cli_type: 'doubao',
};

const HomeView: React.FC<HomeViewProps> = ({
  onStart,
  onShowMyWorks,
  onShowMyTemplates,
  onShowProfile,
  onShowAdmin,
}) => {
  const { user, logout, openLoginModal } = useAuth();
  const { toast } = useToast();

  // 创建流程状态
  const [step, setStep] = useState<CreationState['step']>('input');
  const [storyParams, setStoryParams] = useState<StoryParams>(defaultStoryParams);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [originalInstruction, setOriginalInstruction] = useState('');
  const [storyboards, setStoryboards] = useState<StoryboardItem[]>([]);
  const [creationParams, setCreationParams] = useState<CreationParams>(defaultCreationParams);

  // 模板和公开作品列表
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [publicStorybooks, setPublicStorybooks] = useState<StorybookListItem[]>([]);
  const [loadingPublicBooks, setLoadingPublicBooks] = useState(true);

  // UI 状态
  const [isCreating, setIsCreating] = useState(false);

  // 步骤挂载计数器，用于强制重新挂载组件
  const [stepMountKey, setStepMountKey] = useState(0);

  // 加载模板列表
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await listTemplates({ is_active: true, limit: 50 });
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  // 加载公开作品
  useEffect(() => {
    const fetchPublicStorybooks = async () => {
      try {
        setLoadingPublicBooks(true);
        const data = await listStorybooks({
          is_public: true,
          status: 'finished',
          limit: 100,
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

  // 步骤1：输入指令并创建故事
  const handleStart = useCallback(async (prompt: string, mode: 'ai' | 'manual') => {
    if (!prompt.trim() || isCreating) return;

    if (!user) {
      openLoginModal();
      return;
    }

    setIsCreating(true);

    try {
      if (mode === 'manual') {
        // 直接输入模式：用故事内容生成分镜，跳过故事预览
        setStoryTitle(prompt.slice(0, 20) + (prompt.length > 20 ? '...' : ''));
        setStoryContent(prompt);
        setOriginalInstruction(prompt);

        const { storyboards: newStoryboards } = await generateStoryboard({
          story_content: prompt,
          page_count: 10,
          cli_type: creationParams.cli_type,
        });

        setStoryboards(newStoryboards);
        setStep('storyboard');
        setStepMountKey(prev => prev + 1);
      } else {
        const { title, content } = await createStory({
          instruction: prompt,
          word_count: storyParams.word_count,
          story_type: storyParams.story_type,
          language: storyParams.language,
          age_group: storyParams.age_group,
          cli_type: creationParams.cli_type,
        });

        setStoryTitle(title);
        setStoryContent(content);
        setOriginalInstruction(prompt);
        setStep('story');
        setStepMountKey(prev => prev + 1);
      }
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({
          variant: 'destructive',
          title: '创建失败',
          description: err instanceof Error ? err.message : '请重试',
        });
      }
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, user, storyParams, creationParams, toast]);

  // 步骤2：确认故事并生��分镜
  const handleStoryConfirm = useCallback(async (title: string, content: string, pageCount: number) => {
    setIsCreating(true);

    try {
      const { storyboards: newStoryboards } = await generateStoryboard({
        story_content: content,
        page_count: pageCount,
        cli_type: creationParams.cli_type,
      });

      setStoryTitle(title);
      setStoryContent(content);
      setStoryboards(newStoryboards);
      setStep('storyboard');
      setStepMountKey(prev => prev + 1);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '生成分镜失败',
        description: err instanceof Error ? err.message : '请重试',
      });
    } finally {
      setIsCreating(false);
    }
  }, [creationParams, toast]);

  // 步骤3：确认分镜
  const handleStoryboardConfirm = useCallback((updatedStoryboards: StoryboardItem[]) => {
    setStoryboards(updatedStoryboards);
    setStep('creating');
    setStepMountKey(prev => prev + 1);
  }, []);

  // 步骤4：创建绘本
  const handleCreateStorybook = useCallback(async (
    templateId: number | null,
    images: string[],
    params: CreationParams
  ) => {
    if (!user) {
      openLoginModal();
      return;
    }

    setIsCreating(true);

    try {
      // 将分镜转换为 StorybookPage 格式
      const pages = storyboards.map((item) => ({
        text: item.text,
        image_url: '',
        storyboard: item.storyboard,
        page_type: 'content' as const,
      }));

      const res = await createStorybookFromStory({
        title: storyTitle,
        description: originalInstruction.slice(0, 200),
        template_id: templateId || undefined,
        images: images.length > 0 ? images : undefined,
        cli_type: params.cli_type,
        aspect_ratio: params.aspect_ratio,
        image_size: params.image_size,
        pages: pages,
      });

      toast({ title: '开始制作' });
      onStart?.(res.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({
          variant: 'destructive',
          title: '创建失败',
          description: err instanceof Error ? err.message : '请重试',
        });
      }
    } finally {
      setIsCreating(false);
    }
  }, [storyTitle, originalInstruction, storyboards, user, openLoginModal, toast, onStart]);

  // 导航处理
  const handleBack = useCallback(() => {
    switch (step) {
      case 'story':
        setStep('input');
        break;
      case 'storyboard':
        // 如果跳过了故事预览步骤（手动输入模式），则返回输入
        if (!storyTitle && storyContent) {
          setStep('input');
        } else {
          setStep('story');
        }
        break;
      case 'creating':
        setStep('storyboard');
        break;
    }
  }, [step, storyTitle, storyContent]);

  // 步骤指示器
  const steps: Array<{ key: CreationState['step']; label: string }> = [
    { key: 'input', label: '输入指令' },
    { key: 'story', label: '预览故事' },
    { key: 'storyboard', label: '编辑分镜' },
    { key: 'creating', label: '创建绘本' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="relative flex-1 flex flex-col w-full min-h-screen">
      {/* 固定顶部导航 - 仅在非初始步骤时显示 */}
      {step !== 'input' && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* 上一步按钮 */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">上一步</span>
            </button>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-2">
              {steps.map((s, index) => (
                <React.Fragment key={s.key}>
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                      index === currentStepIndex
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : index < currentStepIndex
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-700/50 text-slate-500'
                    }`}
                  >
                    {index < currentStepIndex ? '✓' : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 ${
                        index < currentStepIndex ? 'bg-emerald-500/30' : 'bg-slate-700/50'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 下一步按钮（占位，实际由各步骤内部处理） */}
            <div className="w-24" />
          </div>
        </header>
      )}

      {/* 可滚动内容区 */}
      <main className="flex-1 overflow-y-auto pt-20 pb-8 px-4">
        <div className="max-w-7xl mx-auto w-full">
          {/* 步骤内容 */}
          {step === 'input' && (
            <div className="space-y-12">
              {/* Hero 区 */}
              <div className="text-center pt-8 pb-12">
                <div className="flex items-center justify-center gap-6 md:gap-8 mb-6">
                  <img
                    src="/caterpillar.png"
                    alt="毛毛虫"
                    className="w-28 h-28 md:w-36 md:h-36 drop-shadow-2xl"
                    style={{ filter: 'drop-shadow(0 4px 20px rgba(77,217,192,0.25))' }}
                  />
                  <h1 className="mao-title text-6xl md:text-7xl lg:text-8xl select-none">
                    毛毛虫
                  </h1>
                </div>
                <p className="text-sm text-sky-200/65 max-w-xl mx-auto leading-relaxed">
                  用 AI 将您的想象变成精美绘本，描述故事创意，即刻生成。
                  <span className="inline-flex items-center gap-1 ml-2 text-xs text-sky-300/45">
                    <Sparkles size={10} />
                    Powered by AI
                  </span>
                </p>
              </div>

              {/* 输入指令步骤 */}
              <InstructionInputStep
                storyParams={storyParams}
                onStoryParamsChange={setStoryParams}
                cli_type={creationParams.cli_type}
                onCliTypeChange={(v) => setCreationParams(prev => ({ ...prev, cli_type: v }))}
                onSubmit={handleStart}
              />
            </div>
          )}

          {step === 'story' && (
            <StoryPreviewStep
              key={stepMountKey}
              initialTitle={storyTitle}
              initialContent={storyContent}
              onNext={handleStoryConfirm}
              onBack={handleBack}
            />
          )}

          {step === 'storyboard' && (
            <StoryboardEditStep
              key={stepMountKey}
              storyTitle={storyTitle}
              storyContent={storyContent}
              initialStoryboards={storyboards}
              onNext={handleStoryboardConfirm}
              onBack={handleBack}
            />
          )}

          {step === 'creating' && (
            <CreateStorybookStep
              key={stepMountKey}
              storyTitle={storyTitle}
              storyContent={storyContent}
              storyboards={storyboards}
              templates={templates}
              cli_type={creationParams.cli_type}
              onCreate={handleCreateStorybook}
              onBack={handleBack}
            />
          )}

          {/* 大家的创作 - 所有步骤都显示 */}
          <section className="mt-16 rounded-[2.5rem] py-14 px-8 text-center glass-card">
            <h2 className="text-3xl font-bold font-lexend mb-3 text-slate-100">
              大家的创作
            </h2>
            <p className="text-slate-400 mb-10 text-sm">
              看看其他人都在用毛毛虫创作什么故事
            </p>

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
      </main>

      {/* 用户头像菜单 */}
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
                    <span className="text-xs text-emerald-400">
                      免费 ×{user.free_creation_remaining}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onShowProfile?.()}
                className="gap-2 focus:bg-slate-700/50 focus:text-slate-100"
              >
                <User size={16} className="text-teal-400" /> 个人主页
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <DropdownMenuItem
                  onClick={() => onShowAdmin?.()}
                  className="gap-2 focus:bg-slate-700/50 focus:text-slate-100"
                >
                  <Shield size={16} className="text-rose-400" /> 用户管理
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onShowMyWorks?.()}
                className="gap-2 focus:bg-slate-700/50 focus:text-slate-100"
              >
                <Sparkles size={16} className="text-teal-400" /> 我的作品
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700/40" />
              <DropdownMenuItem
                onClick={() => onShowMyTemplates?.()}
                className="gap-2 focus:bg-slate-700/50 focus:text-slate-100"
              >
                <BookOpen size={16} className="text-teal-400" /> 我的模版
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700/40" />
              <DropdownMenuItem
                onClick={() => logout()}
                className="gap-2 text-red-400 focus:bg-red-900/30 focus:text-red-300"
              >
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
