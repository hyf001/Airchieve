/**
 * 编辑器工具栏 - 简化版
 * 每个工具独立管理自己的状态，通过 ref 暴露方法
 */

import React, { useRef, useState } from 'react';
import { ToolId } from '@/types/tool';
import { ToolSelector } from './ToolSelector';
import { TOOL_REGISTRY } from './ToolRegistry';
import { ToolComponentProps } from '@/types/tool';

interface EditorToolbarProps {
  storybookId: string | number;
  baseImageUrl: string;
  onPageEdited: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * 编辑器工具栏组件
 * 包含工具选择器和工具面板
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  storybookId,
  baseImageUrl,
  onPageEdited,
  containerRef,
}) => {
  const [activeTool, setActiveTool] = React.useState<ToolId>('ai-edit');

  // 获取当前工具的配置
  const toolConfig = TOOL_REGISTRY[activeTool];
  const ActiveToolComponent = toolConfig.component;

  // 准备传递给工具组件的 props
  const toolProps: ToolComponentProps = {
    storybookId,
    baseImageUrl,
    onPageEdited,
    containerRef,
  };

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* 工具选择器 */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">图片工具</h3>
        <ToolSelector
          activeTool={activeTool}
          setActiveTool={setActiveTool}
        />
      </div>

      {/* 工具面板 */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        <ActiveToolComponent {...toolProps} />
      </div>
    </div>
  );
};

export default EditorToolbar;
