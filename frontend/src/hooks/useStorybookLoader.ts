/**
 * 绘本加载逻辑 Hook
 * 处理绘本列表和单个绘本的加载
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getStorybook,
  listStorybooks,
  Storybook,
  StorybookListItem,
} from '@/services/storybookService';
import { UseEditorStateReturn } from './useEditorState';
import { usePolling } from './usePolling';
import { useToast } from '@/hooks/use-toast';

const TERMINAL_STATUSES = new Set(['finished', 'error', 'terminated']);

interface UseStorybookLoaderProps extends Pick<UseEditorStateReturn,
  'setCurrentStorybook' |
  'setStorybookList' |
  'updateStorybookInList' |
  'setCurrentPageIndex' |
  'setLoading' |
  'setError'
> {}

/**
 * 绘本加载 Hook
 * 处理绘本列表加载、单个绘本加载、轮询等逻辑
 */
export function useStorybookLoader({
  setCurrentStorybook,
  setStorybookList,
  updateStorybookInList,
  setCurrentPageIndex,
  setLoading,
  setError,
}: UseStorybookLoaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const prevPagesLengthRef = useRef<number>(0);
  const prevCompletedSetRef = useRef<Set<number>>(new Set());

  // ========== 轮询配置 ==========
  const handlePollResult = useCallback((book: Storybook) => {
    const pages = book.pages ?? [];
    const newCount = pages.length;
    if (newCount > prevPagesLengthRef.current) {
      toast({ title: `第 ${newCount} 页已生成 ✓` });
      setCurrentPageIndex(newCount - 1);
    } else {
      // 检测已有页面是否新完成（获得了图片）
      let newCompletedIndex = -1;
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i].image_url && !prevCompletedSetRef.current.has(i)) {
          newCompletedIndex = i;
          break;
        }
      }
      if (newCompletedIndex >= 0) {
        setCurrentPageIndex(newCompletedIndex);
      }
    }
    prevPagesLengthRef.current = newCount;
    // 记录当前已完成（有图片）的页面
    prevCompletedSetRef.current = new Set(
      pages.map((p, i) => (p.image_url ? i : -1)).filter(i => i >= 0)
    );
    setCurrentStorybook(book);
    updateStorybookInList(book.id, { status: book.status });

    if (book.status === 'error' && book.error_message) {
      toast({ title: '生成失败', description: book.error_message, variant: 'destructive' });
    }

    return { stop: TERMINAL_STATUSES.has(book.status) };
  }, [setCurrentStorybook, updateStorybookInList, setCurrentPageIndex, toast]);

  const { start: startPolling, stop: stopPolling } = usePolling(getStorybook, handlePollResult);

  // ========== 加载绘本列表 ==========
  const loadStorybookList = useCallback(async () => {
    try {
      const list = await listStorybooks({
        creator: user ? String(user.id) : undefined,
        limit: 20,
      });
      setStorybookList(list);
      return list;
    } catch {
      return [];
    }
  }, [user, setStorybookList]);

  // ========== 加载单个绘本 ==========
  const loadStorybook = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setCurrentPageIndex(0);

    try {
      const book = await getStorybook(id);
      prevPagesLengthRef.current = book.pages?.length ?? 0;
      prevCompletedSetRef.current = new Set(
        (book.pages ?? []).map((p, i) => (p.image_url ? i : -1)).filter(i => i >= 0)
      );
      setCurrentStorybook(book);
      updateStorybookInList(id, { status: book.status });

      // 如果绘本未完成，开始轮询
      if (!TERMINAL_STATUSES.has(book.status)) {
        startPolling(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载绘本失败');
    } finally {
      setLoading(false);
    }
  }, [
    setLoading,
    setError,
    setCurrentPageIndex,
    setCurrentStorybook,
    updateStorybookInList,
    startPolling,
  ]);

  // ========== 初始化加载 ==========
  useEffect(() => {
    const initialize = async () => {
      const list = await loadStorybookList();
      if (list.length > 0) {
        await loadStorybook(list[0].id);
      } else {
        setLoading(false);
      }
    };

    initialize();
  }, []); // 只在组件挂载时执行一次

  return {
    loadStorybookList,
    loadStorybook,
    startPolling,
    stopPolling,
  };
}

/**
 * 带参数的初始化加载 Hook
 * 用于需要根据 storybookId 参数加载的场景
 */
export function useStorybookLoaderWithId(
  storybookId: number | undefined,
  loader: ReturnType<typeof useStorybookLoader>
) {
  const { loadStorybookList, loadStorybook, stopPolling } = loader;

  useEffect(() => {
    const initialize = async () => {
      const list = await loadStorybookList();

      if (storybookId) {
        await loadStorybook(storybookId);
      } else if (list.length > 0) {
        await loadStorybook(list[0].id);
      }
    };

    initialize();
  }, [storybookId]); // 当 storybookId 变化时重新加载

  // 当 storybookId 变化时，停止旧的轮询并加载新的绘本
  useEffect(() => {
    if (storybookId) {
      stopPolling();
      loadStorybook(storybookId);
    }
  }, [storybookId, stopPolling, loadStorybook]);
}
