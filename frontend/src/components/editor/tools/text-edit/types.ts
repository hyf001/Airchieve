/**
 * 文字工具类型定义
 * 对齐后端 Layer API 的 text layer 结构
 */

import React from 'react';
import { StorybookLayer, TextLayerContent } from '@/services/storybookService';

/**
 * 文字图层视图模型（前端编辑用，从 StorybookLayer 转换而来）
 */
export interface TextLayerViewModel {
  id: number;
  pageId: number;
  layerIndex: number;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  textAlign: string;
  lineHeight: number;
  backgroundColor: string;
  borderRadius: number;
  rotation: number;
}

/**
 * StorybookLayer -> TextLayerViewModel 转换
 */
export function toTextLayerViewModel(layer: StorybookLayer): TextLayerViewModel {
  const content = layer.content as TextLayerContent | null;
  return {
    id: layer.id,
    pageId: layer.page_id,
    layerIndex: layer.layer_index,
    visible: layer.visible,
    locked: layer.locked,
    x: content?.x ?? 100,
    y: content?.y ?? 100,
    width: content?.width ?? 300,
    height: content?.height ?? 60,
    text: content?.text ?? '',
    fontFamily: content?.fontFamily ?? '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: content?.fontSize ?? 24,
    fontColor: content?.fontColor ?? '#000000',
    fontWeight: (content?.fontWeight as 'normal' | 'bold') ?? 'normal',
    textAlign: content?.textAlign ?? 'center',
    lineHeight: content?.lineHeight ?? 1.2,
    backgroundColor: content?.backgroundColor ?? '',
    borderRadius: content?.borderRadius ?? 0,
    rotation: content?.rotation ?? 0,
  };
}

/**
 * TextLayerViewModel -> TextLayerContent 转换（用于保存到后端）
 */
export function toTextLayerContent(view: TextLayerViewModel): TextLayerContent {
  return {
    x: view.x,
    y: view.y,
    width: view.width,
    height: view.height,
    text: view.text,
    fontFamily: view.fontFamily,
    fontSize: view.fontSize,
    fontColor: view.fontColor,
    fontWeight: view.fontWeight,
    textAlign: view.textAlign,
    lineHeight: view.lineHeight,
    backgroundColor: view.backgroundColor,
    borderRadius: view.borderRadius,
    rotation: view.rotation,
  };
}

/**
 * 文字工具 Ref 接口
 * 暴露给外部调用的方法
 */
export interface TextEditToolRef {
  getLayers: () => TextLayerViewModel[];
  getSelectedLayerId: () => number | null;
  getIsDragging: () => boolean;
  getIsResizing: () => boolean;
  addLayer: () => Promise<void>;
  updateLayer: (id: number, updates: Partial<TextLayerViewModel>) => void;
  deleteLayer: (id: number) => void;
  selectLayer: (id: number | null) => void;
  handleLayerMouseDown: (e: React.MouseEvent, layer: TextLayerViewModel) => void;
  handleResizeMouseDown: (e: React.MouseEvent, layer: TextLayerViewModel, handle: string) => void;
  handleTextChange: (id: number, text: string) => void;
  commitCurrentEdits: () => void;
}

/**
 * 字体选项
 */
export interface FontOption {
  label: string;
  value: string;
}
