/**
 * 文字工具 Hooks
 * 管理文字图层的状态和操作，支持本地编辑 + 后端持久化
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { StorybookLayer, createLayer as createLayerAPI, updateLayer as updateLayerAPI, deleteLayer as deleteLayerAPI } from '@/services/storybookService';
import { TextLayerViewModel, toTextLayerViewModel, toTextLayerContent } from './types';

interface UseTextLayersParams {
  pageId: number;
  initialLayers: StorybookLayer[];
  onPersisted?: () => void;
}

/**
 * 文字图层管理 Hook
 * - 本地即时更新视图
 * - 防抖/事件驱动持久化到后端
 */
export const useTextLayers = ({ pageId, initialLayers, onPersisted }: UseTextLayersParams) => {
  const [layers, setLayers] = useState<TextLayerViewModel[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // 调整大小的状态
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeHandleRef = useRef<string | null>(null);

  // 拖拽的状态
  const dragStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  // 防抖定时器
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 上一次已知 pageId，用于判断切页
  const prevPageIdRef = useRef<number>(pageId);

  // 刷新防抖：切页或卸载��立即提交
  const flushDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // 卸载时清除防抖
  useEffect(() => {
    return () => {
      flushDebounce();
    };
  }, [flushDebounce]);

  // 当 initialLayers 或 pageId 变化时重置本地 state
  useEffect(() => {
    const isPageSwitch = pageId !== prevPageIdRef.current;
    if (isPageSwitch) {
      // 切页：先 flush，再重置所有状态
      flushDebounce();
      prevPageIdRef.current = pageId;
      setSelectedLayerId(null);
      setIsDragging(false);
      setIsResizing(false);
      // 立即清空图层，避免旧页面文字在新页面上短暂显示
      setLayers([]);
      return;
    }

    // 同一页面内 initialLayers 变化时，更新图层
    const textLayers = initialLayers
      .filter(l => l.layer_type === 'text')
      .map(toTextLayerViewModel);
    setLayers(textLayers);
  }, [initialLayers, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 持久化单个图层到后端（直接调用，不防抖）
  const persistLayer = useCallback(async (layer: TextLayerViewModel) => {
    try {
      await updateLayerAPI(pageId, layer.id, {
        content: toTextLayerContent(layer) as unknown as Record<string, unknown>,
      });
      onPersisted?.();
    } catch (err) {
      console.error('持久化文字图层失败:', err);
    }
  }, [pageId, onPersisted]);

  // 防抖持久化
  const debouncedPersist = useCallback((layer: TextLayerViewModel, delay = 300) => {
    flushDebounce();
    debounceTimerRef.current = setTimeout(() => {
      persistLayer(layer);
    }, delay);
  }, [flushDebounce, persistLayer]);

  // 图层操作方法
  const updateLayer = useCallback((id: number, updates: Partial<TextLayerViewModel>) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      const changed = updated.find(l => l.id === id);
      if (changed) {
        // 判断是否需要防抖（文字输入）还是立即持久化（属性变更）
        if ('text' in updates && Object.keys(updates).length === 1) {
          debouncedPersist(changed);
        } else {
          // 属性变更立即持久化
          persistLayer(changed);
        }
      }
      return updated;
    });
  }, [debouncedPersist, persistLayer]);

  const deleteLayer = useCallback(async (id: number) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
    }
    try {
      await deleteLayerAPI(pageId, id);
      onPersisted?.();
    } catch (err) {
      console.error('删除文字图层失败:', err);
    }
  }, [pageId, selectedLayerId, onPersisted]);

  const selectLayer = useCallback((id: number | null) => {
    // 切换图层前，先提交当前选中的图层
    if (selectedLayerId !== null && id !== selectedLayerId) {
      flushDebounce();
      setLayers(prev => {
        const layer = prev.find(l => l.id === selectedLayerId);
        if (layer) {
          persistLayer(layer);
        }
        return prev;
      });
    }
    setSelectedLayerId(id);
  }, [selectedLayerId, flushDebounce, persistLayer]);

  // 提交当前选中图层的编辑（供外部在切工具/切页/卸载时调用）
  const commitCurrentEdits = useCallback(() => {
    flushDebounce();
    setLayers(prev => {
      if (selectedLayerId === null) return prev;
      const layer = prev.find(l => l.id === selectedLayerId);
      if (layer) {
        persistLayer(layer);
      }
      return prev;
    });
  }, [selectedLayerId, flushDebounce, persistLayer]);

  // 组件卸载前提交
  useEffect(() => {
    return () => {
      flushDebounce();
    };
  }, [flushDebounce]);

  const handleTextChange = useCallback((id: number, text: string) => {
    // 仅更新本地状态，不持久化（等取消选中时再持久化）
    setLayers(prev => prev.map(l => l.id === id ? { ...l, text } : l));
  }, []);

  // 新增文字图层
  const addLayer = useCallback(async () => {
    if (isAdding) return;
    // 先提交当前选中图层的编辑，避免 refreshCurrentPage 冲掉未保存的本地修改
    commitCurrentEdits();
    setIsAdding(true);
    try {
      const newLayer = await createLayerAPI(pageId, {
        layer_type: 'text',
        layer_index: layers.length,
        content: {
          x: 100,
          y: 100,
          width: 300,
          height: 60,
          text: '请输入文字',
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: 24,
          fontColor: '#000000',
          fontWeight: 'normal',
          textAlign: 'center',
          lineHeight: 1.2,
          backgroundColor: '',
          borderRadius: 0,
          rotation: 0,
        },
      });
      const viewModel = toTextLayerViewModel(newLayer);
      setLayers(prev => [...prev, viewModel]);
      setSelectedLayerId(viewModel.id);
      onPersisted?.();
    } catch (err) {
      console.error('创建文字图层失败:', err);
    } finally {
      setIsAdding(false);
    }
  }, [pageId, layers, isAdding, commitCurrentEdits, onPersisted]);

  // 拖拽开始
  const handleLayerMouseDown = useCallback((e: React.MouseEvent, layer: TextLayerViewModel) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - layer.x,
      y: e.clientY - layer.y,
    };
  }, []);

  // 缩放开始
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, layer: TextLayerViewModel, handle: string) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    setIsResizing(true);
    resizeHandleRef.current = handle;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: layer.width,
      height: layer.height,
    };
  }, []);

  // 拖拽/缩放结束后持久化
  const handleInteractionEnd = useCallback((updatedLayer: TextLayerViewModel) => {
    persistLayer(updatedLayer);
  }, [persistLayer]);

  return {
    layers,
    selectedLayerId,
    isDragging,
    isResizing,
    isAdding,
    resizeStartRef,
    resizeHandleRef,
    dragStartRef,
    addLayer,
    updateLayer,
    deleteLayer,
    selectLayer,
    handleTextChange,
    handleLayerMouseDown,
    handleResizeMouseDown,
    handleInteractionEnd,
    commitCurrentEdits,
    setIsDragging,
    setIsResizing,
  };
};

/**
 * 文字工具常量
 */
export const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '黑体', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"Songti SC", "SimSun", serif' },
  { label: '楷体', value: '"KaiTi", "STKaiti", serif' },
  { label: '圆体', value: '"YouYuan", "STYuanti", "Rounded Mplus 1c", sans-serif' },
  { label: '手写体', value: '"Xingkai SC", "STXingkai", "Huawen Xingkai", "cursive", serif' },
];

export const COLOR_PRESETS = [
  '#ffffff', '#000000', '#FF0000', '#FF6B6B', '#FFA500', '#FFD700',
  '#FFFF00', '#00FF00', '#00CDD4', '#0000FF', '#8B5CF6', '#FF1493',
];
