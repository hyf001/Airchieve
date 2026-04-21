/**
 * 编辑器画布组件 - 主要内容区域
 */

import React, { useState } from 'react';
import { AlertCircle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProgressCaterpillar from '@/components/ProgressCaterpillar';
import { getAspectRatioClass } from '@/utils/editorUtils';
import { STATUS_TEXT_MAP } from '@/constants/editor';
import { Storybook, StorybookLayer, TextLayerContent, DrawLayerContent, ImageLayerContent } from '@/services/storybookService';
import { TextEditOverlay } from './tools/text-edit/Overlay';
import { TextEditToolRef, TextLayerViewModel } from './tools/text-edit/types';
import { AIEditOverlay } from './tools/ai-edit/Overlay';
import { AIEditRef } from './tools/ai-edit/types';
import { ToolId } from '@/types/tool';

/**
 * 图层预览组件 - 在画布上只读渲染所有可见图层
 * 当 text tool 激活时跳过 text 图层（由 TextEditOverlay 负责渲染，避免重影）
 */
const LayersPreview: React.FC<{ layers: StorybookLayer[]; activeTool?: ToolId }> = ({ layers, activeTool }) => {
  const visibleLayers = layers
    .filter(l => l.visible && l.content)
    // text tool 激活时，text 图层由 TextEditOverlay 渲染，这里跳过避免重影
    .filter(l => !(activeTool === 'text' && l.layer_type === 'text'))
    .sort((a, b) => a.layer_index - b.layer_index);

  if (visibleLayers.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      {visibleLayers.map(layer => {
        if (!layer.content) return null;

        switch (layer.layer_type) {
          case 'text': {
            const c = layer.content as TextLayerContent;
            return (
              <div
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: c.x,
                  top: c.y,
                  width: c.width,
                  height: c.height,
                  fontSize: `${c.fontSize}px`,
                  fontFamily: c.fontFamily,
                  color: c.fontColor,
                  fontWeight: c.fontWeight,
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  textAlign: c.textAlign as CanvasTextAlign,
                  lineHeight: c.lineHeight,
                  background: c.backgroundColor || 'transparent',
                  borderRadius: `${c.borderRadius}px`,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c.text}
              </div>
            );
          }

          case 'draw': {
            const c = layer.content as DrawLayerContent;
            const strokes = c.strokes ?? [];
            if (strokes.length === 0) return null;
            return (
              <svg
                key={layer.id}
                className="absolute inset-0 w-full h-full"
              >
                {strokes.map((stroke, si) => {
                  const points = stroke.points ?? [];
                  if (points.length === 0) return null;
                  if (points.length === 1) {
                    return (
                      <circle
                        key={si}
                        cx={points[0][0]}
                        cy={points[0][1]}
                        r={stroke.brushSize / 2}
                        fill={stroke.color}
                      />
                    );
                  }
                  const pathData = points.reduce((acc, p, i) =>
                    i === 0 ? `M ${p[0]} ${p[1]}` : `${acc} L ${p[0]} ${p[1]}`, '');
                  return (
                    <path
                      key={si}
                      d={pathData}
                      stroke={stroke.color}
                      strokeWidth={stroke.brushSize}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}
              </svg>
            );
          }

          case 'image': {
            const c = layer.content as ImageLayerContent;
            return (
              <img
                key={layer.id}
                src={c.url}
                alt=""
                style={{
                  position: 'absolute',
                  left: c.x,
                  top: c.y,
                  width: c.width,
                  height: c.height,
                  opacity: c.opacity ?? 1,
                  transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined,
                }}
                className="object-contain"
                draggable={false}
              />
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};

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
  textLayers?: TextLayerViewModel[];
  selectedLayerId?: number | null;
  isDragging?: boolean;
  isResizing?: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
  // AI改图工具相关 props
  aiEditToolRef?: React.RefObject<AIEditRef>;
  isAIEditGenerating?: boolean;
  // 图层数据
  pageLayers?: StorybookLayer[];
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
  aiEditToolRef,
  isAIEditGenerating = false,
  pageLayers = [],
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
          aiEditToolRef,
          isAIEditGenerating,
          pageLayers,
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
  textLayers?: TextLayerViewModel[];
  selectedLayerId?: number | null;
  isDragging?: boolean;
  isResizing?: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
  aiEditToolRef?: React.RefObject<AIEditRef>;
  isAIEditGenerating?: boolean;
  pageLayers?: StorybookLayer[];
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
  aiEditToolRef,
  isAIEditGenerating = false,
  pageLayers = [],
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
            onMouseDown={(e) => {
              // 点击画布空白区域时，取消选中文字图层
              if (activeTool === 'text' && selectedLayerId !== null) {
                const target = e.target as HTMLElement;
                if (!target.closest('[data-text-layer]')) {
                  textEditToolRef?.current?.selectLayer(null);
                }
              }
            }}
          >
            {currentPage.image_url ? (
              <img
                src={currentPage.image_url}
                alt={`第 ${currentPageIndex + 1} 页`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                {isCreating ? (
                  <>
                    <Loader2 size={36} className="text-[#00CDD4] animate-spin" />
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
                  <span className="text-sm text-slate-400">该页图片未生成</span>
                )}
              </div>
            )}
            {/* 图层预览 - 始终显示所有可见图层 */}
            <LayersPreview layers={pageLayers} activeTool={activeTool} />
            {/* 文字图层叠加层 */}
            {activeTool === 'text' && textLayers.length > 0 && textEditToolRef?.current && (
              <TextEditOverlay
                layers={textLayers.filter(layer => layer.pageId === currentPage.id)}
                selectedLayerId={selectedLayerId}
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
              />
            )}
            {/* AI改图叠加层 */}
            {activeTool === 'ai-edit' && (
              <AIEditOverlay isGenerating={isAIEditGenerating} />
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
