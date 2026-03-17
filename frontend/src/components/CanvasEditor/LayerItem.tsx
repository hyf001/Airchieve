import React from 'react';
import { X } from 'lucide-react';
import { CanvasLayer } from './types';

interface LayerItemProps {
  layer: CanvasLayer;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, layerId: string, mode: 'move' | 'resize') => void;
  onDelete: (id: string) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({ layer, isSelected, onPointerDown, onDelete }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
        cursor: 'move',
        outline: isSelected ? '2px solid #00CDD4' : '2px dashed transparent',
        boxSizing: 'border-box',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={e => onPointerDown(e, layer.id, 'move')}
      onClick={e => e.stopPropagation()}
    >
      {layer.type === 'image' && layer.src && (
        <img
          src={layer.src}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
        />
      )}

      {layer.type === 'text' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: layer.fontSize ?? 24,
            fontFamily: layer.fontFamily ?? 'sans-serif',
            color: layer.color ?? '#ffffff',
            fontWeight: layer.bold ? 'bold' : 'normal',
            textShadow: '0 1px 4px rgba(0,0,0,0.85)',
            wordBreak: 'break-word',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            pointerEvents: 'none',
          }}
        >
          {layer.text}
        </div>
      )}

      {isSelected && (
        <>
          {/* Delete */}
          <button
            style={{
              position: 'absolute', top: -12, right: -12,
              width: 22, height: 22,
              background: '#ef4444', border: '2px solid white', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 20,
            }}
            onPointerDown={e => { e.stopPropagation(); onDelete(layer.id); }}
          >
            <X size={11} color="white" />
          </button>

          {/* Resize handle – bottom-right */}
          <div
            style={{
              position: 'absolute', bottom: -7, right: -7,
              width: 14, height: 14,
              background: '#00CDD4', border: '2px solid white', borderRadius: 3,
              cursor: 'se-resize', touchAction: 'none',
            }}
            onPointerDown={e => { e.stopPropagation(); onPointerDown(e, layer.id, 'resize'); }}
          />
        </>
      )}
    </div>
  );
};

export default LayerItem;
