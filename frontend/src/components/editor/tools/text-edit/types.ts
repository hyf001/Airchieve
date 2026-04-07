/**
 * 文字工具类型定义
 */

import React from 'react';

/**
 * 文字图层数据结构
 */
export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
}

/**
 * 文字工具 Ref 接口
 * 暴露给外部调用的方法
 */
export interface TextEditToolRef {
  getLayers: () => TextLayer[];
  getSelectedLayerId: () => string | null;
  getIsDragging: () => boolean;
  getIsResizing: () => boolean;
  updateLayer: (id: string, updates: Partial<TextLayer>) => void;
  deleteLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  handleLayerMouseDown: (e: React.MouseEvent, layer: TextLayer) => void;
  handleResizeMouseDown: (e: React.MouseEvent, layer: TextLayer, handle: string) => void;
  handleTextChange: (id: string, text: string) => void;
}

/**
 * 文字工具状态
 */
export interface TextEditState {
  layers: TextLayer[];
  selectedLayerId: string | null;
  isDragging: boolean;
  isResizing: boolean;
}

/**
 * 字体选项
 */
export interface FontOption {
  label: string;
  value: string;
}
