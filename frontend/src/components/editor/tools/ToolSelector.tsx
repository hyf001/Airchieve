/**
 * 工具选择器组件 - 显示工具网格选择器
 */

import React from 'react';
import { getAllTools } from './ToolRegistry';
import { ToolId } from '@/types/tool';

interface ToolSelectorProps {
  columns?: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  activeTool: ToolId;
  setActiveTool: (toolId: ToolId) => void;
}

/**
 * 工具选择器组件
 * 显示所有可用工具的网格，点击切换工具
 */
export const ToolSelector: React.FC<ToolSelectorProps> = ({
  columns = 4,
  showLabels = true,
  size = 'sm',
  activeTool,
  setActiveTool,
}) => {
  const tools = getAllTools();

  // 根据列数获取对应的 Tailwind 类名
  const getGridClass = (cols: number): string => {
    switch (cols) {
      case 2: return 'grid grid-cols-2';
      case 3: return 'grid grid-cols-3';
      case 4: return 'grid grid-cols-4';
      case 5: return 'grid grid-cols-5';
      case 6: return 'grid grid-cols-6';
      default: return 'grid grid-cols-4';
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 h-auto text-[9px] gap-0.5',
    md: 'p-2 h-auto text-xs gap-1',
    lg: 'p-3 h-auto text-sm gap-1.5',
  };

  const iconSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`${getGridClass(columns)} gap-2`}>
      {tools.map(tool => {
        const isSelected = activeTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            disabled={tool.disabled}
            title={tool.disabled ? tool.disabledReason : tool.description}
            className={`flex flex-col items-center justify-center rounded-lg transition-all ${
              isSelected
                ? 'bg-[#00CDD4]/15 text-[#00CDD4] ring-2 ring-[#00CDD4]/30 ring-inset'
                : 'text-slate-500 hover:bg-slate-100'
            } ${tool.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${sizeClasses[size]}`}
          >
            <span className={`${iconSizeClasses[size]} ${isSelected ? 'transform scale-110' : ''}`}>
              {tool.icon}
            </span>
            {showLabels && (
              <span className="leading-tight truncate w-full text-center">
                {tool.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ToolSelector;
