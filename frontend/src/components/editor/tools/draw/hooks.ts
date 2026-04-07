/**
 * 涂鸦工具 Hooks
 * 管理笔画的状态和操作
 */

import { useState, useCallback, useEffect } from 'react';
import { Stroke, StrokePoint } from './types';

/**
 * 笔画管理 Hook
 */
export const useDrawStrokes = (baseImageUrl: string) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 笔刷设置
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(8);

  // 当 baseImageUrl 变化时重置状态
  useEffect(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, [baseImageUrl]);

  // 开始绘制
  const startStroke = useCallback((e: React.MouseEvent) => {
    const point = { x: e.clientX, y: e.clientY };
    setCurrentStroke([point]);
    setIsDrawing(true);
  }, []);

  // 继续绘制
  const continueStroke = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentStroke) return;
    const point = { x: e.clientX, y: e.clientY };
    setCurrentStroke([...currentStroke, point]);
  }, [isDrawing, currentStroke]);

  // 结束绘制
  const endStroke = useCallback(() => {
    if (!currentStroke || currentStroke.length === 0) return;

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}`,
      points: currentStroke,
      color: brushColor,
      size: brushSize,
    };

    setStrokes(prev => [...prev, newStroke]);
    setCurrentStroke(null);
    setIsDrawing(false);
  }, [currentStroke, brushColor, brushSize]);

  // 清空所有笔画
  const clearStrokes = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  // 撤销最后一笔
  const undoLastStroke = useCallback(() => {
    setStrokes(prev => prev.slice(0, -1));
  }, []);

  return {
    strokes,
    currentStroke,
    isDrawing,
    brushColor,
    brushSize,
    setBrushColor,
    setBrushSize,
    startStroke,
    continueStroke,
    endStroke,
    clearStrokes,
    undoLastStroke,
  };
};

/**
 * 涂鸦工具常量
 */
export const COLOR_PRESETS = [
  '#ffffff', '#000000', '#FF0000', '#FF6B6B', '#FFA500', '#FFD700',
  '#FFFF00', '#00FF00', '#00CDD4', '#0000FF', '#8B5CF6', '#FF1493',
  '#8B4513', '#A52A2A', '#808080', '#FFC0CB',
];

export const BRUSH_SIZES = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32];
