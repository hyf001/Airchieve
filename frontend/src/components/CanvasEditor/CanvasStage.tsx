import React, { useRef, useCallback } from 'react';
import { CanvasLayer, ImageFilters, buildFilterString } from './types';
import LayerItem from './LayerItem';

interface DragState {
  layerId: string;
  mode: 'move' | 'resize';
  startMx: number;
  startMy: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

interface CanvasStageProps {
  baseImageUrl: string;
  filters: ImageFilters;
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onLayerChange: (id: string, updates: Partial<CanvasLayer>) => void;
  onDeleteLayer: (id: string) => void;
  /** Ref forwarded so parent can read offsetWidth/offsetHeight for export scaling */
  stageRef: React.RefObject<HTMLDivElement>;
}

const CanvasStage: React.FC<CanvasStageProps> = ({
  baseImageUrl,
  filters,
  layers,
  selectedLayerId,
  onSelectLayer,
  onLayerChange,
  onDeleteLayer,
  stageRef,
}) => {
  const dragState = useRef<DragState | null>(null);

  const handleLayerPointerDown = useCallback(
    (e: React.PointerEvent, layerId: string, mode: 'move' | 'resize') => {
      e.stopPropagation();
      onSelectLayer(layerId);
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;
      dragState.current = {
        layerId,
        mode,
        startMx: e.clientX,
        startMy: e.clientY,
        startX: layer.x,
        startY: layer.y,
        startW: layer.width,
        startH: layer.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [layers, onSelectLayer],
  );

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const dx = e.clientX - ds.startMx;
      const dy = e.clientY - ds.startMy;
      if (ds.mode === 'move') {
        onLayerChange(ds.layerId, { x: ds.startX + dx, y: ds.startY + dy });
      } else {
        onLayerChange(ds.layerId, {
          width: Math.max(40, ds.startW + dx),
          height: Math.max(40, ds.startH + dy),
        });
      }
    },
    [onLayerChange],
  );

  const handleStagePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const filterStr = buildFilterString(filters);

  return (
    <div
      ref={stageRef}
      className="relative w-full overflow-hidden bg-slate-900 select-none"
      style={{ aspectRatio: '16/9', touchAction: 'none' }}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerLeave={handleStagePointerUp}
      onClick={() => onSelectLayer(null)}
    >
      {/* Base image */}
      <img
        src={baseImageUrl}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ filter: filterStr || undefined }}
      />

      {/* Layers */}
      {layers.map(layer => (
        <LayerItem
          key={layer.id}
          layer={layer}
          isSelected={layer.id === selectedLayerId}
          onPointerDown={handleLayerPointerDown}
          onDelete={onDeleteLayer}
        />
      ))}
    </div>
  );
};

export default CanvasStage;
