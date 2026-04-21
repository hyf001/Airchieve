/**
 * 工具面板容器组件 - 管理工具面板的显示和切换
 */

import React, { useEffect } from 'react';
import { getToolConfig } from './ToolRegistry';
import { OptionalToolId, ToolComponentProps, ToolId } from '@/types/tool';
import { ToolSelector } from './ToolSelector';
import { StorybookLayer } from '@/services/storybookService';
import { TextLayerViewModel } from './text-edit/types';

interface ToolPanelProps {
  storybookId: string | number;
  baseImageUrl: string;
  onPageEdited: (newImageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  activeTool: ToolId;
  // 文字工具相关 props
  textEditToolRef?: React.RefObject<any>;
  pageId?: number;
  initialLayers?: StorybookLayer[];
  // AI改图工具相关 props
  aiEditToolRef?: React.RefObject<any>;
  onIsAIEditGeneratingChange?: (isGenerating: boolean) => void;
  onTextLayersChange?: (layers: TextLayerViewModel[]) => void;
  onTextSelectedLayerChange?: (layerId: number | null) => void;
  onTextIsDraggingChange?: (isDragging: boolean) => void;
  onTextIsResizingChange?: (isResizing: boolean) => void;
  onLayerPersisted?: () => void;
}

/**
 * 工具面板容器
 * 根据当前激活的工具动态渲染对应的工具组件
 */
export const ToolPanel: React.FC<ToolPanelProps> = ({
  storybookId,
  baseImageUrl,
  onPageEdited,
  containerRef,
  activeTool,
  textEditToolRef,
  pageId,
  initialLayers = [],
  aiEditToolRef,
  onIsAIEditGeneratingChange,
  onTextLayersChange,
  onTextSelectedLayerChange,
  onTextIsDraggingChange,
  onTextIsResizingChange,
  onLayerPersisted,
}) => {

  const toolConfig = getToolConfig(activeTool as any);
  const ActiveToolComponent = toolConfig.component;

  // 当 activeTool 变化时，添加调试日志
  useEffect(() => {
    console.log('ToolPanel: activeTool changed to:', activeTool);
  }, [activeTool]);

  // 根据不同的工具类型，准备不同的 props
  const getToolProps = (): any => {
    const baseProps: ToolComponentProps = {
      storybookId,
      baseImageUrl,
      onPageEdited,
      containerRef,
    };

    // AIEditTool 特殊处理
    if (activeTool === 'ai-edit') {
      return {
        ...baseProps,
        onApply: onPageEdited,
        onIsGeneratingChange: onIsAIEditGeneratingChange,
      };
    }

    // TextEditTool 特殊处理
    if (activeTool === 'text') {
      return {
        pageId: pageId ?? 0,
        initialLayers,
        containerRef,
        onLayersChange: onTextLayersChange,
        onSelectedLayerChange: onTextSelectedLayerChange,
        onIsDraggingChange: onTextIsDraggingChange,
        onIsResizingChange: onTextIsResizingChange,
        onPersisted: onLayerPersisted,
      };
    }

    // DrawTool 特殊处理
    if (activeTool === 'draw') {
      return {
        ...baseProps,
        onApply: onPageEdited,
        containerRef,
      };
    }

    return baseProps;
  };

  const toolProps = getToolProps();

  // 对于需要 ref 的工具，特殊处理
  if (activeTool === 'text' && textEditToolRef) {
    return (
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        <ActiveToolComponent {...toolProps} ref={textEditToolRef} />
      </div>
    );
  }

  if (activeTool === 'ai-edit' && aiEditToolRef) {
    return (
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        <ActiveToolComponent {...toolProps} ref={aiEditToolRef} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
      <ActiveToolComponent {...toolProps} />
    </div>
  );
};

/**
 * 工具面板容器（带工具选择器）
 * 包含工具选择器和工具面板区域
 */
interface ToolPanelWithSelectorProps {
  storybookId: string | number;
  baseImageUrl: string;
  onPageEdited: (newImageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  showSelector?: boolean;
  selectorColumns?: number;
  activeTool: ToolId;
  setActiveTool: (toolId: OptionalToolId) => void;
  // 文字工具相关 props
  textEditToolRef?: React.RefObject<any>;
  pageId?: number;
  initialLayers?: StorybookLayer[];
  // AI改图工具相关 props
  aiEditToolRef?: React.RefObject<any>;
  onIsAIEditGeneratingChange?: (isGenerating: boolean) => void;
  onTextLayersChange?: (layers: TextLayerViewModel[]) => void;
  onTextSelectedLayerChange?: (layerId: number | null) => void;
  onTextIsDraggingChange?: (isDragging: boolean) => void;
  onTextIsResizingChange?: (isResizing: boolean) => void;
  onLayerPersisted?: () => void;
}

export const ToolPanelWithSelector: React.FC<ToolPanelWithSelectorProps> = ({
  storybookId,
  baseImageUrl,
  onPageEdited,
  containerRef,
  showSelector = true,
  selectorColumns = 4,
  activeTool,
  setActiveTool,
  textEditToolRef,
  pageId,
  initialLayers = [],
  aiEditToolRef,
  onIsAIEditGeneratingChange,
  onTextLayersChange,
  onTextSelectedLayerChange,
  onTextIsDraggingChange,
  onTextIsResizingChange,
  onLayerPersisted,
}) => {
  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* 工具选择网格 */}
      {showSelector && (
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">图片工具</h3>
          <ToolSelector
            columns={selectorColumns}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        </div>
      )}

      {/* 工具面板内容区 */}
      <ToolPanel
        storybookId={storybookId}
        baseImageUrl={baseImageUrl}
        onPageEdited={onPageEdited}
        containerRef={containerRef}
        activeTool={activeTool}
        textEditToolRef={textEditToolRef}
        pageId={pageId}
        initialLayers={initialLayers}
        aiEditToolRef={aiEditToolRef}
        onIsAIEditGeneratingChange={onIsAIEditGeneratingChange}
        onTextLayersChange={onTextLayersChange}
        onTextSelectedLayerChange={onTextSelectedLayerChange}
        onTextIsDraggingChange={onTextIsDraggingChange}
        onTextIsResizingChange={onTextIsResizingChange}
        onLayerPersisted={onLayerPersisted}
      />
    </div>
  );
};

export default ToolPanel;
