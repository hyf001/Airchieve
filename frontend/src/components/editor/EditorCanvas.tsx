/**
 * 编辑器画布组�� - 主要内容区域
 */

import React, { useState } from 'react';
import { AlertCircle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProgressCaterpillar from '@/components/ProgressCaterpillar';
import { getAspectRatioClass } from '@/utils/editorUtils';
import { STATUS_TEXT_MAP } from '@/constants/editor';
import { Storybook } from '@/services/storybookService';
import { TextEditOverlay } from './tools/text-edit/Overlay';
import { TextEditToolRef, TextLayer } from './tools/text-edit/types';
import { ToolId } from '@/types/tool';

interface EditorCanvasProps {
  currentStorybook: Storybook | null;
  currentPageIndex: number;
  isCreating: boolean;
  pages: Array<any>;
  canReadPages: boolean;
  loading: boolean;
  error: string | null;
  downloadProgress: number;
  isDownloading: boolean;
  onPageIndexChange: (index: number) => void;
  onTerminateClick: () => void;
  isTerminating: boolean;
  onBack: () => void;
  // 文字工具相关 props
  activeTool?: ToolId;
  textEditToolRef?: React.RefObject<TextEditToolRef>;
  textLayers?: TextLayer[];
  selectedLayerId?: string | null;
  isDragging?: boolean;
  isResizing?: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
  onTextApply?: () => void;  // 新增：文字自动应用回调
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  currentStorybook,
  currentPageIndex,
  isCreating,
  pages,
  canReadPages,
  loading,
  error,
  downloadProgress,
  isDownloading,
  onPageIndexChange,
  onTerminateClick,
  isTerminating,
  onBack,
  activeTool,
  textEditToolRef,
  textLayers = [],
  selectedLayerId = null,
  isDragging = false,
  isResizing = false,
  canvasRef: externalCanvasRef,
  onTextApply,
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState('1.0x');

  // 使用外部传入的 ref，而不是创建新的 ref
  const canvasRef = externalCanvasRef || React.useRef<HTMLDivElement>(null);

  if (!currentStorybook) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">请选择一本绘本</p>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const aspectRatio = currentStorybook.aspect_ratio || '16:9';

  return (
    <div className="flex-1 relative overflow-hidden bg-[#FAF3ED] p-4">
      {/* 下载进度条 */}
      {isDownloading && (
        <div className="absolute top-4 left-4 right-4 z-50 px-4 pt-2 pb-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
          <ProgressCaterpillar progress={downloadProgress} showLabel />
        </div>
      )}

      {/* 错误消息 */}
      {error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-900 px-6 py-4 rounded-2xl border-l-4 border-amber-500 font-medium text-sm shadow-2xl flex items-center gap-4">
          <AlertCircle className="text-amber-500 shrink-0" size={24} />
          <div className="flex flex-col">
            <span className="font-bold text-slate-800">创作遇阻</span>
            <span className="text-slate-500 text-xs">{error}</span>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="w-full h-full">
        {renderContent({
          currentStorybook,
          currentPageIndex,
          isCreating,
          pages,
          canReadPages,
          loading,
          currentPage,
          aspectRatio,
          onPageIndexChange,
          onTerminateClick,
          isTerminating,
          onBack,
          playbackSpeed,
          setPlaybackSpeed,
          activeTool,
          textEditToolRef,
          textLayers,
          selectedLayerId,
          isDragging,
          isResizing,
          canvasRef,
          onTextApply,
        })}
      </div>
    </div>
  );
};

interface RenderContentProps {
  currentStorybook: Storybook;
  currentPageIndex: number;
  isCreating: boolean;
  pages: Array<any>;
  canReadPages: boolean;
  loading: boolean;
  currentPage: any;
  aspectRatio: string;
  onPageIndexChange: (index: number) => void;
  onTerminateClick: () => void;
  isTerminating: boolean;
  onBack: () => void;
  playbackSpeed: string;
  setPlaybackSpeed: (speed: string) => void;
  activeTool?: ToolId;
  textEditToolRef?: React.RefObject<TextEditToolRef>;
  textLayers?: TextLayer[];
  selectedLayerId?: string | null;
  isDragging?: boolean;
  isResizing?: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
  onTextApply?: () => void;
}

function renderContent({
  currentStorybook,
  currentPageIndex,
  isCreating,
  pages,
  canReadPages,
  loading,
  currentPage,
  aspectRatio,
  onPageIndexChange,
  onTerminateClick,
  isTerminating,
  onBack,
  playbackSpeed,
  setPlaybackSpeed,
  activeTool,
  textEditToolRef,
  textLayers = [],
  selectedLayerId = null,
  isDragging = false,
  isResizing = false,
  canvasRef,
  onTextApply,
}: RenderContentProps): React.ReactNode {
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

  if ((canReadPages || isCreating) && currentPage) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        {/* 上半部分：页面图片区域 */}
        <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden flex items-center justify-center p-6">
          <div
            ref={canvasRef}
            className={`relative ${currentPage.image_url ? getAspectRatioClass(aspectRatio as any) : 'w-full h-full'} bg-slate-100 max-h-full`}
          >
            {currentPage.image_url ? (
              <img
                src={currentPage.image_url}
                alt={`第 ${currentPageIndex + 1} 页`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Loader2 size={36} className="text-[#00CDD4] animate-spin" />
                {isCreating ? (
                  <>
                    <span className="text-sm text-[#009fa5] font-medium">正在生成中…</span>
                    <Button
                      onClick={onTerminateClick}
                      disabled={isTerminating}
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    >
                      <Square size={10} fill="currentColor" className="mr-1" />
                      停止生成
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">图片生成中…</span>
                )}
              </div>
            )}
            {/* 文字图层叠加层 */}
            {activeTool === 'text' && textLayers.length > 0 && textEditToolRef?.current && (
              <TextEditOverlay
                layers={textLayers}
                selectedLayerId={selectedLayerId}
                canvasRef={canvasRef}
                onLayerMouseDown={(e, layer) => {
                  textEditToolRef.current?.handleLayerMouseDown(e, layer);
                }}
                onResizeMouseDown={(e, layer, handle) => {
                  textEditToolRef.current?.handleResizeMouseDown(e, layer, handle);
                }}
                onTextChange={(id, text) => {
                  textEditToolRef.current?.handleTextChange(id, text);
                }}
                onDeleteLayer={(id) => {
                  textEditToolRef.current?.deleteLayer(id);
                }}
                onLayerClick={(id) => {
                  textEditToolRef.current?.selectLayer(id);
                }}
                isDragging={isDragging}
                isResizing={isResizing}
                onApply={onTextApply}
              />
            )}
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
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
              >
                <option value="0.5x">0.5x</option>
                <option value="0.75x">0.75x</option>
                <option value="1.0x">1.0x</option>
                <option value="1.25x">1.25x</option>
                <option value="1.5x">1.5x</option>
                <option value="2.0x">2.0x</option>
              </select>
            </div>
          </div>

          {/* 文字区域 */}
          <div className="p-4">
            <div className="min-h-[80px] text-sm text-slate-700 leading-relaxed bg-slate-50/50 rounded-lg p-3 border border-slate-200">
              {currentPage.text || '暂无文字内容'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default EditorCanvas;
