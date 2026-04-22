/**
 * 编辑器状态管理 Hook
 * 统一管理 EditorView 的所有状态
 */

import { useState, useCallback } from 'react';
import { Storybook, StorybookListItem } from '@/services/storybookService';

/**
 * 对话框状态
 */
interface DialogStates {
  insertPage: boolean;
  cover: boolean;
  backCover: boolean;
  export: boolean;
  terminate: boolean;
  deleteConfirm: number | null;
}

/**
 * 导出状态
 */
interface ExportState {
  isExporting: boolean;
  progress: number;
}

/**
 * 编辑器完整状态
 */
interface EditorState {
  // 绘本相关
  currentStorybook: Storybook | null;
  storybookList: StorybookListItem[];

  // UI 状态
  currentPageIndex: number;
  loading: boolean;
  error: string | null;

  // 导出状态
  export: ExportState;

  // 对话框状态
  dialogs: DialogStates;

  // 操作状态
  isTerminating: boolean;
}

/**
 * 初始状态
 */
const initialState: EditorState = {
  currentStorybook: null,
  storybookList: [],
  currentPageIndex: 0,
  loading: true,
  error: null,
  export: {
    isExporting: false,
    progress: 0,
  },
  dialogs: {
    insertPage: false,
    cover: false,
    backCover: false,
    export: false,
    terminate: false,
    deleteConfirm: null,
  },
  isTerminating: false,
};

/**
 * 编辑器状态管理 Hook
 */
export function useEditorState() {
  const [state, setState] = useState<EditorState>(initialState);

  // ========== 绘本状态 ==========
  const setCurrentStorybook = useCallback((storybook: Storybook | null) => {
    setState(prev => ({ ...prev, currentStorybook: storybook }));
  }, []);

  const setStorybookList = useCallback((list: StorybookListItem[]) => {
    setState(prev => ({ ...prev, storybookList: list }));
  }, []);

  const updateStorybookInList = useCallback((id: number, updates: Partial<StorybookListItem>) => {
    setState(prev => ({
      ...prev,
      storybookList: prev.storybookList.map(book =>
        book.id === id ? { ...book, ...updates } : book
      ),
      currentStorybook: prev.currentStorybook?.id === id
        ? { ...prev.currentStorybook, ...updates }
        : prev.currentStorybook,
    }));
  }, []);

  // ========== 页面状态 ==========
  const setCurrentPageIndex = useCallback((index: number) => {
    setState(prev => ({ ...prev, currentPageIndex: index }));
  }, []);

  // ========== 加载和错误状态 ==========
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // ========== 导出状态 ==========
  const setExportState = useCallback((updates: Partial<ExportState>) => {
    setState(prev => ({
      ...prev,
      export: { ...prev.export, ...updates },
    }));
  }, []);

  // ========== 对话框状态 ==========
  const setDialogState = useCallback((dialog: keyof DialogStates, value: boolean | number | null) => {
    setState(prev => ({
      ...prev,
      dialogs: { ...prev.dialogs, [dialog]: value },
    }));
  }, []);

  // ========== 操作状态 ==========
  const setIsTerminating = useCallback((isTerminating: boolean) => {
    setState(prev => ({ ...prev, isTerminating }));
  }, []);

  // ========== 计算属性 ==========
  const pages = state.currentStorybook?.pages || [];
  const isCreating = state.currentStorybook?.status === 'creating' ||
                     state.currentStorybook?.status === 'updating';
  const canReadPages = pages.length > 0;

  return {
    // 状态
    state,

    // 绘本状态
    currentStorybook: state.currentStorybook,
    storybookList: state.storybookList,
    setCurrentStorybook,
    setStorybookList,
    updateStorybookInList,

    // 页面状态
    currentPageIndex: state.currentPageIndex,
    pages,
    isCreating,
    canReadPages,
    setCurrentPageIndex,

    // 加载和错误状态
    loading: state.loading,
    error: state.error,
    setLoading,
    setError,

    // 导出状态
    export: state.export,
    setExportState,

    // 对话框状态
    dialogs: state.dialogs,
    setDialogState,

    // 操作状态
    isTerminating: state.isTerminating,
    setIsTerminating,
  };
}

/**
 * 类型导出
 */
export type UseEditorStateReturn = ReturnType<typeof useEditorState>;
