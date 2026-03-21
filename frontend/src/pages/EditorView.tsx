
import React, { useState, useEffect, useCallback } from 'react';
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
  Storybook,
  StorybookListItem,
} from '../services/storybookService';
import { usePolling } from '../hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressCaterpillar from '../components/ProgressCaterpillar';
import ReadMode from './editor/ReadMode';
import EditMode from './editor/EditMode';
import ReorderMode from './editor/ReorderMode';
import RegenMode from './editor/RegenMode';
import CoverMode from './editor/CoverMode';
import BackCoverMode from './editor/BackCoverMode';

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

  const [mode, setMode] = useState<EditorMode>('read');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState(false);

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
    setMode('read');
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
      setMode('read');
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
  const canEditModes = pages.length > 0;
  const canReadPages = pages.length > 0;

  const modeTabs: { key: EditorMode; label: string; icon: React.ReactNode }[] = [
    { key: 'read',      label: '阅读',      icon: <Eye size={14} /> },
    { key: 'edit',      label: '编辑页',    icon: <Edit2 size={14} /> },
    { key: 'reorder',   label: '排序',      icon: <ArrowUpDown size={14} /> },
    { key: 'regen',     label: '继续创作',   icon: <Layers size={14} /> },
    { key: 'cover',     label: '生成封面',   icon: <BookImage size={14} /> },
    { key: 'backcover', label: '生成封底',   icon: <BookImage size={14} /> },
  ];

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
            正在生成更多页面… 已完成 {pages.length} 页
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
      const showErrorBanner = currentStorybook.status === 'error' && pages.length > 0;
      let content: React.ReactNode = null;

      if (mode === 'read') {
        content = (
          <ReadMode
            pages={pages}
            currentIndex={currentPageIndex}
            onIndexChange={setCurrentPageIndex}
            aspectRatio={currentStorybook.aspect_ratio}
          />
        );
      }
      if (canEditModes && mode === 'edit') {
        content = (
          <EditMode
            storybook={currentStorybook}
            onStorybookChange={setCurrentStorybook}
          />
        );
      }
      if (canEditModes && mode === 'reorder') {
        content = (
          <ReorderMode
            storybook={currentStorybook}
            onStorybookChange={(updated) => {
              setCurrentStorybook(updated);
              setCurrentPageIndex(0);
            }}
            onExit={() => setMode('read')}
          />
        );
      }
      if (canEditModes && mode === 'regen') {
        content = (
          <RegenMode
            storybook={currentStorybook}
            onStorybookChange={(updated) => {
              setCurrentStorybook(updated);
              setStorybookList(prev =>
                prev.map(item => item.id === updated.id ? { ...item, status: updated.status } : item)
              );
            }}
            onStartPolling={startPolling}
            onExit={() => setMode('read')}
          />
        );
      }
      if (canEditModes && mode === 'cover') {
        content = (
          <CoverMode
            storybook={currentStorybook}
            onCoverGenerating={() => {
              setCurrentStorybook(prev => prev ? { ...prev, status: 'updating' } : prev);
              setMode('read');
              startPolling(currentStorybook.id);
            }}
          />
        );
      }
      if (canEditModes && mode === 'backcover') {
        content = (
          <BackCoverMode
            storybook={currentStorybook}
            onBack={() => setMode('read')}
            onBackCoverCreated={async () => {
              // 重新加载绘本数据
              await loadStorybook(currentStorybook.id);
              setMode('read');
            }}
          />
        );
      }

      if (!content) return null;

      if (!showErrorBanner) return content;

      return (
        <div className="w-full flex flex-col gap-3">
          <div className="w-full max-w-4xl flex items-center gap-2 py-2 px-3 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-100">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              {currentStorybook.error_message || '内容生成过程中遇到问题，以下为已生成的页面。'}
            </span>
          </div>
          {content}
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
            {/* Mode tabs */}
            {canEditModes && (
              <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
                {modeTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setMode(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === tab.key
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
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

          {/* Right: Workspace */}
          {currentStorybook && (
            <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-auto">
              {/* Download progress bar */}
              {isDownloading && (
                <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-2 pb-1 bg-slate-50/90 backdrop-blur-sm">
                  <ProgressCaterpillar progress={downloadProgress} showLabel />
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

              {renderContent()}
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
    </>
  );
};

export default EditorView;
