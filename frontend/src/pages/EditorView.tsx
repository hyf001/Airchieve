
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronLeft,
  BookOpen,
Trash2,
  Plus,
  AlertCircle,
  Download,
  Gift,
  Lock,
  Globe,
  Layers,
  ArrowUpDown,
  Edit2,
  Eye,
  Square,
  BookImage,
} from 'lucide-react';
import {
  getStorybook,
  listStorybooks,
  deleteStorybook,
  updateStorybookPublicStatus,
  downloadStorybookImage,
  terminateStorybook,
  insertPages,
  generateCover,
  Storybook,
  StorybookListItem,
  InsufficientPointsError,
} from '../services/storybookService';
import { usePolling } from '../hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressCaterpillar from '../components/ProgressCaterpillar';
import BackCoverMode from './editor/BackCoverMode';
import EditMode from './editor/EditMode';
import ReorderMode from './editor/ReorderMode';
import RegenMode from './editor/RegenMode';
import CoverMode from './editor/CoverMode';

type EditorMode = 'read' | 'edit' | 'reorder' | 'regen' | 'cover' | 'backcover';

const statusTextMap: Record<string, string> = {
  init: '初始化',
  creating: '生成中',
  updating: '更新中',
  finished: '已完成',
  error: '错误',
  terminated: '已中止',
};

const TERMINAL_STATUSES = new Set(['finished', 'error', 'terminated']);

interface EditorViewProps {
  storybookId?: number;
  onBack: () => void;
  onCreateNew: () => void;
}

