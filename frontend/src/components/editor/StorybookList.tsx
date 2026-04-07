/**
 * 绘本列表组件
 */

import React from 'react';
import { BookOpen, Plus, Trash2, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_TEXT_MAP } from '@/constants/editor';
import { formatDateChinese } from '@/utils/editorUtils';
import { StorybookListItem } from '@/services/storybookService';

interface StorybookListProps {
  storybookList: StorybookListItem[];
  currentStorybookId?: number | null;
  isVisible?: boolean;
  onSelectStorybook: (id: number) => void;
  onDeleteStorybook: (id: number, e: React.MouseEvent) => void;
  onTogglePublic: (id: number, isPublic: boolean, e: React.MouseEvent) => void;
  onCreateNew: () => void;
}

export const StorybookList: React.FC<StorybookListProps> = ({
  storybookList,
  currentStorybookId,
  isVisible = true,
  onSelectStorybook,
  onDeleteStorybook,
  onTogglePublic,
  onCreateNew,
}) => {
  if (!isVisible) return null;

  return (
    <aside className="border-r border-slate-200 bg-white flex flex-col w-full lg:w-[280px] shrink-0 relative z-20 shadow-lg">
      {/* 标题栏 */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2 text-slate-600">
          <BookOpen size={16} className="text-slate-400" />
          <h2 className="font-semibold text-sm">我的故事书</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateNew}
          title="创建新绘本"
          className="text-slate-400 hover:text-slate-600 h-8 w-8"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* 绘本列表 */}
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
            <StorybookCard
              key={book.id}
              book={book}
              isActive={currentStorybookId === book.id}
              onSelect={() => onSelectStorybook(book.id)}
              onDelete={(e) => onDeleteStorybook(book.id, e)}
              onTogglePublic={(e) => onTogglePublic(book.id, book.is_public, e)}
            />
          ))
        )}
      </div>
    </aside>
  );
};

interface StorybookCardProps {
  book: StorybookListItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePublic: (e: React.MouseEvent) => void;
}

const StorybookCard: React.FC<StorybookCardProps> = ({
  book,
  isActive,
  onSelect,
  onDelete,
  onTogglePublic,
}) => {
  const statusText = STATUS_TEXT_MAP[book.status] || book.status;
  const statusColorClass =
    book.status === 'finished'
      ? 'bg-emerald-50 text-emerald-700'
      : book.status === 'error'
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700';

  return (
    <div
      onClick={onSelect}
      className={`group p-3 rounded-xl cursor-pointer transition-all ${
        isActive
          ? 'bg-white shadow-md shadow-slate-200/80 ring-1 ring-slate-200'
          : 'bg-white/70 hover:bg-white hover:shadow-sm hover:shadow-slate-200/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-slate-800 truncate leading-snug">
            {book.title}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {formatDateChinese(book.created_at)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColorClass}`}
            >
              {statusText}
            </span>
            <button
              onClick={onTogglePublic}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                book.is_public
                  ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title={book.is_public ? '点击设为私密' : '点击设为公开'}
            >
              {book.is_public ? (
                <>
                  <Globe size={9} />
                  &nbsp;已发布
                </>
              ) : (
                <>
                  <Lock size={9} />
                  &nbsp;私稿
                </>
              )}
            </button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 h-6 w-6 shrink-0 -mt-0.5"
          title="删除绘本"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
};

export default StorybookList;
