
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Trash2, Plus, Sparkles, AlertCircle, Download, PenTool, Edit2, Lock, Globe, X } from 'lucide-react';
import FloatingInputBox from '../components/FloatingInputBox';
import {
  getStorybook,
  listStorybooks,
  editStorybook,
  editStorybookPage,
  createStorybook,
  deleteStorybook,
  updateStorybookPublicStatus,
  downloadStorybookImage,
  InsufficientPointsError,
  Storybook,
  StorybookListItem,
} from '../services/storybookService';
import { usePolling } from '../hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [currentStorybook, setCurrentStorybook] = useState<Storybook | null>(null);
  const [storybookList, setStorybookList] = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pageDirection, setPageDirection] = useState<'left' | 'right' | null>(null);
  const [animatingPageIndex, setAnimatingPageIndex] = useState<number | null>(null);
  const [showFloatingInput, setShowFloatingInput] = useState(false);
  const [insufficientPointsMessage, setInsufficientPointsMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [creationProgress, setCreationProgress] = useState(0);
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

  // 重新生成（error 状态时）
  const handleRegenerate = async () => {
    if (!currentStorybook?.instruction) return;
    setError(null);
    setInsufficientPointsMessage(null);
    try {
      const res = await createStorybook({
        instruction: currentStorybook.instruction,
        template_id: currentStorybook.template_id ?? undefined,
      });
      // 插入新绑本到列表顶部
      setStorybookList(prev => {
        if (prev.find(item => item.id === res.id)) return prev;
        return [{
          id: res.id,
          title: res.title,
          description: null,
          creator: user ? String(user.id) : '',
          status: 'init' as const,
          is_public: false,
          created_at: new Date().toISOString(),
          pages: null,
        }, ...prev];
      });
      await loadStorybook(res.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        setInsufficientPointsMessage(err.message);
      } else {
        setError(err instanceof Error ? err.message : '重新生成失败');
      }
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个绘本吗？')) return;
    try {
      await deleteStorybook(id);
      await loadStorybookList();
      if (currentStorybook?.id === id) {
        stopPolling();
        setCurrentStorybook(null);
      }
    } catch {
      alert('删除失败');
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
      alert('更新公开状态失败');
    }
  };

  // 下载绘本长图
  const handleDownloadImage = async () => {
    if (!currentStorybook || currentStorybook.status !== 'finished') return;
    setIsDownloading(true);
    try {
      await downloadStorybookImage(currentStorybook.id!, currentStorybook.title || 'storybook');
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载失败');
    } finally {
      setIsDownloading(false);
    }
  };

  // 编辑整本绘本（创建新版本）
  const handleEditStorybook = async (instruction: string) => {
    if (!currentStorybook || !instruction.trim() || isEditing) return;
    setIsEditing(true);
    setError(null);
    setInsufficientPointsMessage(null);
    try {
      const res = await editStorybook(currentStorybook.id, { instruction });
      // 插入新绑本到列表顶部
      setStorybookList(prev => {
        if (prev.find(item => item.id === res.id)) return prev;
        return [{
          id: res.id,
          title: res.title,
          description: null,
          creator: user ? String(user.id) : '',
          status: 'init' as const,
          is_public: false,
          created_at: new Date().toISOString(),
          pages: null,
        }, ...prev];
      });
      await loadStorybook(res.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        setInsufficientPointsMessage(err.message);
      } else {
        setError(err instanceof Error ? err.message : '编辑绘本失败');
      }
    } finally {
      setIsEditing(false);
    }
  };

  // 编辑单页
  const handleEditPage = async (instruction: string) => {
    if (!currentStorybook || !instruction.trim() || isEditing || editingPage === null) return;
    setIsEditing(true);
    setInsufficientPointsMessage(null);
    try {
      await editStorybookPage(currentStorybook.id, editingPage, { instruction });
      setEditingPage(null);
      setShowFloatingInput(false);
      // 乐观更新状态为 updating，然后启动轮询
      setCurrentStorybook(prev => prev ? { ...prev, status: 'updating' } : prev);
      setStorybookList(prev =>
        prev.map(item => item.id === currentStorybook.id ? { ...item, status: 'updating' } : item)
      );
      startPolling(currentStorybook.id);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        setInsufficientPointsMessage(err.message);
      } else {
        setError(err instanceof Error ? err.message : '编辑失败');
      }
    } finally {
      setIsEditing(false);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-[#E2E8F0]">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-slate-500">
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="font-lexend font-bold text-slate-900 truncate max-w-[200px] md:max-w-md">
              {currentStorybook?.title || 'Select a Storybook'}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-black uppercase tracking-widest">
              <span>{pages.length} Pages</span>
              <span className="text-slate-300 mx-1">•</span>
              <span>{currentStorybook?.status ? statusTextMap[currentStorybook.status] || currentStorybook.status : 'Unknown'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => { setEditingPage(null); setShowFloatingInput(true); }}
            disabled={!currentStorybook || currentStorybook.status !== 'finished'}
            variant="gradient"
            className="hidden md:flex"
          >
            <PenTool size={16} />
            编辑绘本
          </Button>

          <Button
            onClick={handleDownloadImage}
            disabled={!currentStorybook || currentStorybook.status !== 'finished'}
            variant="gradient"
            className="hidden md:flex"
          >
            <Download size={16} />
            下载绘本
          </Button>

          <Button
            onClick={onCreateNew}
            variant="gradient"
            className="hidden md:flex"
          >
            <Sparkles size={16} />
            制作绘本实物
          </Button>
        </div>
      </header>

      {/* Insufficient Points Banner */}
      {insufficientPointsMessage && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl flex items-center justify-between gap-4 z-50 shadow-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500 shrink-0" size={20} />
            <div>
              <p className="font-bold text-sm text-amber-900">积分不足</p>
              <p className="text-xs text-amber-700">{insufficientPointsMessage}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setInsufficientPointsMessage(null)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X size={16} />
          </Button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Storybook List */}
        <aside className={`${currentStorybook ? 'hidden lg:flex lg:w-[350px]' : 'flex w-full'} border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-2xl`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-indigo-600 bg-slate-50">
            <div className="flex items-center gap-2">
              <BookOpen size={18} />
              <h2 className="font-black text-xs uppercase tracking-widest">My Storybooks</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onCreateNew} title="创建新绘本">
              <Plus size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 custom-scrollbar">
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
                  className={`group p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    currentStorybook?.id === book.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-transparent bg-white hover:border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{book.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(book.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={
                          book.status === 'finished' ? 'success'
                          : book.status === 'error' ? 'destructive'
                          : book.status === 'creating' || book.status === 'updating' ? 'info'
                          : 'muted'
                        } className="text-[10px] uppercase">
                          {statusTextMap[book.status] || book.status}
                        </Badge>
                        <button
                          onClick={(e) => handleTogglePublic(book.id, book.is_public, e)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                            book.is_public
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={book.is_public ? '点击设为私密' : '点击设为公开'}
                        >
                          {book.is_public ? <><Globe size={10} /><span>公开</span></> : <><Lock size={10} /><span>私密</span></>}
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => handleDelete(book.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 h-7 w-7 shrink-0"
                    >
                      <Trash2 size={14} />
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
                <div className="h-1.5 bg-indigo-100">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 py-2 bg-indigo-50/90 backdrop-blur-sm text-indigo-700 text-sm font-medium">
                  <Loader2 size={14} className="animate-spin" />
                  正在制作，请稍后…{Math.round(downloadProgress)}%
                </div>
              </div>
            )}
            {/* Floating Input Box */}
            {showFloatingInput && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                <FloatingInputBox
                  visible={showFloatingInput}
                  placeholder={
                    editingPage !== null
                      ? "描述你想要的修改... (例如: 把兔子画得更可爱一些)"
                      : "描述你想要的修改... (例如: 让故事更感人一些)"
                  }
                  collapsedPlaceholder={editingPage !== null ? `编辑第 ${editingPage + 1} 页...` : "编辑绘本..."}
                  onSubmit={(text) => {
                    if (editingPage !== null) {
                      handleEditPage(text);
                    } else {
                      handleEditStorybook(text);
                    }
                  }}
                  onCancel={() => { setEditingPage(null); setShowFloatingInput(false); }}
                  isLoading={isEditing}
                  error={error}
                  loadingMessage={editingPage !== null ? "编辑页面中..." : "编辑绘本中..."}
                  mode={editingPage !== null ? `编辑第 ${editingPage + 1} 页` : "编辑绘本"}
                  disabled={!currentStorybook || currentStorybook.status !== 'finished'}
                  showCancelButton={true}
                />
              </div>
            )}

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
              <div className="text-center space-y-6">
                <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-slate-600">加载中...</p>
              </div>
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
                    {currentStorybook.instruction && (
                      <Button onClick={handleRegenerate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                        <Sparkles size={18} /> 重新生成
                      </Button>
                    )}
                    <Button variant="secondary" onClick={onBack}>返回首页</Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && currentStorybook && (currentStorybook.status === 'init' || currentStorybook.status === 'creating' || currentStorybook.status === 'updating') && (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center space-y-6 max-w-sm w-full px-8">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
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
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
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
                    {currentStorybook.instruction && (
                      <Button onClick={handleRegenerate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                        <Sparkles size={18} /> 重新生成
                      </Button>
                    )}
                    <Button variant="secondary" onClick={onBack}>返回首页</Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && currentStorybook && currentStorybook.status === 'finished' && pages.length > 0 && (
              <>
                <div className="relative w-full max-w-5xl aspect-[16/9] transition-all duration-500">
                  <Button
                    variant="ghost" size="icon"
                    onClick={prevSpread}
                    disabled={currentSpreadIndex === 0}
                    className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl z-40 disabled:opacity-0 hover:scale-110 h-14 w-14"
                  >
                    <ChevronLeft size={32} />
                  </Button>

                  <div className="w-full h-full relative rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden bg-white">
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
                          <div className="w-full h-full relative bg-gradient-to-br from-indigo-100 to-purple-100">
                            <img src={page.image_url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => { setEditingPage(idx); setShowFloatingInput(true); }}
                              className="absolute top-4 right-4 bg-white/90 hover:bg-white backdrop-blur rounded-lg text-indigo-600 shadow-lg z-20"
                              title="编辑此页"
                            >
                              <Edit2 size={18} />
                            </Button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-6 pt-10 pb-4">
                              <p className="text-white text-sm md:text-base lg:text-lg font-lexend leading-relaxed text-center drop-shadow">
                                {page.text}
                              </p>
                            </div>
                            <div className="absolute bottom-3 right-3 px-2.5 py-0.5 bg-black/50 backdrop-blur rounded-full z-20">
                              <span className="text-white text-xs font-bold">{idx + 1}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant="ghost" size="icon"
                    onClick={nextSpread}
                    disabled={currentSpreadIndex >= pages.length - 1}
                    className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl z-40 disabled:opacity-0 hover:scale-110 h-14 w-14"
                  >
                    <ChevronRight size={32} />
                  </Button>
                </div>

                <div className="mt-8 flex gap-3">
                  {pages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSpreadIndex(idx)}
                      className={`h-2 transition-all duration-500 rounded-full ${
                        currentSpreadIndex === idx ? 'w-12 bg-indigo-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

export default EditorView;
