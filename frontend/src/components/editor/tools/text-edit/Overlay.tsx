/**
 * 文字工具叠加层组件
 * 在画布上显示可交互的文字图层
 * 基于 TextLayerViewModel 渲染
 */

import React from 'react';
import { TextLayerViewModel } from './types';

interface TextEditOverlayProps {
  layers: TextLayerViewModel[];
  selectedLayerId: number | null;
  isDragging: boolean;
  isResizing: boolean;
  onLayerMouseDown: (e: React.MouseEvent, layer: TextLayerViewModel) => void;
  onResizeMouseDown: (e: React.MouseEvent, layer: TextLayerViewModel, handle: string) => void;
  onTextChange: (id: number, text: string) => void;
  onDeleteLayer: (id: number) => void;
  onLayerClick: (id: number) => void;
}

/**
 * 文字工具叠加层
 */
export const TextEditOverlay: React.FC<TextEditOverlayProps> = ({
  layers,
  selectedLayerId,
  isDragging,
  isResizing,
  onLayerMouseDown,
  onResizeMouseDown,
  onTextChange,
  onDeleteLayer,
  onLayerClick,
}) => {
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
                  color: layer.fontColor,
                  fontWeight: layer.fontWeight,
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  background: layer.backgroundColor || 'transparent',
                  borderRadius: `${layer.borderRadius}px`,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  textAlign: layer.textAlign as CanvasTextAlign,
                  lineHeight: layer.lineHeight,
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
                  color: layer.fontColor,
                  fontWeight: layer.fontWeight,
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  textAlign: layer.textAlign as CanvasTextAlign,
                  lineHeight: layer.lineHeight,
                  background: layer.backgroundColor || 'transparent',
                  borderRadius: `${layer.borderRadius}px`,
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
