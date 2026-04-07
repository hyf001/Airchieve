/**
 * 涂鸦工具类型定义
 */

import React from 'react';

/**
 * 笔画点数据结构
 */
export interface StrokePoint {
  x: number;
  y: number;
}

/**
 * 笔画数据结构
 */
export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  size: number;
}

/**
 * 涂鸦工具 Ref 接口
 */
export interface DrawToolRef {
  getStrokes: () => Stroke[];
  getCurrentStroke: () => StrokePoint[] | null;
  getIsDrawing: () => boolean;
  clearStrokes: () => void;
  undoLastStroke: () => void;
  startStroke: (e: React.MouseEvent) => void;
  continueStroke: (e: React.MouseEvent) => void;
  endStroke: () => void;
}

/**
 * 涂鸦工具状态
 */
export interface DrawToolState {
  strokes: Stroke[];
  currentStroke: StrokePoint[] | null;
  isDrawing: boolean;
  brushColor: string;
  brushSize: number;
}
