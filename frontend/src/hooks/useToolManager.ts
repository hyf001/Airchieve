/**
 * 工具管理 Hook - 管理工具栏状态和工具切换
 */

import { useState, useCallback, useRef } from 'react';
import { ToolId, ToolState, ToolActions } from '@/types/tool';

const DEFAULT_ACTIVE_TOOL: ToolId = 'ai-edit';
const MAX_HISTORY_SIZE = 20;

/**
 * 工具管理 Hook
 * 提供工具切换、状态管理、历史记录等功能
 */
export function useToolManager(initialTool?: ToolId) {
  // 当前激活的工具
  const [activeTool, setActiveTool] = useState<ToolId>(initialTool || DEFAULT_ACTIVE_TOOL);

  // 工具使用历史（用于前进/后退）
  const [toolHistory, setToolHistory] = useState<ToolId[]>([initialTool || DEFAULT_ACTIVE_TOOL]);

  // 各工具的独立状态存储
  const [toolStates, setToolStates] = useState<Record<ToolId, any>>({});

  // 历史记录索引（用于前进/后退）
  const historyIndexRef = useRef(0);

  /**
   * 切换到指定工具
   */
  const switchToTool = useCallback((toolId: ToolId) => {
    setActiveTool(toolId);

    setToolHistory(prev => {
      const newHistory = [...prev];

      // 如果在历史记录中间位置，清除后面的记录
      if (historyIndexRef.current < newHistory.length - 1) {
        newHistory.splice(historyIndexRef.current + 1);
      }

      // 添加新工具到历史
      newHistory.push(toolId);

      // 限制历史记录大小
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      } else {
        historyIndexRef.current = newHistory.length - 1;
      }

      return newHistory;
    });
  }, []);

  /**
   * 设置指定工具的状态
   */
  const setToolState = useCallback((toolId: ToolId, state: any) => {
    setToolStates(prev => ({
      ...prev,
      [toolId]: state,
    }));
  }, []);

  /**
   * 获取指定工具的状态
   */
  const getToolState = useCallback((toolId: ToolId) => {
    return toolStates[toolId];
  }, [toolStates]);

  /**
   * 更新指定工具的部分状态
   */
  const updateToolState = useCallback((toolId: ToolId, updates: Partial<any>) => {
    setToolStates(prev => ({
      ...prev,
      [toolId]: {
        ...prev[toolId],
        ...updates,
      },
    }));
  }, []);

  /**
   * 重置指定工具的状态
   */
  const resetTool = useCallback((toolId: ToolId) => {
    setToolStates(prev => {
      const newStates = { ...prev };
      delete newStates[toolId];
      return newStates;
    });
  }, []);

  /**
   * 返回���一个工具
   */
  const previousTool = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevTool = toolHistory[historyIndexRef.current];
      setActiveTool(prevTool);
      return prevTool;
    }
    return activeTool;
  }, [toolHistory, activeTool]);

  /**
   * 返回下一个工具（如果历史记录中有）
   */
  const nextTool = useCallback(() => {
    if (historyIndexRef.current < toolHistory.length - 1) {
      historyIndexRef.current += 1;
      const nextTool = toolHistory[historyIndexRef.current];
      setActiveTool(nextTool);
      return nextTool;
    }
    return activeTool;
  }, [toolHistory, activeTool]);

  /**
   * 清空所有工具状态
   */
  const clearAllToolStates = useCallback(() => {
    setToolStates({});
  }, []);

  /**
   * 获取当前工具状态
   */
  const getCurrentToolState = useCallback(() => {
    return toolStates[activeTool];
  }, [toolStates, activeTool]);

  return {
    // 状态
    activeTool,
    toolHistory,
    toolStates,

    // 操作方法
    setActiveTool: switchToTool,
    setToolState,
    getToolState,
    updateToolState,
    resetTool,
    previousTool,
    nextTool,
    clearAllToolStates,
    getCurrentToolState,
  };
}

/**
 * 类型安全的工具管理 Hook 导出
 */
export type UseToolManagerReturn = ReturnType<typeof useToolManager>;
