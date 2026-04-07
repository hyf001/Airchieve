/**
 * 工具面板容器组件 - 管理工具面板的显示和切换
 */

import React from 'react';
import { useToolManager } from '@/hooks/useToolManager';
import { getToolConfig } from './ToolRegistry';
import { ToolComponentProps } from '@/types/tool';
import { ToolSelector } from './ToolSelector';

interface ToolPanelProps {
  storybookId: string | number;
  baseImageUrl: string;
  onPageEdited: (newImageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
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
}) => {
  const { activeTool } = useToolManager();
  const toolConfig = getToolConfig(activeTool);
  const ActiveToolComponent = toolConfig.component;

  // 传递给工具组件的 Props
  const toolProps: ToolComponentProps = {
    storybookId,
    baseImageUrl,
    onPageEdited,
    containerRef,
  };

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
interface ToolPanelWithSelectorProps extends ToolPanelProps {
  showSelector?: boolean;
  selectorColumns?: number;
}

export const ToolPanelWithSelector: React.FC<ToolPanelWithSelectorProps> = ({
  storybookId,
  baseImageUrl,
  onPageEdited,
  containerRef,
  showSelector = true,
  selectorColumns = 4,
}) => {
  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* 工具选择网格 */}
      {showSelector && (
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">图片工具</h3>
          <ToolSelector columns={selectorColumns} />
        </div>
      )}

      {/* 工具面板内容区 */}
      <ToolPanel
        storybookId={storybookId}
        baseImageUrl={baseImageUrl}
        onPageEdited={onPageEdited}
        containerRef={containerRef}
      />
    </div>
  );
};

export default ToolPanel;