const EditorView: React.FC<EditorViewProps> = ({ storybookId, onBack, onCreateNew }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStorybook, setCurrentStorybook] = useState<Storybook | null>(null);
  const [storybookList, setStorybookList] = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState(false);

  // 弹窗状态
  const [isInsertPageDialogOpen, setIsInsertPageDialogOpen] = useState(false);
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [isBackCoverDialogOpen, setIsBackCoverDialogOpen] = useState(false);

  // 工具栏状态
  const [activeCanvasTool, setActiveCanvasTool] = useState<'ai-edit' | 'text' | 'adjust' | 'color' | 'filter' | 'eraser' | 'border' | 'draw' | 'mosaic' | 'marker' | 'optimize' | 'blur' | 'cutout' | 'background' | 'effect' | 'creative' | 'repair'>('ai-edit');

  const prevPagesLengthRef = React.useRef<number>(0);

  // ---- 下载假进度 ----
  useEffect(() => {
    if (!isDownloading) {
      if (downloadProgress > 0) setDownloadProgress(100);
      return;
    }
    setDownloadProgress(5);
    const id = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 99) { clearInterval(id); return prev; }
        return prev + (99 - prev) * 0.06 + 0.35;
      });
    }, 400);
    return () => clearInterval(id);
  }, [isDownloading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 轮询 ----
  const handlePollResult = useCallback((book: Storybook) => {
    const newCount = book.pages?.length ?? 0;
    if (newCount > prevPagesLengthRef.current) {
      toast({ title: `第 ${newCount} 页已生成 ✓` });
      setCurrentPageIndex(newCount - 1);
    }
    prevPagesLengthRef.current = newCount;
    setCurrentStorybook(book);
    setStorybookList(prev => prev.map(item =>
      item.id === book.id ? { ...item, status: book.status } : item
    ));
    return { stop: TERMINAL_STATUSES.has(book.status) };
  }, [toast]);

  const { start: startPolling, stop: stopPolling } = usePolling(getStorybook, handlePollResult);

  // ---- 加载 ----
  const loadStorybookList = useCallback(async () => {
    try {
      const list = await listStorybooks({ creator: user ? String(user.id) : undefined, limit: 20 });
      setStorybookList(list);
      return list;
    } catch {
      return [];
    }
  }, [user]);

  const loadStorybook = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setCurrentPageIndex(0);
    try {
      const book = await getStorybook(id);
      setCurrentStorybook(book);
      prevPagesLengthRef.current = book.pages?.length ?? 0;
      setStorybookList(prev => {
        const idx = prev.findIndex(item => item.id === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], status: book.status };
          return next;
        }
        return prev;
      });
      if (!TERMINAL_STATUSES.has(book.status)) startPolling(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载绘本失败');
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  useEffect(() => {
    loadStorybookList().then((list) => {
      if (storybookId) {
        loadStorybook(storybookId);
      } else if (list.length > 0) {
        loadStorybook(list[0].id);
      } else {
        setLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (storybookId) {
      stopPolling();
      loadStorybook(storybookId);
    }
  }, [storybookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 操作 ----
  const handleStorybookSelect = (id: number) => {
    stopPolling();
    loadStorybook(id);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await deleteStorybook(id);
      await loadStorybookList();
      if (currentStorybook?.id === id) {
        stopPolling();
        setCurrentStorybook(null);
      }
    } catch {
      toast({ variant: 'destructive', title: '删除失败' });
    }
  };

  const handleTogglePublic = async (id: number, currentIsPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateStorybookPublicStatus(id, !currentIsPublic);
      setStorybookList(prev =>
        prev.map(book => book.id === id ? { ...book, is_public: !currentIsPublic } : book)
      );
    } catch {
      toast({ variant: 'destructive', title: '更新公开状态失败' });
    }
  };

  const handleDownloadImage = () => {
    if (!currentStorybook || currentStorybook.status !== 'finished') return;
    setIsDownloadDialogOpen(true);
  };

  const handleDownloadConfirm = async (watermark: boolean) => {
    if (!currentStorybook) return;
    setIsDownloadDialogOpen(false);
    setIsDownloading(true);
    try {
      await downloadStorybookImage(currentStorybook, watermark);
    } catch (err) {
      toast({ variant: 'destructive', title: '下载失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTerminate = async () => {
    if (!currentStorybook || isTerminating) return;
    setIsTerminating(true);
    try {
      const res = await terminateStorybook(currentStorybook.id);
      toast({ title: res.message || '已中止' });
      stopPolling();
      setCurrentStorybook(prev => prev ? { ...prev, status: 'terminated' } : prev);
      setStorybookList(prev =>
        prev.map(item => item.id === currentStorybook.id ? { ...item, status: 'terminated' } : item)
      );
    } catch (err) {
      toast({ variant: 'destructive', title: '中止失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsTerminating(false);
    }
  };
  const handleTerminateClick = () => {
    if (!currentStorybook || isTerminating) return;
    setIsTerminateConfirmOpen(true);
  };

  const pages = currentStorybook?.pages || [];
  const isCreating = currentStorybook?.status === 'creating' || currentStorybook?.status === 'updating';
  const canReadPages = pages.length > 0;

  const renderContent = () => {
    if (loading) {
      return <LoadingSpinner size={48} text="加载中..." className="py-8" />;
    }

    if (currentStorybook.status === 'error' && pages.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-6 max-w-sm">
            <AlertCircle className="mx-auto text-red-500" size={64} />
            <h3 className="text-xl font-lexend font-bold text-slate-800">生成失败</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {currentStorybook.error_message || '抱歉，绘本生成过程中遇到了错误。请检查网络连接或稍后重试。'}
            </p>
            <Button variant="secondary" onClick={onBack}>返回首页</Button>
          </div>
        </div>
      );
    }

    if (currentStorybook.status === 'init' || (isCreating && pages.length === 0)) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-6 max-w-sm w-full px-8">
            <LoadingSpinner size={64} />
            <div>
              <h3 className="text-xl font-lexend font-bold text-slate-800 mb-1">正在装帧您的故事…</h3>
              <p className="text-slate-400 text-sm">正在将您的灵感转化为精美的插画与排版</p>
              <p className="text-slate-300 text-xs mt-2">预计 2 分钟内完成</p>
            </div>
          </div>
        </div>
      );
    }

    if (isCreating && pages.length > 0) {
      return (
        <div className="w-full flex flex-col items-center gap-3">
          <div className="w-full max-w-4xl flex items-center justify-center gap-2 py-1.5 bg-[#00CDD4]/10 text-[#009fa5] text-xs font-medium rounded-lg">
            <LoadingSpinner size={20} />
            正在生成中… 已完成 {pages.length} 页
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleTerminateClick}
                    disabled={isTerminating}
                    variant="outline"
                    size="sm"
                    className="ml-2 h-7 px-2 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Square size={12} fill="currentColor" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>停止生成</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <ReadMode
            pages={pages}
            currentIndex={currentPageIndex}
            onIndexChange={setCurrentPageIndex}
            isGenerating
            aspectRatio={currentStorybook.aspect_ratio}
          />
        </div>
      );
    }

    if (currentStorybook.status === 'finished' && pages.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-6 max-w-sm">
            <AlertCircle className="mx-auto text-amber-500" size={64} />
            <h3 className="text-xl font-lexend font-bold text-slate-800">内容生成失败</h3>
            <p className="text-slate-400 text-sm leading-relaxed">抱歉，绘本生成过程中遇到了问题，没有生成任何内容。</p>
            <Button variant="secondary" onClick={onBack}>返回首页</Button>
          </div>
        </div>
      );
    }

    if (canReadPages) {
      const currentPage = pages[currentPageIndex];

      // 根据比例获取 Tailwind 类名
      const getAspectRatioClass = (ratio: string): string => {
        switch (ratio) {
          case '1:1':
            return 'aspect-square';
          case '4:3':
            return 'aspect-[4/3]';
          case '16:9':
          default:
            return 'aspect-[16/9]';
        }
      };

      const aspectRatio = currentStorybook?.aspect_ratio || '16:9';

      return (
        <div className="w-full h-full flex flex-col gap-4">
          {/* 上半部分：页面图片区域 */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden flex items-center justify-center p-6">
            <div className={`${getAspectRatioClass(aspectRatio)} bg-slate-100 max-h-full`}>
              <img
                src={currentPage?.image_url}
                alt={`第 ${currentPageIndex + 1} 页`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* 下半部分：文字区域 + 播放设置栏 */}
          <div className="shrink-0 bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* 播放设置栏 */}
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/50 flex items-center gap-4">
              <span className="text-xs font-medium text-slate-600">播放设置</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">
                  <input type="checkbox" className="mr-1" defaultChecked />
                  自动播放
                </label>
                <label className="text-xs text-slate-500">
                  <input type="checkbox" className="mr-1" />
                  显示字幕
                </label>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">语速</span>
                <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
                  <option>0.5x</option>
                  <option>0.75x</option>
                  <option selected>1.0x</option>
                  <option>1.25x</option>
                  <option>1.5x</option>
                  <option>2.0x</option>
                </select>
              </div>
            </div>

            {/* 文字区域 */}
            <div className="p-4">
              <div className="min-h-[80px] text-sm text-slate-700 leading-relaxed bg-slate-50/50 rounded-lg p-3 border border-slate-200">
                {currentPage?.text || '暂无文字内容'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF3ED]">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-slate-500">
              <ChevronLeft />
            </Button>
            <div>
              <h1 className="font-semibold text-slate-900 truncate max-w-[200px] md:max-w-md text-base">
                {currentStorybook?.title || '选择一本绘本'}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-0.5">
                <span>{pages.length} 页</span>
                <span className="text-slate-300">|</span>
                <span>{currentStorybook?.status ? statusTextMap[currentStorybook.status] || currentStorybook.status : '未知'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 功能按钮组 */}
            {canReadPages && (
              <>
                <Button
                  onClick={() => setIsInsertPageDialogOpen(true)}
                  disabled={isCreating}
                  variant="outline"
                  className="hidden md:flex"
                >
                  <Plus size={16} />
                  插入页
                </Button>
                <Button
                  onClick={() => setIsCoverDialogOpen(true)}
                  disabled={isCreating}
                  variant="outline"
                  className="hidden md:flex"
                >
                  <BookImage size={16} />
                  生成封面
                </Button>
                <Button
                  onClick={() => setIsBackCoverDialogOpen(true)}
                  disabled={isCreating}
                  variant="outline"
                  className="hidden md:flex"
                >
                  <BookImage size={16} />
                  生成封底
                </Button>
              </>
            )}
            <Button
              onClick={handleDownloadImage}
              disabled={!currentStorybook || currentStorybook.status !== 'finished'}
              variant="gradient"
              className="hidden md:flex"
            >
              <Download size={16} />
              下载作品
            </Button>
            <Button onClick={onCreateNew} variant="gradient" className="hidden md:flex">
              <Gift size={16} />
              制作实物
            </Button>
          </div>
        </header>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Storybook List */}
          <aside className={`${currentStorybook ? 'hidden lg:flex lg:w-[320px]' : 'flex w-full'} border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-lg`}>
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 text-slate-600">
                <BookOpen size={16} className="text-slate-400" />
                <h2 className="font-semibold text-sm">我的故事书</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onCreateNew} title="创建新绘本" className="text-slate-400 hover:text-slate-600 h-8 w-8">
                <Plus size={16} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/40 custom-scrollbar">
              {storybookList.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={24} />
                  </div>
                  <p className="text-slate-500 text-sm">暂无绘本，点击上方 + 创建第一个绘本</p>
                </div>
              ) : (
                storybookList.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => handleStorybookSelect(book.id)}
                    className={`group p-3 rounded-xl cursor-pointer transition-all ${
                      currentStorybook?.id === book.id
                        ? 'bg-white shadow-md shadow-slate-200/80 ring-1 ring-slate-200'
                        : 'bg-white/70 hover:bg-white hover:shadow-sm hover:shadow-slate-200/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-slate-800 truncate leading-snug">{book.title}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(book.created_at).toLocaleDateString('zh-CN')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            book.status === 'finished' ? 'bg-emerald-50 text-emerald-700'
                            : book.status === 'error' ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                            {statusTextMap[book.status] || book.status}
                          </span>
                          <button
                            onClick={(e) => handleTogglePublic(book.id, book.is_public, e)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              book.is_public
                                ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title={book.is_public ? '点击设为私密' : '点击设为公开'}
                          >
                            {book.is_public
                              ? <><Globe size={9} />&nbsp;已发布</>
                              : <><Lock size={9} />&nbsp;私稿</>}
                          </button>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e) => handleDelete(book.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 h-6 w-6 shrink-0 -mt-0.5"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* === 第二栏 + 第三栏 + 第四栏容器 === */}
          {currentStorybook && (
            <main className="flex-1 flex overflow-hidden">

              {/* === 第二栏：页面导航列 === */}
              <aside className="w-44 shrink-0 border-r border-slate-200 bg-white flex flex-col">
                {/* 页面计数器 */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="text-center text-xs text-slate-600 font-medium">
                    <div className="text-[10px] text-slate-400 mb-0.5">当前页面</div>
                    <div className="text-sm font-bold text-slate-800">
                      第 {currentPageIndex + 1} <span className="text-slate-400 font-normal">/</span> {pages.length}
                    </div>
                  </div>
                </div>

                {/* 缩略图列表 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30">
                  {pages.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`relative w-full aspect-video rounded-lg overflow-hidden ring-4 transition-all shadow-sm ${
                        currentPageIndex === idx
                          ? 'ring-[#00CDD4] shadow-[#00CDD4]/30 scale-[1.03]'
                          : 'ring-transparent hover:ring-slate-300 hover:scale-[1.02]'
                      }`}
                    >
                      <img src={p.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 leading-4 backdrop-blur-sm">
                        第 {idx + 1} 页
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              {/* === 第三栏：中间工作区域 === */}
              <div className="flex-1 relative overflow-hidden bg-[#FAF3ED] p-4">
                {/* Download progress bar */}
                {isDownloading && (
                  <div className="absolute top-4 left-4 right-4 z-50 px-4 pt-2 pb-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
                    <ProgressCaterpillar progress={downloadProgress} showLabel />
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-900 px-6 py-4 rounded-2xl border-l-4 border-amber-500 font-medium text-sm shadow-2xl flex items-center gap-4">
                    <AlertCircle className="text-amber-500 shrink-0" size={24} />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">创作遇阻</span>
                      <span className="text-slate-500 text-xs">{error}</span>
                    </div>
                  </div>
                )}

                {/* Content Area */}
                {renderContent()}
              </div>

              {/* === 第四栏：编辑工具栏 === */}
              <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
                {/* 工具选择网格 */}
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">图片工具</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'ai-edit', label: 'AI改图', icon: '🤖' },
                      { id: 'text', label: '文字', icon: '✏️' },
                      { id: 'adjust', label: '编辑', icon: '⚙️' },
                      { id: 'color', label: '调色', icon: '🌈' },
                      { id: 'filter', label: '滤镜', icon: '🎨' },
                      { id: 'eraser', label: '消除笔', icon: '🧹' },
                      { id: 'border', label: '边框', icon: '🖼️' },
                      { id: 'draw', label: '涂鸦笔', icon: '🖌️' },
                      { id: 'mosaic', label: '马赛克', icon: '▦' },
                      { id: 'marker', label: '标记', icon: '📍' },
                      { id: 'optimize', label: '智能优化', icon: '✨' },
                      { id: 'blur', label: '背景虚化', icon: '💫' },
                      { id: 'cutout', label: '抠图', icon: '✂️' },
                      { id: 'background', label: '背景', icon: '🏞️' },
                      { id: 'effect', label: '特效', icon: '💥' },
                      { id: 'creative', label: '创意玩法', icon: '🎪' },
                      { id: 'repair', label: '画质修复', icon: '🔧' },
                    ].map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => setActiveCanvasTool(tool.id as any)}
                        className={`flex flex-col items-center gap-1 p-2 h-auto rounded-lg text-xs transition-colors ${
                          activeCanvasTool === tool.id
                            ? 'bg-[#00CDD4]/15 text-[#00CDD4] ring-2 ring-[#00CDD4]/30 ring-inset'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                        title={tool.label}
                      >
                        <span className="text-xl">{tool.icon}</span>
                        <span className="text-[9px] leading-tight">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 工具面板内容区 */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {activeCanvasTool === 'ai-edit' && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">AI 改图工具</p>
                      <p className="text-xs">输入指令描述你想要的修改</p>
                    </div>
                  )}
                  {activeCanvasTool === 'text' && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">文字工具</p>
                      <p className="text-xs">在图片上添加文字图层</p>
                    </div>
                  )}
                  {activeCanvasTool === 'draw' && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">涂鸦笔工具</p>
                      <p className="text-xs">在图片上自由绘制</p>
                    </div>
                  )}
                  {activeCanvasTool === 'eraser' && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">消除笔工具</p>
                      <p className="text-xs">智能移除图片中的物体</p>
                    </div>
                  )}
                  {activeCanvasTool === 'filter' && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">滤镜工具</p>
                      <p className="text-xs">添加精美的滤镜效果</p>
                    </div>
                  )}
                  {['adjust', 'color', 'border', 'mosaic', 'marker', 'optimize', 'blur', 'cutout', 'background', 'effect', 'creative', 'repair'].includes(activeCanvasTool) && (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-sm font-medium mb-2">{{
                        adjust: '编辑工具', color: '调色工具', border: '边框工具', mosaic: '马赛克工具',
                        marker: '标记工具', optimize: '智能优化', blur: '背景虚化', cutout: '抠图工具',
                        background: '背景工具', effect: '特效工具', creative: '创意玩法', repair: '画质修复'
                      }[activeCanvasTool as string]}</p>
                      <p className="text-xs">功能开发中...</p>
                    </div>
                  )}
                </div>
              </aside>
            </main>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="确认删除"
        description="确定要删除这个绘本吗？此操作不可恢复。"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <Dialog open={isDownloadDialogOpen} onOpenChange={(o) => { if (!o) setIsDownloadDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>下载作品</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">是否在下载的图片中添加水印？</p>
          <DialogFooter className="flex gap-2 sm:flex-row flex-col">
            <Button variant="outline" onClick={() => handleDownloadConfirm(false)}>去水印下载</Button>
            <Button variant="default" onClick={() => handleDownloadConfirm(true)}>带水印下载</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={isTerminateConfirmOpen}
        title="确认停止"
        description="确定要停止生成吗？已生成的页面将保留。"
        confirmText="停止"
        cancelText="取消"
        onConfirm={() => {
          setIsTerminateConfirmOpen(false);
          handleTerminate();
        }}
        onCancel={() => setIsTerminateConfirmOpen(false)}
      />

      {/* 插入页弹窗 */}
      <InsertPageDialog
        open={isInsertPageDialogOpen}
        onOpenChange={setIsInsertPageDialogOpen}
        storybook={currentStorybook}
        onInsert={async (position, count, instruction) => {
          if (!currentStorybook) return;
          try {
            await insertPages(currentStorybook.id, position, count, instruction);
            setCurrentStorybook({ ...currentStorybook, status: 'updating' });
            startPolling(currentStorybook.id);
            toast({ title: '开始生成新页面' });
          } catch (err) {
            if (err instanceof InsufficientPointsError) {
              toast({ variant: 'destructive', title: '积分不足', description: err.message });
            } else {
              toast({ variant: 'destructive', title: '插入页失败', description: err instanceof Error ? err.message : undefined });
            }
          }
        }}
      />

      {/* 生成封面对话框 */}
      <GenerateCoverDialog
        open={isCoverDialogOpen}
        onOpenChange={setIsCoverDialogOpen}
        storybook={currentStorybook}
        onGenerate={async (selectedPages) => {
          if (!currentStorybook) return;
          try {
            await generateCover(currentStorybook.id, selectedPages);
            setCurrentStorybook({ ...currentStorybook, status: 'updating' });
            startPolling(currentStorybook.id);
            toast({ title: '封面生成中', description: '请稍候，生成完成后将自动刷新' });
          } catch (err) {
            if (err instanceof InsufficientPointsError) {
              toast({ variant: 'destructive', title: '积分不足', description: err.message });
            } else {
              toast({ variant: 'destructive', title: '生成失败', description: err instanceof Error ? err.message : undefined });
            }
          }
        }}
      />

      {/* 生成封底对话框 */}
      <BackCoverDialog
        open={isBackCoverDialogOpen}
        onOpenChange={setIsBackCoverDialogOpen}
        storybook={currentStorybook}
      />
    </>
  );
};

// ==================== 弹窗组件 ====================

interface InsertPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
  onInsert: (position: number, count: number, instruction: string) => void | Promise<void>;
}

