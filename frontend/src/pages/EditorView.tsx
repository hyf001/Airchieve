
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Trash2, Plus, Sparkles, AlertCircle, Download, Gift, Lock, Globe, Layers, ArrowUpDown } from 'lucide-react';
import StorybookPageCard from '../components/StorybookPageCard';
import {
  getStorybook,
  listStorybooks,
  deleteStorybook,
  deletePage,
  reorderPages,
  regeneratePages,
  updateStorybookPublicStatus,
  downloadStorybookImage,
  InsufficientPointsError,
  Storybook,
  StorybookListItem,
  StorybookPage,
} from '../services/storybookService';
import { usePolling } from '../hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';

// 状态文本映射
const statusTextMap: Record<string, string> = {
  init: '初始化',
  creating: '生成中',
  updating: '更新中',
  finished: '已完成',
  error: '错误'
};

const TERMINAL_STATUSES = new Set(['finished', 'error']);

interface EditorViewProps {
  storybookId?: number;
  onBack: () => void;
  onCreateNew: () => void;
}

const EditorView: React.FC<EditorViewProps> = ({
  storybookId,
  onBack,
  onCreateNew,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStorybook, setCurrentStorybook] = useState<Storybook | null>(null);
  const [storybookList, setStorybookList] = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState<'left' | 'right' | null>(null);
  const [animatingPageIndex, setAnimatingPageIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [creationProgress, setCreationProgress] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  // 删除页确认
  const [deletePageConfirm, setDeletePageConfirm] = useState<number | null>(null);
  // 再生成模式
  const [regenMode, setRegenMode] = useState(false);
  const [regenSelected, setRegenSelected] = useState<number[]>([]);
  const [regenCount, setRegenCount] = useState(1);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  // 排序模式
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderDraft, setReorderDraft] = useState<number[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const dragIndexRef = useRef<number | null>(null);
  const creationStartTimeRef = useRef<number | null>(null);

  const CREATION_ESTIMATED_MS = 120_000; // 2 分钟

  // 下载假进度：0 → 99% 渐进，完成后跳 100%
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

  // 创作假进度：按 2 分钟估算，完成后跳 100%
  useEffect(() => {
    const status = currentStorybook?.status;
    if (!status || TERMINAL_STATUSES.has(status)) {
      creationStartTimeRef.current = null;
      setCreationProgress(status === 'finished' ? 100 : 0);
      return;
    }
    if (!creationStartTimeRef.current) creationStartTimeRef.current = Date.now();
    const update = () => {
      const pct = Math.min(95, ((Date.now() - creationStartTimeRef.current!) / CREATION_ESTIMATED_MS) * 100);
      setCreationProgress(pct);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [currentStorybook?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 轮询 ----

  const handlePollResult = useCallback((book: Storybook) => {
    setCurrentStorybook(book);
    setStorybookList(prev => prev.map(item =>
      item.id === book.id ? { ...item, status: book.status } : item
    ));
    return { stop: TERMINAL_STATUSES.has(book.status) };
  }, []);

  const { start: startPolling, stop: stopPolling } = usePolling(getStorybook, handlePollResult);

  // ---- 加载绘本 ----

  const loadStorybookList = useCallback(async () => {
    try {
      const list = await listStorybooks({ creator: user ? String(user.id) : undefined, limit: 20 });
      setStorybookList(list);
      return list;
    } catch (err) {
      console.error('Failed to load storybook list:', err);
      return [];
    }
  }, [user]);

  const loadStorybook = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const book = await getStorybook(id);
      setCurrentStorybook(book);
      setCurrentSpreadIndex(0);
      setStorybookList(prev => {
        const idx = prev.findIndex(item => item.id === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], status: book.status };
          return next;
        }
        return prev;
      });
      // 非终态则启动轮询
      if (!TERMINAL_STATUSES.has(book.status)) {
        startPolling(id);
      }
    } catch (err) {
      console.error('Failed to load storybook:', err);
      setError(err instanceof Error ? err.message : '加载绘本失败');
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  // 初始化
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

  // storybookId prop 变化时切换绑本
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

  const handleDelete = async (id: number, e: React.MouseEvent) => {
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
      toast({ variant: "destructive", title: "删除失败" });
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
      toast({ variant: "destructive", title: "更新公开状态失败" });
    }
  };

  // 下载绘本长图
  const handleDownloadImage = async () => {
    if (!currentStorybook || currentStorybook.status !== 'finished') return;
    setIsDownloading(true);
    try {
      await downloadStorybookImage(currentStorybook);
    } catch (err) {
      toast({ variant: "destructive", title: "下载失败", description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDownloading(false);
    }
  };

  // StorybookPageCard 保存回调：更新本地 storybook 数据
  const handlePageSaved = useCallback((index: number, newPage: StorybookPage) => {
    setCurrentStorybook(prev => {
      if (!prev || !prev.pages) return prev;
      const pages = [...prev.pages];
      pages[index] = newPage;
      return { ...prev, pages };
    });
  }, []);

  // 删除页 - 弹窗确认
  const handleDeletePageRequest = useCallback((index: number) => {
    setDeletePageConfirm(index);
  }, []);

  const confirmDeletePage = async () => {
    if (!currentStorybook || deletePageConfirm === null) return;
    try {
      const updated = await deletePage(currentStorybook.id, deletePageConfirm);
      setCurrentStorybook(updated);
      setCurrentSpreadIndex(prev => Math.min(prev, (updated.pages?.length ?? 1) - 1));
    } catch (err) {
      toast({ variant: 'destructive', title: '删除失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeletePageConfirm(null);
    }
  };

  // 排序 - 打开弹窗
  const handleOpenReorder = useCallback(() => {
    const ps = currentStorybook?.pages || [];
    setReorderDraft(ps.map((_, i) => i));
    setReorderOpen(true);
  }, [currentStorybook?.pages]);

  const handleDragStart = useCallback((pos: number) => {
    dragIndexRef.current = pos;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, pos: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === pos) return;
    setReorderDraft(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(pos, 0, item);
      dragIndexRef.current = pos;
      return next;
    });
  }, []);

  const handleConfirmReorder = async () => {
    if (!currentStorybook || isReordering) return;
    setIsReordering(true);
    try {
      const updated = await reorderPages(currentStorybook.id, reorderDraft);
      setCurrentStorybook(updated);
      setCurrentSpreadIndex(0);
      setReorderOpen(false);
    } catch (err) {
      toast({ variant: 'destructive', title: '排序失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsReordering(false);
    }
  };

  // 再生成 - 选择/取消选择
  const handleRegenToggle = useCallback((index: number) => {
    setRegenSelected(prev => {
      if (prev.includes(index)) return prev.filter(i => i !== index);
      if (prev.length >= 5) return prev;
      return [...prev, index];
    });
  }, []);

  // 再生成 - 确认执行
  const handleConfirmRegen = async () => {
    if (!currentStorybook || regenSelected.length === 0 || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await regeneratePages(currentStorybook.id, regenSelected, regenCount, regenInstruction || undefined);
      setCurrentStorybook(prev => prev ? { ...prev, status: 'updating' } : prev);
      setStorybookList(prev =>
        prev.map(item => item.id === currentStorybook.id ? { ...item, status: 'updating' } : item)
      );
      setRegenMode(false);
      setRegenSelected([]);
      setRegenCount(1);
      setRegenInstruction('');
      startPolling(currentStorybook.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({ variant: 'destructive', title: '再生成失败', description: err instanceof Error ? err.message : undefined });
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  // ---- 翻页 ----

  const pages = currentStorybook?.pages || [];

  const nextSpread = useCallback(() => {
    if (currentSpreadIndex < pages.length - 1) {
      const next = currentSpreadIndex + 1;
      setPageDirection('right');
      setAnimatingPageIndex(next);
      setTimeout(() => setCurrentSpreadIndex(next), 0);
      setTimeout(() => { setPageDirection(null); setAnimatingPageIndex(null); }, 700);
    }
  }, [currentSpreadIndex, pages.length]);

  const prevSpread = useCallback(() => {
    if (currentSpreadIndex > 0) {
      const prev = currentSpreadIndex - 1;
      setPageDirection('left');
      setAnimatingPageIndex(prev);
      setTimeout(() => setCurrentSpreadIndex(prev), 0);
      setTimeout(() => { setPageDirection(null); setAnimatingPageIndex(null); }, 700);
    }
  }, [currentSpreadIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSpread();
      if (e.key === 'ArrowLeft') prevSpread();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSpread, prevSpread]);

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
          {currentStorybook?.status === 'finished' && pages.length > 0 && (
            <>
              <Button
                variant="outline" size="sm"
                onClick={handleOpenReorder}
                className="hidden md:flex gap-1.5 text-slate-600"
              >
                <ArrowUpDown size={14} />
                排序
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setRegenMode(true); setRegenSelected([]); setRegenCount(1); setRegenInstruction(''); }}
                className="hidden md:flex gap-1.5 text-slate-600"
              >
                <Layers size={14} />
                再生成
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

          <Button
            onClick={onCreateNew}
            variant="gradient"
            className="hidden md:flex"
          >
            <Gift size={16} />
            制作实物
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Storybook List */}
        <aside className={`${currentStorybook ? 'hidden lg:flex lg:w-[320px]' : 'flex w-full'} border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-lg`}>
          {/* Sidebar Header */}
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

        {/* Right: Book Workspace */}
        {currentStorybook && (
          <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-hidden">
            {/* Download Progress Bar */}
            {isDownloading && (
              <div className="absolute top-0 left-0 right-0 z-50">
                <div className="h-1.5 bg-slate-200">
                  <div
                    className="h-full bg-[#00CDD4] transition-all duration-500 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 py-2 bg-slate-50/90 backdrop-blur-sm text-slate-600 text-sm font-medium">
                  <Loader2 size={14} className="animate-spin" />
                  正在制作，请稍后…{Math.round(downloadProgress)}%
                </div>
              </div>
            )}
            {/* Floating Input Box */}
            {error && (
              <div className="absolute top-8 bg-white text-slate-900 px-6 py-4 rounded-2xl border-l-4 border-amber-500 font-medium text-sm z-50 shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                <AlertCircle className="text-amber-500 shrink-0" size={24} />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">创作遇阻</span>
                  <span className="text-slate-500 text-xs">{error}</span>
                </div>
              </div>
            )}

            {loading && (
              <LoadingSpinner size={48} text="加载中..." className="py-8" />
            )}

            {!loading && currentStorybook && currentStorybook.status === 'error' && (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center space-y-6 max-w-sm">
                  <AlertCircle className="mx-auto text-red-500" size={64} />
                  <h3 className="text-xl font-lexend font-bold text-slate-800">生成失败</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {currentStorybook.error_message || '抱歉，绘本生成过程中遇到了错误。请检查网络连接或稍后重试。'}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="secondary" onClick={onBack}>返回首页</Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && currentStorybook && (currentStorybook.status === 'init' || currentStorybook.status === 'creating' || currentStorybook.status === 'updating') && (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center space-y-6 max-w-sm w-full px-8">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 border-8 border-slate-100 border-t-[#00CDD4] rounded-full animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-[#00CDD4] animate-pulse" size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-lexend font-bold text-slate-800 mb-1">正在装帧你的故事…</h3>
                    <p className="text-slate-400 text-sm">正在将你的灵感转化为精美的插画与排版</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>预计 2 分钟内完成</span>
                      <span>{Math.round(creationProgress)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00CDD4] rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${creationProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-300">
                      {creationProgress < 30 ? '正在构思故事结构…'
                        : creationProgress < 60 ? '正在绘制插图…'
                        : creationProgress < 85 ? '正在排版文字…'
                        : '即将完成…'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!loading && currentStorybook && currentStorybook.status === 'finished' && pages.length === 0 && (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center space-y-6 max-w-sm">
                  <AlertCircle className="mx-auto text-amber-500" size={64} />
                  <h3 className="text-xl font-lexend font-bold text-slate-800">内容生成失败</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">抱歉，绘本生成过程中遇到了问题，没有生成任何内容。请尝试重新创建或修改提示词。</p>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="secondary" onClick={onBack}>返回首页</Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && currentStorybook && currentStorybook.status === 'finished' && pages.length > 0 && (
              <>
                {/* ── 再生成选择模式 ── */}
                {regenMode ? (
                  <div className="w-full max-w-4xl space-y-4">
                    <div className="text-center space-y-1">
                      <p className="text-slate-700 font-medium">选择参考页面，再生成新页面</p>
                      <p className="text-slate-400 text-sm">已选 {regenSelected.length} / 5 页</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {pages.map((page, idx) => (
                        <StorybookPageCard
                          key={idx}
                          page={page}
                          index={idx}
                          storybookId={currentStorybook.id}
                          onSaved={handlePageSaved}
                          onDeleteRequest={handleDeletePageRequest}
                          regenSelectMode={true}
                          regenSelected={regenSelected.includes(idx)}
                          onRegenToggle={handleRegenToggle}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <textarea
                        value={regenInstruction}
                        onChange={e => setRegenInstruction(e.target.value)}
                        placeholder="再生成指令（可选），例如：让画面更温暖一些"
                        rows={2}
                        className="w-full max-w-lg border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
                      />
                      <div className="flex justify-center gap-3 items-center">
                        <Button variant="outline" onClick={() => { setRegenMode(false); setRegenSelected([]); setRegenCount(1); setRegenInstruction(''); }}>
                          取消
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span>生成</span>
                          <select
                            value={regenCount}
                            onChange={e => setRegenCount(Number(e.target.value))}
                            className="border border-slate-200 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span>张</span>
                        </div>
                        <Button
                          onClick={handleConfirmRegen}
                          disabled={regenSelected.length === 0 || isRegenerating}
                          className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
                        >
                          {isRegenerating ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                          再生成
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative w-full max-w-4xl">
                      {/* Left nav */}
                      <Button
                        variant="ghost" size="icon"
                        onClick={prevSpread}
                        disabled={currentSpreadIndex === 0}
                        className="absolute -left-4 md:-left-14 top-[45%] -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full shadow-lg z-40 disabled:opacity-0 hover:scale-110 h-12 w-12"
                      >
                        <ChevronLeft size={28} />
                      </Button>

                      {/* White card container */}
                      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        {/* Image + edit area */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                          {pages.map((page, idx) => {
                            const isActive = idx === currentSpreadIndex;
                            const isAnimating = idx === animatingPageIndex;
                            let animationClass = '';
                            if (isAnimating && pageDirection === 'left') animationClass = 'opacity-100 z-20 page-enter-left';
                            else if (isAnimating && pageDirection === 'right') animationClass = 'opacity-100 z-20 page-enter-right';
                            else if (isActive) animationClass = 'z-10 opacity-100';
                            else animationClass = 'opacity-0 z-0 pointer-events-none';

                            return (
                              <div
                                key={idx}
                                className={`absolute inset-0 w-full transition-all duration-700 ease-in-out ${animationClass}`}
                                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                              >
                                <StorybookPageCard
                                  page={page}
                                  index={idx}
                                  storybookId={currentStorybook.id}
                                  onSaved={handlePageSaved}
                                  onDeleteRequest={handleDeletePageRequest}
                                  regenSelectMode={false}
                                  regenSelected={false}
                                  onRegenToggle={handleRegenToggle}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Card footer: page counter only */}
                        <div className="py-2.5 px-4 flex items-center justify-center border-t border-slate-100">
                          <span className="text-sm text-slate-500 font-medium">
                            {currentSpreadIndex + 1} / {pages.length} 页
                          </span>
                        </div>
                      </div>

                      {/* Right nav */}
                      <Button
                        variant="ghost" size="icon"
                        onClick={nextSpread}
                        disabled={currentSpreadIndex >= pages.length - 1}
                        className="absolute -right-4 md:-right-14 top-[45%] -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full shadow-lg z-40 disabled:opacity-0 hover:scale-110 h-12 w-14"
                      >
                        <ChevronRight size={28} />
                      </Button>
                    </div>

                    {/* Navigation dots */}
                    <div className="mt-4 flex gap-2">
                      {pages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSpreadIndex(idx)}
                          className={`h-1.5 transition-all duration-500 rounded-full ${
                            currentSpreadIndex === idx ? 'w-8 bg-[#00CDD4]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        )}
      </div>
    </div>

    <ConfirmDialog
      open={deleteConfirmId !== null}
      title="确认删除"
      description="确定要删除这个绘本吗？此操作不可恢复。"
      onConfirm={confirmDelete}
      onCancel={() => setDeleteConfirmId(null)}
    />

    <ConfirmDialog
      open={deletePageConfirm !== null}
      title="确认删除此页"
      description={`确定要删除第 ${(deletePageConfirm ?? 0) + 1} 页吗？此操作不可恢复。`}
      onConfirm={confirmDeletePage}
      onCancel={() => setDeletePageConfirm(null)}
    />

    {/* 排序弹窗 */}
    <Dialog open={reorderOpen} onOpenChange={(open) => { if (!open) setReorderOpen(false); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>调整页面顺序</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-1">拖动缩略图调整顺序，点击确认保存。</p>
        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 min-h-[120px]">
          {reorderDraft.map((origIdx, pos) => {
            const page = pages[origIdx];
            if (!page) return null;
            return (
              <div
                key={origIdx}
                draggable
                onDragStart={() => handleDragStart(pos)}
                onDragOver={(e) => handleDragOver(e, pos)}
                className="shrink-0 w-36 cursor-grab active:cursor-grabbing rounded-xl overflow-hidden ring-2 ring-slate-200 hover:ring-[#00CDD4] transition-all select-none"
              >
                <div className="relative aspect-[16/9]">
                  <img src={page.image_url} alt={`第 ${pos + 1} 页`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                    第 {pos + 1} 页
                  </div>
                </div>
                <div className="flex justify-between bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (pos === 0) return;
                      setReorderDraft(prev => {
                        const next = [...prev];
                        [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                        return next;
                      });
                    }}
                    disabled={pos === 0}
                    className="flex-1 flex justify-center py-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (pos === reorderDraft.length - 1) return;
                      setReorderDraft(prev => {
                        const next = [...prev];
                        [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
                        return next;
                      });
                    }}
                    disabled={pos === reorderDraft.length - 1}
                    className="flex-1 flex justify-center py-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setReorderOpen(false)} disabled={isReordering}>
            取消
          </Button>
          <Button
            onClick={handleConfirmReorder}
            disabled={isReordering}
            className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
          >
            {isReordering && <Loader2 size={14} className="animate-spin mr-1" />}
            确认排序
          </Button>
        </div>
      </DialogContent>
    </Dialog>
</>
  );
};

export default EditorView;

