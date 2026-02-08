
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Edit2, Loader2, Trash2, Plus, Sparkles, AlertCircle } from 'lucide-react';
import {
  getStorybook,
  listStorybooks,
  editStorybook,
  editStorybookPage,
  deleteStorybook,
  Storybook,
  StorybookPage as StorybookPageType,
  StorybookListItem
} from '../services/storybookService';

// 别名类型用于内部使用
type StoryPage = StorybookPageType;

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
  onBack: () => void;
  onCreateNew: () => void;
}

const EditorView: React.FC<EditorViewProps> = ({ storybookId, onBack, onCreateNew }) => {
  const [currentStorybook, setCurrentStorybook] = useState<Storybook | null>(null);
  const [storybookList, setStorybookList] = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

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
      const list = await listStorybooks({ limit: 20 });
      setStorybookList(list);
    } catch (err) {
      console.error('Failed to load storybook list:', err);
    }
  };

  const loadStorybook = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const book = await getStorybook(id);
      setCurrentStorybook(book);
      setCurrentSpreadIndex(0);
    } catch (err) {
      console.error('Failed to load storybook:', err);
      setError(err instanceof Error ? err.message : '加载绘本失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStorybookSelect = (id: number) => {
    loadStorybook(id);
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

  // 编辑绘本
  const handleEditStorybook = async () => {
    if (!currentStorybook || !editPrompt.trim() || isEditing) return;

    setIsEditing(true);
    try {
      const updated = await editStorybook(currentStorybook.id, { instruction: editPrompt });
      setCurrentStorybook(updated);
      setEditPrompt('');
      alert('绘本已更新！');
    } catch (err) {
      console.error('Failed to edit storybook:', err);
      alert('编辑失败');
    } finally {
      setIsEditing(false);
    }
  };

  // 编辑单页
  const handleEditPage = async (pageIndex: number) => {
    if (!currentStorybook || !editPrompt.trim() || isEditing) return;

    setIsEditing(true);
    setEditingPage(null);
    try {
      const updated = await editStorybookPage(currentStorybook.id, pageIndex, { instruction: editPrompt });
      setCurrentStorybook(updated);
      setEditPrompt('');
      alert('页面已更新！');
    } catch (err) {
      console.error('Failed to edit page:', err);
      alert('编辑失败');
    } finally {
      setIsEditing(false);
    }
  };

  // 翻页逻辑 - 单页模式
  const pages = currentStorybook?.pages || [];

  const nextSpread = useCallback(() => {
    if (currentSpreadIndex < pages.length - 1) {
      setCurrentSpreadIndex(prev => prev + 1);
    }
  }, [currentSpreadIndex, pages.length]);

  const prevSpread = useCallback(() => {
    if (currentSpreadIndex > 0) {
      setCurrentSpreadIndex(prev => prev - 1);
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

  // 渲染单页内容（16:9 横向布局，上图下文）
  const renderPageContent = (page: StoryPage | undefined, pageIndex: number) => {
    if (!page) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="text-center space-y-6">
            <BookOpen size={64} className="mx-auto text-slate-200" />
            <p className="text-slate-300 italic font-lexend text-lg">To be continued...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col bg-white">
        {/* 上半部分：图片 (16:9) */}
        <div className="relative flex-1 bg-gradient-to-br from-indigo-100 to-purple-100">
          <img
            src={page.image_url}
            alt={`Page ${pageIndex + 1}`}
            className="w-full h-full object-cover"
            style={{ aspectRatio: '16/9' }}
          />
          {/* 编辑按钮 */}
          <button
            onClick={() => setEditingPage(pageIndex)}
            className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white backdrop-blur rounded-lg text-indigo-600 transition-all shadow-lg"
            title="编辑此页"
          >
            <Edit2 size={18} />
          </button>
          {/* 页码 */}
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur rounded-full">
            <span className="text-white text-sm font-bold">{pageIndex + 1}</span>
          </div>
        </div>

        {/* 下半部分：文字 */}
        <div className="h-2/5 bg-gradient-to-br from-amber-50 to-orange-50 book-paper-texture relative p-8 md:p-12 flex flex-col justify-center">
          <p className="text-lg md:text-xl lg:text-2xl text-slate-800 font-lexend leading-[1.8] text-center">
            {page.text}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#E2E8F0]">
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
          <button
            onClick={() => {
              if (editPrompt.trim()) {
                handleEditStorybook();
              }
            }}
            disabled={!editPrompt.trim() || isEditing}
            className="hidden md:flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Edit2 size={16} />
            {isEditing ? '编辑中...' : '编辑绘本'}
          </button>
        </div>
      </header>

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

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
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
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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

          {/* Edit Panel */}
          {currentStorybook && editingPage === null && (
            <div className="p-4 bg-white border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase">编辑绘本</p>
              <textarea
                placeholder="描述你想要的修改... (例如: 让故事更感人一些)"
                className="w-full bg-slate-100 border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                rows={3}
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
              />
            </div>
          )}

          {/* Edit Page Panel */}
          {editingPage !== null && (
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">编辑第 {editingPage + 1} 页</p>
                <button
                  onClick={() => setEditingPage(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  取消
                </button>
              </div>
              <textarea
                placeholder="描述你想要的修改... (例如: 把兔子画得更可爱一些)"
                className="w-full bg-slate-100 border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100 resize-none mb-2"
                rows={3}
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
              />
              <button
                onClick={() => handleEditPage(editingPage)}
                disabled={!editPrompt.trim() || isEditing}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isEditing ? '编辑中...' : '应用修改'}
              </button>
            </div>
          )}
        </aside>

        {/* Right: Book Workspace - Only show when storybook is selected */}
        {currentStorybook && (
          <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-hidden">
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
                <button
                  onClick={() => {
                    if (currentStorybook) {
                      handleDelete(currentStorybook.id, { stopPropagation: () => {} } as React.MouseEvent);
                    }
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  返回首页
                </button>
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
                <button
                  onClick={() => {
                    if (currentStorybook) {
                      handleDelete(currentStorybook.id, { stopPropagation: () => {} } as React.MouseEvent);
                    }
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  返回首页
                </button>
              </div>
            </div>
          )}

          {!loading && currentStorybook && currentStorybook.status === 'finished' && pages.length > 0 && (
            <>
              {/* Book Container - 单页模式 16:9 */}
              <div className="relative w-full max-w-5xl aspect-video flex transition-all duration-500">
                {/* Navigation Left */}
                <button
                  onClick={prevSpread}
                  disabled={currentSpreadIndex === 0}
                  className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110"
                >
                  <ChevronLeft size={32} />
                </button>

                {/* 3D Book Pages */}
                <div className="w-full h-full relative bg-white rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
                  {pages.map((page, idx) => {
                    const isActive = idx === currentSpreadIndex;
                    const isPrev = idx === currentSpreadIndex - 1;
                    const isNext = idx === currentSpreadIndex + 1;

                    let animationClass = '';
                    if (isActive) {
                      animationClass = 'z-10';
                    } else if (isPrev) {
                      animationClass = 'opacity-0 z-0 transform -translate-x-full -rotate-y-12 page-exit-left';
                    } else if (isNext) {
                      animationClass = 'opacity-0 z-0 transform translate-x-full rotate-y-12 page-enter-right';
                    } else {
                      animationClass = 'opacity-0 z-0 pointer-events-none';
                    }

                    return (
                      <div
                        key={idx}
                        className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out ${animationClass}`}
                        style={{
                          transformStyle: 'preserve-3d',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                        {renderPageContent(page, idx)}
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
