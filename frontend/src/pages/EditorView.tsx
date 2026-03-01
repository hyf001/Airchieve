
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Trash2, Plus, Sparkles, AlertCircle, Download, PenTool, Edit2, Lock, Globe } from 'lucide-react';
import FloatingInputBox from '../components/FloatingInputBox';
import {
  getStorybook,
  listStorybooks,
  editStorybookStream,
  editStorybookPage,
  deleteStorybook,
  createStorybookStream,
  updateStorybookPublicStatus,
  InsufficientPointsError,
  StreamEvent,
  CreateStorybookRequest,
  Storybook,
  StorybookListItem
} from '../services/storybookService';

// 状态文本映射
const statusTextMap: Record<string, string> = {
  init: '初始化',
  creating: '生成中',
  updating: '更新中',
  finished: '已完成',
  error: '错误'
};

interface EditorViewProps {
  storybookId?: number;
  createParams?: CreateStorybookRequest | null;
  onBack: () => void;
  onCreateNew: () => void;
  onStorybookCreated?: (storybookId: number) => void;
}

const EditorView: React.FC<EditorViewProps> = ({
  storybookId,
  createParams,
  onBack,
  onCreateNew,
  onStorybookCreated,
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

  // 是否正在创建绘本
  const [isCreating, setIsCreating] = useState(false);
  // 保存创建参数，用于出错时重新生成
  const [savedCreateParams, setSavedCreateParams] = useState<CreateStorybookRequest | null>(null);
  // 使用 ref 追踪上一次的 createParams，防止 Strict Mode 双重调用
  const prevCreateParamsRef = React.useRef<CreateStorybookRequest | null>(null);

  // 加载绘本列表
  useEffect(() => {
    loadStorybookList();
  }, []);

  // 加载当前绘本
  useEffect(() => {
    if (storybookId) {
      loadStorybook(storybookId);
    } else {
      // 没有 storybookId 时，不显示 loading
      setLoading(false);
      setCurrentStorybook(null);
    }
  }, [storybookId]);

  const loadStorybookList = async () => {
    try {
      const list = await listStorybooks({ creator: user ? String(user.id) : undefined, limit: 20 });
      setStorybookList(list);

      // 如果没有传入 storybookId 且列表不为空，自动加载第一个绘本
      if (!storybookId && list.length > 0 && !currentStorybook) {
        loadStorybook(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load storybook list:', err);
    }
  };

  const loadStorybook = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const book = await getStorybook(id);
      setCurrentStorybook(book);
      setCurrentSpreadIndex(0);

      // 同时更新列表中的对应项
      setStorybookList(prevList => {
        const index = prevList.findIndex(item => item.id === id);
        if (index !== -1) {
          const newList = [...prevList];
          newList[index] = {
            ...newList[index],
            status: book.status
          };
          return newList;
        }
        return prevList;
      });
    } catch (err) {
      console.error('Failed to load storybook:', err);
      setError(err instanceof Error ? err.message : '加载绘本失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 公共方法 ----

  // 构建流式事件处理回调
  // refreshList: 是否在收到事件时刷新绘本列表（编辑绘本需要，创建不需要）
  // onIdReceived: 收到新绘本 ID 时的额外回调
  const buildStreamEventHandler = (options: {
    onIdReceived?: (id: number) => void;
    refreshList?: boolean;
  }) => {
    let capturedId: number | undefined;
    return (event: StreamEvent) => {
      console.log('Stream event:', event);
      switch (event.type) {
        case 'storybook_created':
          capturedId = event.data.id;
          if (event.data.id) {
            options.onIdReceived?.(event.data.id);
            loadStorybook(event.data.id);
            // 乐观更新：storybook_created 时立即将新项插入列表顶部，避免等待列表刷新
            if (event.data.title) {
              const newId = event.data.id;
              const newTitle = event.data.title;
              setStorybookList(prev => {
                if (prev.find(item => item.id === newId)) return prev;
                return [{
                  id: newId,
                  title: newTitle,
                  description: null,
                  creator: user ? String(user.id) : '',
                  status: 'creating' as const,
                  is_public: false,
                  created_at: new Date().toISOString(),
                  pages: null,
                }, ...prev];
              });
            }
            if (options.refreshList) loadStorybookList();
          }
          break;
        case 'generation_completed':
          if (capturedId) loadStorybook(capturedId);
          // 完成后刷新列表以更新最终状态
          if (options.refreshList) loadStorybookList();
          break;
        case 'generation_error':
        case 'error':
          if (event.data.code === 'INSUFFICIENT_POINTS') {
            setInsufficientPointsMessage(event.data.error || '积分不足');
          }
          if (capturedId) loadStorybook(capturedId);
          if (options.refreshList) loadStorybookList();
          break;
      }
    };
  };

  // 处理流式操作的错误（catch 块公共逻辑）
  const handleStreamError = (err: unknown, defaultMsg: string) => {
    console.error('Stream error:', err);
    if (err instanceof InsufficientPointsError) {
      setInsufficientPointsMessage(err.message);
    } else {
      setError(err instanceof Error ? err.message : defaultMsg);
    }
  };

  // 创建绘本流式操作（create 和 regenerate 的公共实现）
  // 注意：调用者需在调用前同步设置 setIsCreating(true)
  const doCreateStream = async (params: CreateStorybookRequest, errorMsg: string) => {
    setLoading(true);
    setError(null);
    setInsufficientPointsMessage(null);
    try {
      await createStorybookStream(
        params,
        buildStreamEventHandler({
          onIdReceived: (id) => { if (onStorybookCreated) onStorybookCreated(id); },
          refreshList: true,
        })
      );
    } catch (err) {
      handleStreamError(err, errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  // 当有 createParams 时，创建绘本
  useEffect(() => {
    if (!createParams || isCreating) return;

    // 使用 ref 防止 React Strict Mode 双重调用导致的重复请求
    if (prevCreateParamsRef.current === createParams) return;
    prevCreateParamsRef.current = createParams;

    // 立即同步设置 isCreating，防止重复执行
    setIsCreating(true);
    setSavedCreateParams(createParams);
    doCreateStream(createParams, '创建绘本失败');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createParams]);

  const handleStorybookSelect = (id: number) => {
    loadStorybook(id);
  };

  // 重新生成绘本
  const handleRegenerate = () => {
    if (!savedCreateParams || isCreating) return;
    setIsCreating(true);
    doCreateStream(savedCreateParams, '重新生成失败');
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个绘本吗？')) return;

    try {
      await deleteStorybook(id);
      await loadStorybookList();
      if (currentStorybook?.id === id) {
        setCurrentStorybook(null);
      }
    } catch (err) {
      console.error('Failed to delete storybook:', err);
      alert('删除失败');
    }
  };

  const handleTogglePublic = async (id: number, currentIsPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await updateStorybookPublicStatus(id, !currentIsPublic);
      // 更新列表中的状态
      setStorybookList(prevList =>
        prevList.map(book =>
          book.id === id ? { ...book, is_public: !currentIsPublic } : book
        )
      );
    } catch (err) {
      console.error('Failed to toggle public status:', err);
      alert('更新公开状态失败');
    }
  };

  // 编辑绘本（流式版本）
  const handleEditStorybook = async (instruction: string) => {
    if (!currentStorybook || !instruction.trim() || isEditing) return;

    setIsEditing(true);
    setLoading(true);
    setError(null);
    setInsufficientPointsMessage(null);

    try {
      await editStorybookStream(
        currentStorybook.id,
        { instruction },
        buildStreamEventHandler({ refreshList: true })
      );
    } catch (err) {
      handleStreamError(err, '编辑绘本失败');
    } finally {
      setIsEditing(false);
      setLoading(false);
    }
  };

  // 编辑单页
  const handleEditPage = async (instruction: string) => {
    if (!currentStorybook || !instruction.trim() || isEditing || editingPage === null) return;

    setIsEditing(true);
    setInsufficientPointsMessage(null);
    try {
      const updated = await editStorybookPage(currentStorybook.id, editingPage, { instruction });
      setCurrentStorybook(updated);
      setEditingPage(null);
      setShowFloatingInput(false);
      alert('页面已更新！');
    } catch (err) {
      console.error('Failed to edit page:', err);
      if (err instanceof InsufficientPointsError) {
        setInsufficientPointsMessage(err.message);
      } else {
        alert('编辑失败');
      }
    } finally {
      setIsEditing(false);
    }
  };

  // 翻页逻辑 - 单页模式
  const pages = currentStorybook?.pages || [];

  const nextSpread = useCallback(() => {
    if (currentSpreadIndex < pages.length - 1) {
      const nextPageIndex = currentSpreadIndex + 1;
      // First set direction and animating page, then update index in next tick
      setPageDirection('right');
      setAnimatingPageIndex(nextPageIndex);
      setTimeout(() => {
        setCurrentSpreadIndex(nextPageIndex);
      }, 0);
      // Reset direction after animation completes
      setTimeout(() => {
        setPageDirection(null);
        setAnimatingPageIndex(null);
      }, 700);
    }
  }, [currentSpreadIndex, pages.length]);

  const prevSpread = useCallback(() => {
    if (currentSpreadIndex > 0) {
      const prevPageIndex = currentSpreadIndex - 1;
      // First set direction and animating page, then update index in next tick
      setPageDirection('left');
      setAnimatingPageIndex(prevPageIndex);
      setTimeout(() => {
        setCurrentSpreadIndex(prevPageIndex);
      }, 0);
      // Reset direction after animation completes
      setTimeout(() => {
        setPageDirection(null);
        setAnimatingPageIndex(null);
      }, 700);
    }
  }, [currentSpreadIndex]);

  // 键盘导航
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
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500"
          >
            <ChevronLeft />
          </button>
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
          {/* 编辑绘本按钮 */}
          <button
            onClick={() => {
              setEditingPage(null);
              setShowFloatingInput(true);
            }}
            disabled={!currentStorybook || currentStorybook.status !== 'finished'}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/50 hover:-translate-y-0.5 active:translate-y-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <PenTool size={16} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">编辑绘本</span>
          </button>

          {/* 导出绘本按钮 */}
          <button
            onClick={() => {
              // TODO: 实现导出功能
              alert('导出功能开发中...');
            }}
            disabled={!currentStorybook || currentStorybook.status !== 'finished'}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Download size={16} className="relative z-10 group-hover:translate-y-0.5 transition-transform duration-300" />
            <span className="relative z-10">导出绘本</span>
          </button>

          {/* 制作绘本按钮 */}
          <button
            onClick={onCreateNew}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/50 hover:-translate-y-0.5 active:translate-y-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Sparkles size={16} className="relative z-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">制作绘本</span>
          </button>
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
          <button
            onClick={() => setInsufficientPointsMessage(null)}
            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Storybook List - Show full width when no storybook selected */}
        <aside className={`${currentStorybook ? 'hidden lg:flex lg:w-[350px]' : 'flex w-full'} border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-2xl`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-indigo-600 bg-slate-50">
            <div className="flex items-center gap-2">
              <BookOpen size={18} />
              <h2 className="font-black text-xs uppercase tracking-widest">My Storybooks</h2>
            </div>
            <button
              onClick={onCreateNew}
              className="p-2 hover:bg-indigo-100 rounded-lg transition-all"
              title="创建新绘本"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 custom-scrollbar">
            {storybookList.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={24} />
                </div>
                <p className="text-slate-500 text-sm">
                  暂无绘本，点击上方 + 创建第一个绘本
                </p>
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
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          book.status === 'finished'
                            ? 'bg-green-100 text-green-700'
                            : book.status === 'init'
                            ? 'bg-gray-100 text-gray-700'
                            : book.status === 'creating' || book.status === 'updating'
                            ? 'bg-blue-100 text-blue-700'
                            : book.status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {statusTextMap[book.status] || book.status}
                        </span>
                        {/* 公开/私密标识 */}
                        <button
                          onClick={(e) => handleTogglePublic(book.id, book.is_public, e)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                            book.is_public
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={book.is_public ? '点击设为私密' : '点击设为公开'}
                        >
                          {book.is_public ? (
                            <>
                              <Globe size={10} />
                              <span>公开</span>
                            </>
                          ) : (
                            <>
                              <Lock size={10} />
                              <span>私密</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(book.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right: Book Workspace - Only show when storybook is selected */}
        {currentStorybook && (
          <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-hidden">
            {/* Floating Input Box Overlay */}
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
                  onCancel={() => {
                    setEditingPage(null);
                    setShowFloatingInput(false);
                  }}
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
                <p className="text-slate-400 text-sm leading-relaxed">抱歉，绘本生成过程中遇到了错误。请检查网络连接或稍后重试。</p>
                <div className="flex items-center justify-center gap-3">
                  {savedCreateParams && (
                    <button
                      onClick={handleRegenerate}
                      disabled={isCreating}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          重新生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          重新生成
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (currentStorybook) {
                        handleDelete(currentStorybook.id, { stopPropagation: () => {} } as React.MouseEvent);
                      }
                    }}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                  >
                    返回首页
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && currentStorybook && (currentStorybook.status === 'init' || currentStorybook.status === 'creating' || currentStorybook.status === 'updating') && (
            <div className="w-full h-full flex items-center justify-center bg-white">
              <div className="text-center space-y-6 max-w-sm">
                <div className="relative inline-block">
                  <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                </div>
                <h3 className="text-xl font-lexend font-bold text-slate-800">正在装帧你的故事...</h3>
                <p className="text-slate-400 text-sm leading-relaxed">正在将你的灵感转化为精美的插画与排版，这可能需要一点点时间。</p>
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
                  {savedCreateParams && (
                    <button
                      onClick={handleRegenerate}
                      disabled={isCreating}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          重新生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          重新生成
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (currentStorybook) {
                        handleDelete(currentStorybook.id, { stopPropagation: () => {} } as React.MouseEvent);
                      }
                    }}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                  >
                    返回首页
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && currentStorybook && currentStorybook.status === 'finished' && pages.length > 0 && (
            <>
              {/* 页面容器 - 按16:9设计，16:9图片刚好占满，其他比例会有空白 */}
              <div className="relative w-full max-w-5xl aspect-[16/9] transition-all duration-500">
                {/* Navigation Left */}
                <button
                  onClick={prevSpread}
                  disabled={currentSpreadIndex === 0}
                  className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110"
                >
                  <ChevronLeft size={32} />
                </button>

                {/* 3D Book Pages - 整页（图片+文字） */}
                <div className="w-full h-full relative rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden bg-white">
                  {pages.map((page, idx) => {
                    const isActive = idx === currentSpreadIndex;
                    const isAnimating = idx === animatingPageIndex;

                    let animationClass = '';
                    if (isAnimating && pageDirection === 'left') {
                      // Previous page entering from left
                      animationClass = 'opacity-100 z-20 page-enter-left';
                    } else if (isAnimating && pageDirection === 'right') {
                      // Next page entering from right
                      animationClass = 'opacity-100 z-20 page-enter-right';
                    } else if (isActive) {
                      animationClass = 'z-10 opacity-100';
                    } else {
                      animationClass = 'opacity-0 z-0 pointer-events-none';
                    }

                    return (
                      <div
                        key={idx}
                        className={`absolute inset-0 w-full transition-all duration-700 ease-in-out ${animationClass}`}
                        style={{
                          transformStyle: 'preserve-3d',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                        {/* 整页内容：图片填满，文字叠加底部 */}
                        <div className="w-full h-full relative bg-gradient-to-br from-indigo-100 to-purple-100">
                          {/* 图片 - object-contain：16:9图片刚好占满，其他比例留空白 */}
                          <img
                            src={page.image_url}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-contain"
                          />
                          {/* 编辑按钮 */}
                          <button
                            onClick={() => {
                              setEditingPage(idx);
                              setShowFloatingInput(true);
                            }}
                            className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white backdrop-blur rounded-lg text-indigo-600 transition-all shadow-lg z-20"
                            title="编辑此页"
                          >
                            <Edit2 size={18} />
                          </button>

                          {/* 文字区域 - 底部渐变叠加 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-6 pt-10 pb-4">
                            <p className="text-white text-sm md:text-base lg:text-lg font-lexend leading-relaxed text-center drop-shadow">
                              {page.text}
                            </p>
                          </div>

                          {/* 页码 - 右下角 */}
                          <div className="absolute bottom-3 right-3 px-2.5 py-0.5 bg-black/50 backdrop-blur rounded-full z-20">
                            <span className="text-white text-xs font-bold">{idx + 1}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation Right */}
                <button
                  onClick={nextSpread}
                  disabled={currentSpreadIndex >= pages.length - 1}
                  className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110"
                >
                  <ChevronRight size={32} />
                </button>
              </div>

              {/* Pagination */}
              <div className="mt-8 flex gap-3">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSpreadIndex(idx)}
                    className={`h-2 transition-all duration-500 rounded-full ${
                      currentSpreadIndex === idx
                        ? 'w-12 bg-indigo-600'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </main>
        )}
      </div>

      <style>{`
        .book-paper-texture {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='0.02' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
        }

        /* 按钮脉冲效果 */
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
          }
        }

        /* 添加微妙的呼吸动画 */
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        /* 自定义滚动条样式 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
          transition: background 0.2s;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Firefox 滚动条样式 */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }

        /* 3D 翻页动画效果 */
        @keyframes flipInLeft {
          from {
            transform: translateX(-100%) rotateY(-90deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotateY(0);
            opacity: 1;
          }
        }

        @keyframes flipInRight {
          from {
            transform: translateX(100%) rotateY(90deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotateY(0);
            opacity: 1;
          }
        }

        @keyframes flipOutLeft {
          from {
            transform: translateX(0) rotateY(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%) rotateY(-90deg);
            opacity: 0;
          }
        }

        @keyframes flipOutRight {
          from {
            transform: translateX(0) rotateY(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%) rotateY(90deg);
            opacity: 0;
          }
        }

        .page-enter-left {
          animation: flipInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .page-enter-right {
          animation: flipInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .page-exit-left {
          animation: flipOutLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .page-exit-right {
          animation: flipOutRight 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default EditorView;
