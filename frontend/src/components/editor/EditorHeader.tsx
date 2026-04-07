/**
 * 编辑器顶部导航栏组件
 */

import React from 'react';
import { ChevronLeft, Plus, BookImage, Download, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_TEXT_MAP } from '@/constants/editor';

interface EditorHeaderProps {
  currentStorybook: {
    title?: string;
    status?: string;
  } | null;
  pages: Array<any>;
  isCreating: boolean;
  canReadPages: boolean;
  onBack: () => void;
  onCreateNew: () => void;
  onInsertPage: () => void;
  onGenerateCover: () => void;
  onGenerateBackCover: () => void;
  onDownload: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  currentStorybook,
  pages,
  isCreating,
  canReadPages,
  onBack,
  onCreateNew,
  onInsertPage,
  onGenerateCover,
  onGenerateBackCover,
  onDownload,
}) => {
  const pagesCount = pages.length;
  const status = currentStorybook?.status;
  const statusText = status ? STATUS_TEXT_MAP[status] || status : '未知';
  const title = currentStorybook?.title || '选择一本绘本';

  const isFinished = status === 'finished';

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
      {/* 左侧：返回按钮和标题 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-full text-slate-500"
        >
          <ChevronLeft />
        </Button>
        <div>
          <h1 className="font-semibold text-slate-900 truncate max-w-[200px] md:max-w-md text-base">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-0.5">
            <span>{pagesCount} 页</span>
            <span className="text-slate-300">|</span>
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      {/* 右侧：功能按钮组 */}
      <div className="flex items-center gap-3">
        {/* 编辑功能按钮 */}
        {canReadPages && (
          <>
            <Button
              onClick={onInsertPage}
              disabled={isCreating}
              variant="outline"
              className="hidden md:flex"
            >
              <Plus size={16} />
              插入页
            </Button>
            <Button
              onClick={onGenerateCover}
              disabled={isCreating}
              variant="outline"
              className="hidden md:flex"
            >
              <BookImage size={16} />
              生成封面
            </Button>
            <Button
              onClick={onGenerateBackCover}
              disabled={isCreating}
              variant="outline"
              className="hidden md:flex"
            >
              <BookImage size={16} />
              生成封底
            </Button>
          </>
        )}

        {/* 下载和创建按钮 */}
        <Button
          onClick={onDownload}
          disabled={!isFinished}
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
  );
};

export default EditorHeader;
