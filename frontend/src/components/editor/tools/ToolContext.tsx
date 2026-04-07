/**
 * 工具状态管理 Context
 */

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { ToolId } from '@/types/tool';

interface ToolContextType {
  activeTool: ToolId;
  setActiveTool: (toolId: ToolId) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export const useToolContext = (): ToolContextType => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useToolContext must be used within ToolProvider');
  }
  return context;
};

interface ToolProviderProps {
  children: ReactNode;
  defaultTool?: ToolId;
}

export const ToolProvider: React.FC<ToolProviderProps> = ({ children, defaultTool = 'ai-edit' }) => {
  const [activeTool, setActiveTool] = React.useState<ToolId>(defaultTool);

  const setActiveToolCallback = useCallback((toolId: ToolId) => {
    console.log('ToolProvider: Switching to tool:', toolId);
    setActiveTool(toolId);
  }, []);

  const value: ToolContextType = {
    activeTool,
    setActiveTool: setActiveToolCallback,
  };

  return (
    <ToolContext.Provider value={value}>
      {children}
    </ToolContext.Provider>
  );
};
