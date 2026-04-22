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
  pageText?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  onPersisted?: () => void;
}

/**
 * 文字图层管理 Hook
 * - 本地即时更新视图
 * - 离开编辑上下文或交互结束时持久化到后端
 */
export const useTextLayers = ({ pageId, initialLayers, pageText, containerRef, onPersisted }: UseTextLayersParams) => {
  const [layers, setLayers] = useState<TextLayerViewModel[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const layersRef = useRef<TextLayerViewModel[]>([]);
  const selectedLayerIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const persistLayerRef = useRef<((layer: TextLayerViewModel) => Promise<void>) | null>(null);

  // 调整大小的状态
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    layerX: number;
    layerY: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeHandleRef = useRef<string | null>(null);

  // 拖拽的状态
  const dragStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  // 上一次已知 pageId，用于判断切页
  const prevPageIdRef = useRef<number>(pageId);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  // 当 initialLayers 或 pageId 变化时重置本地 state
  useEffect(() => {
    const isPageSwitch = pageId !== prevPageIdRef.current;
    if (isPageSwitch) {
      // 先提交当前选中图层的编辑，避免丢失用户输入
      const id = selectedLayerIdRef.current;
      if (id !== null) {
        const layer = layersRef.current.find(l => l.id === id);
        if (layer) {
          void persistLayer(layer);
        }
      }

      prevPageIdRef.current = pageId;
      setSelectedLayerId(null);
      selectedLayerIdRef.current = null;
      setIsDragging(false);
      setIsResizing(false);
      isDraggingRef.current = false;
      isResizingRef.current = false;
      // 立即清空图层，避免旧页面文字在新页面上短暂显示
      setLayers([]);
      layersRef.current = [];
      return;
    }

    if (isDraggingRef.current || isResizingRef.current) {
      return;
    }

    // 同一页面内 initialLayers 变化时，更新图层
    const textLayers = initialLayers
      .filter(l => l.layer_type === 'text')
      .map(toTextLayerViewModel);
    setLayers(textLayers);
    layersRef.current = textLayers;
  }, [initialLayers, pageId]);

  // 持久化单个图层到后端（直接调用，不防抖）
  const getCanvasSize = useCallback(() => {
    const rect = containerRef?.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return {};
    return {
      canvasWidth: Math.round(rect.width),
      canvasHeight: Math.round(rect.height),
    };
  }, [containerRef]);

  const withCanvasSize = useCallback((layer: TextLayerViewModel): TextLayerViewModel => ({
    ...layer,
    ...getCanvasSize(),
  }), [getCanvasSize]);

  const persistLayer = useCallback(async (layer: TextLayerViewModel) => {
    try {
      const sizedLayer = withCanvasSize(layer);
      await updateLayerAPI(pageId, layer.id, {
        content: toTextLayerContent(sizedLayer) as unknown as Record<string, unknown>,
      });
      onPersisted?.();
    } catch (err) {
      console.error('持久化文字图层失败:', err);
    }
  }, [pageId, onPersisted, withCanvasSize]);

  useEffect(() => {
    persistLayerRef.current = persistLayer;
  }, [persistLayer]);

  useEffect(() => {
    return () => {
      const id = selectedLayerIdRef.current;
      if (id === null) return;
      const layer = layersRef.current.find(l => l.id === id);
      if (layer) {
        void persistLayerRef.current?.(layer);
      }
    };
  }, []);

  const updateLayer = useCallback((id: number, updates: Partial<TextLayerViewModel>) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      layersRef.current = updated;
      return updated;
    });
  }, []);

  const updateLayerLocal = useCallback((id: number, updates: Partial<TextLayerViewModel>) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      layersRef.current = updated;
      return updated;
    });
  }, []);

  const deleteLayer = useCallback(async (id: number) => {
    setLayers(prev => {
      const updated = prev.filter(l => l.id !== id);
      layersRef.current = updated;
      return updated;
    });
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
      selectedLayerIdRef.current = null;
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
      const layer = layersRef.current.find(l => l.id === selectedLayerId);
      if (layer) {
        persistLayer(layer);
      }
    }
    setSelectedLayerId(id);
    selectedLayerIdRef.current = id;
  }, [selectedLayerId, persistLayer]);

  // 提交当前选中图层的编辑（供外部在切工具/切页/卸载时调用）
  const commitCurrentEdits = useCallback(async () => {
    const id = selectedLayerIdRef.current;
    if (id === null) return;
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) {
      await persistLayer(layer);
    }
    setSelectedLayerId(null);
    selectedLayerIdRef.current = null;
  }, [persistLayer]);

  const handleTextChange = useCallback((id: number, text: string) => {
    // 仅更新本地状态，不持久化（等取消选中时再持久化）
    setLayers(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, text } : l);
      layersRef.current = updated;
      return updated;
    });
  }, []);

  // 新增文字图层
  const addLayer = useCallback(async () => {
    if (isAdding) return;
    // 先提交当前选中图层的编辑，避免 refreshCurrentPage 冲掉未保存的本地修改
    void commitCurrentEdits();
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
          text: pageText || '请输入文字',
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: 24,
          fontColor: '#000000',
          fontWeight: 'normal',
          textAlign: 'center',
          lineHeight: 1.2,
          backgroundColor: '',
          borderRadius: 0,
          rotation: 0,
          ...getCanvasSize(),
        },
      });
      const viewModel = toTextLayerViewModel(newLayer);
      setLayers(prev => {
        const updated = [...prev, viewModel];
        layersRef.current = updated;
        return updated;
      });
      setSelectedLayerId(viewModel.id);
      selectedLayerIdRef.current = viewModel.id;
      onPersisted?.();
    } catch (err) {
      console.error('创建文字图层失败:', err);
    } finally {
      setIsAdding(false);
    }
  }, [pageId, layers, isAdding, commitCurrentEdits, onPersisted, pageText, getCanvasSize]);

  // 拖拽开始
  const handleLayerMouseDown = useCallback((e: React.MouseEvent, layer: TextLayerViewModel) => {
    e.stopPropagation();
    if (selectedLayerId !== null && selectedLayerId !== layer.id) {
      const previousLayer = layersRef.current.find(l => l.id === selectedLayerId);
      if (previousLayer) {
        persistLayer(previousLayer);
      }
    }
    setSelectedLayerId(layer.id);
    selectedLayerIdRef.current = layer.id;
    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - layer.x,
      y: e.clientY - layer.y,
    };
  }, [selectedLayerId, persistLayer]);

  // 缩放开始
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, layer: TextLayerViewModel, handle: string) => {
    e.stopPropagation();
    if (selectedLayerId !== null && selectedLayerId !== layer.id) {
      const previousLayer = layersRef.current.find(l => l.id === selectedLayerId);
      if (previousLayer) {
        persistLayer(previousLayer);
      }
    }
    setSelectedLayerId(layer.id);
    selectedLayerIdRef.current = layer.id;
    setIsResizing(true);
    isResizingRef.current = true;
    resizeHandleRef.current = handle;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      layerX: layer.x,
      layerY: layer.y,
      width: layer.width,
      height: layer.height,
    };
  }, [selectedLayerId, persistLayer]);

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
    layersRef,
    isDraggingRef,
    isResizingRef,
    addLayer,
    updateLayer,
    updateLayerLocal,
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