const InsertPageDialog: React.FC<InsertPageDialogProps> = ({ open, onOpenChange, storybook, onInsert }) => {
  const pages = storybook?.pages || [];
  const aspectRatio = storybook?.aspect_ratio || '16:9';

  const [insertPosition, setInsertPosition] = useState<number>(pages.length);
  const [count, setCount] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setInsertPosition(pages.length);
  }, [pages.length, open]);

  const getAspectRatioClass = (ratio: string): string => {
    switch (ratio) {
      case '1:1': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '16:9':
      default: return 'aspect-[16/9]';
    }
  };

  const positionLabel = (pos: number) => {
    if (pos <= 0) return '开头';
    if (pos >= pages.length) return '末尾';
    return `第 ${pos} 页后`;
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onInsert(insertPosition, count, instruction || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>插入新页面</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 位置选择 */}
          <div>
            <p className="text-sm text-slate-600 mb-2">选择插入位置：{positionLabel(insertPosition)}</p>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {pages.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => setInsertPosition(idx + 1)}
                  className={`relative aspect-video rounded-lg overflow-hidden ring-2 transition-all ${
                    insertPosition === idx + 1
                      ? 'ring-[#00CDD4] scale-[1.02]'
                      : 'ring-transparent hover:ring-slate-300'
                  }`}
                >
                  <img src={page.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 leading-3">
                    第 {idx + 1} 页
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 数量和指令 */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">生成页数</label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCount(Math.max(1, count - 1))}
                  disabled={count <= 1}
                >
                  -
                </Button>
                <span className="text-lg font-semibold w-8 text-center">{count}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCount(Math.min(10, count + 1))}
                  disabled={count >= 10}
                >
                  +
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">生成指令（可选）</label>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 resize-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
                placeholder="描述要生成的页面内容，例如：'小兔子在花园里遇到了朋友'..."
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="bg-[#00CDD4] hover:bg-[#00b8be] text-white">
            {isSubmitting ? '生成中...' : '开始生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface GenerateCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
  onGenerate: (selectedPages: number[]) => void | Promise<void>;
}

const GenerateCoverDialog: React.FC<GenerateCoverDialogProps> = ({ open, onOpenChange, storybook, onGenerate }) => {
  const pages = storybook?.pages || [];

  // 默认选择：首页、中间页、尾页
  const defaultSelected = (): number[] => {
    if (pages.length === 0) return [];
    if (pages.length <= 3) return pages.map((_, i) => i);
    return [0, Math.floor(pages.length / 2), pages.length - 1];
  };

  const [selected, setSelected] = useState<number[]>(defaultSelected);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setSelected(defaultSelected());
  }, [pages.length, open]);

  const togglePage = (idx: number) => {
    setSelected(prev => {
      if (prev.includes(idx)) {
        return prev.length > 1 ? prev.filter(i => i !== idx) : prev;
      }
      if (prev.length >= 3) return [...prev.slice(1), idx];
      return [...prev, idx];
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate(selected);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生成封面</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            选择 <span className="font-medium text-slate-700">最多 3 张</span> 参考页，AI 将提取画风和角色生成封面
          </p>

          {/* 页面选择 */}
          {pages.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无可用页面</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {pages.map((page, idx) => {
                const isSelected = selected.includes(idx);
                const selOrder = selected.indexOf(idx) + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => togglePage(idx)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-[#00CDD4] shadow-md scale-[1.03]'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={page.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-[#00CDD4] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                        {selOrder}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selected.length === 0 || isGenerating || pages.length === 0}
            className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
          >
            {isGenerating ? '生成中...' : '开始生成封面'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface BackCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
}

const BackCoverDialog: React.FC<BackCoverDialogProps> = ({ open, onOpenChange, storybook }) => {
  if (!storybook) return null;

  const pages = storybook.pages || [];
  const hasBackCover = pages.some(p => p.page_type === 'back_cover');

  // 如果已有封底，显示提示
  if (hasBackCover) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成封底</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-sm text-slate-600 mb-4">
              此绘本已经创建了封底，无法重复创建
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 显示嵌入式编辑器
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col h-[80vh]">
          {/* 简化的顶部栏 */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-800">生成封底</h2>
              <p className="text-xs text-slate-500">为《{storybook.title}》创建封底</p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>

          {/* 嵌入 BackCoverMode 的内容 */}
          <div className="flex-1 overflow-hidden">
            <BackCoverMode
              storybook={storybook}
              onBack={() => onOpenChange(false)}
              onBackCoverCreated={async () => {
                onOpenChange(false);
                // 重新加载绘本数据
                // 实际使用时需要从外部传入 loadStorybook 函数
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditorView;
