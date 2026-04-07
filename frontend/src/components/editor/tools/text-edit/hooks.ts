/**
 * 文字工具 Hooks
 * 管理文字图层的状态和操作
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { TextLayer, TextEditState } from './types';

/**
 * 文字图层管理 Hook
 */
export const useTextLayers = (initialText?: string) => {
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

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

  // 标记是否已经初始化过（使用 ref 避免组件重新挂载时重置）
  const hasInitializedRef = useRef(false);

  // 当切换到文字工具且当前没有文字图层时，自动添加页面文字
  useEffect(() => {
    // 只在第一次初始化时创建，避免删除后又重新创建
    if (!hasInitializedRef.current && layers.length === 0 && initialText !== undefined) {
      const text = initialText?.trim() || '请输入文字';  // 使用初始文字或默认文字
      const newLayer: TextLayer = {
        id: `text-${Date.now()}`,
        text: text,
        x: 100,  // 调整默认位置
        y: 100,
        width: 300,
        height: 60,
        fontSize: 24,  // 增大默认字体
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        color: '#000000',  // 改为黑色以便在浅色图片上显示
        bold: false,
      };
      console.log('Creating initial text layer:', newLayer);
      setLayers([newLayer]);
      setSelectedLayerId(newLayer.id);
      hasInitializedRef.current = true;  // 标记已初始化
    }
  }, [initialText, layers.length]);

  // 图层操作方法
  const updateLayer = useCallback((id: string, updates: Partial<TextLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const deleteLayer = useCallback((id: string) => {
    console.log('Deleting layer:', id);
    setLayers(prev => prev.filter(l => l.id !== id));
    setSelectedLayerId(null);
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    setSelectedLayerId(id);
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
    updateLayer(id, { text });
  }, [updateLayer]);

  const handleLayerMouseDown = useCallback((e: React.MouseEvent, layer: TextLayer) => {
    e.stopPropagation();
    console.log('Layer mouse down:', layer.id);
    setSelectedLayerId(layer.id);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - layer.x,
      y: e.clientY - layer.y,
    };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, layer: TextLayer, handle: string) => {
    e.stopPropagation();
    console.log('Resize mouse down:', layer.id, 'handle:', handle);
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

  return {
    layers,
    selectedLayerId,
    isDragging,
    isResizing,
    resizeStartRef,  // 返回 ref 对象本身
    resizeHandleRef,  // 返回 ref 对象本身
    dragStartRef,  // 返回 ref 对象本身
    updateLayer,
    deleteLayer,
    selectLayer,
    handleTextChange,
    handleLayerMouseDown,
    handleResizeMouseDown,
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
