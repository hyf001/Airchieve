/**
 * 文字工具叠加层组件
 * 在画布上显示可交互的文字图层
 */

import React, { useEffect, useState, useRef } from 'react';
import { TextLayer } from './types';

interface TextEditOverlayProps {
  layers: TextLayer[];
  selectedLayerId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;  // 画布容器，用于限制自动应用范围
  onLayerMouseDown: (e: React.MouseEvent, layer: TextLayer) => void;
  onResizeMouseDown: (e: React.MouseEvent, layer: TextLayer, handle: string) => void;
  onTextChange: (id: string, text: string) => void;
  onDeleteLayer: (id: string) => void;
  onLayerClick: (id: string) => void;
  onApply?: () => void;
}

/**
 * 文字工具叠加层
 */
export const TextEditOverlay: React.FC<TextEditOverlayProps> = ({
  layers,
  selectedLayerId,
  isDragging,
  isResizing,
  canvasRef,
  onLayerMouseDown,
  onResizeMouseDown,
  onTextChange,
  onDeleteLayer,
  onLayerClick,
  onApply,
}) => {
  // 防止重复触发的标记
  const isApplyingRef = useRef(false);

  // 点击画布空白区域自动应用（仅在画布容器内）
  useEffect(() => {
    if (!canvasRef?.current) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (isDragging || isResizing || isApplyingRef.current) return;

      const target = e.target as HTMLElement;

      // 只处理画布容器内的点击
      if (!canvasRef.current!.contains(target)) return;

      const isClickOnLayer = target.closest('[data-text-layer]');

      if (!isClickOnLayer && selectedLayerId && onApply) {
        isApplyingRef.current = true;
        onApply();
        setTimeout(() => {
          isApplyingRef.current = false;
        }, 500);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDragging, isResizing, selectedLayerId, onApply, canvasRef]);
  const resizeHandles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

  const getHandleCursor = (handle: string): string => {
    if (handle === 'nw' || handle === 'se') return 'nwse-resize';
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
    if (handle === 'n' || handle === 's') return 'ns-resize';
    if (handle === 'w' || handle === 'e') return 'ew-resize';
    return 'default';
  };

  const getHandleStyle = (handle: string): React.CSSProperties => {
    const size = 8;
    const offset = -size / 2;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      width: size,
      height: size,
      backgroundColor: isResizing ? '#00b8be' : '#00CDD4',
      border: '1px solid white',
      borderRadius: '1px',
      cursor: getHandleCursor(handle),
      zIndex: 10,
    };

    if (handle.includes('n')) baseStyle.top = offset;
    if (handle.includes('s')) baseStyle.bottom = offset;
    if (handle.includes('w')) baseStyle.left = offset;
    if (handle.includes('e')) baseStyle.right = offset;
    if (handle === 'n' || handle === 's') {
      baseStyle.left = '50%';
      baseStyle.transform = 'translateX(-50%)';
    }
    if (handle === 'w' || handle === 'e') {
      baseStyle.top = '50%';
      baseStyle.transform = 'translateY(-50%)';
    }

    return baseStyle;
  };

  return (
    <>
      {layers.map(layer => {
        const isSelected = selectedLayerId === layer.id;
        return (
          <div
            key={layer.id}
            data-text-layer="true"
            style={{
              position: 'absolute',
              left: layer.x,
              top: layer.y,
              width: layer.width,
              height: layer.height,
              cursor: isDragging && isSelected ? 'grabbing' : 'grab',
              outline: isSelected ? '2px solid #00CDD4' : '2px dashed transparent',
              userSelect: 'none',
            }}
            onMouseDown={(e) => onLayerMouseDown(e, layer)}
            onClick={() => onLayerClick(layer.id)}
          >
            {isSelected ? (
              <textarea
                value={layer.text}
                onChange={(e) => onTextChange(layer.id, e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${layer.fontSize}px`,
                  fontFamily: layer.fontFamily,
                  color: layer.color,
                  fontWeight: layer.bold ? 'bold' : 'normal',
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  textAlign: 'center',
                  cursor: 'text',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `${layer.fontSize}px`,
                  fontFamily: layer.fontFamily,
                  color: layer.color,
                  fontWeight: layer.bold ? 'bold' : 'normal',
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  pointerEvents: 'none',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                }}
              >
                {layer.text}
              </div>
            )}

            {/* 调整大小的手柄 */}
            {isSelected && resizeHandles.map(handle => (
              <div
                key={handle}
                style={getHandleStyle(handle)}
                onMouseDown={(e) => onResizeMouseDown(e, layer, handle)}
              />
            ))}

            {/* 选中时显示删除按钮 */}
            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg"
                style={{ fontSize: '12px', zIndex: 11 }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </>
  );
};

export default TextEditOverlay;
