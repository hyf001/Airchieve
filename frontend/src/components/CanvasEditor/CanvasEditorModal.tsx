import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Loader2, Check, Scissors, ImagePlus, Type, Sliders } from 'lucide-react';
import CanvasStage from './CanvasStage';
import HeadSwapTool from './tools/HeadSwapTool';
import StickerTool from './tools/StickerTool';
import TextTool from './tools/TextTool';
import FilterTool from './tools/FilterTool';
import { CanvasLayer, ImageFilters, DEFAULT_FILTERS, ToolType } from './types';
import { exportCanvasToBase64 } from './useCanvasExport';

interface CanvasEditorModalProps {
  baseImageUrl: string;
  pageText?: string;
  onApply: (base64: string) => void;
  onClose: () => void;
}

interface NavItem {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'headswap', label: '换头', icon: <Scissors size={16} /> },
  { id: 'sticker',  label: '贴图', icon: <ImagePlus size={16} /> },
  { id: 'text',     label: '文字', icon: <Type size={16} /> },
  { id: 'filter',   label: '滤镜', icon: <Sliders size={16} /> },
];

const CanvasEditorModal: React.FC<CanvasEditorModalProps> = ({ baseImageUrl, pageText = '', onApply, onClose }) => {
  const stageRef = useRef<HTMLDivElement>(null!);
  const [activeTool, setActiveTool] = useState<ToolType>('headswap');
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);
  const [isExporting, setIsExporting] = useState(false);
  const [stageW, setStageW] = useState(0);
  const [stageH, setStageH] = useState(0);

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => { setStageW(el.offsetWidth); setStageH(el.offsetHeight); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const addLayer = useCallback((layer: CanvasLayer) => {
    setLayers(prev => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<CanvasLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    setSelectedLayerId(null);
  }, []);

  const handleApply = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setIsExporting(true);
    try {
      const base64 = await exportCanvasToBase64(
        baseImageUrl,
        filters,
        layers,
        stage.offsetWidth,
        stage.offsetHeight,
      );
      onApply(base64);
    } catch (e) {
      console.error('Canvas export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800 text-base">画布编辑</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: tool nav */}
          <div className="w-16 shrink-0 flex flex-col items-center pt-3 gap-1 border-r border-slate-100 bg-slate-50">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTool(item.id)}
                className={`flex flex-col items-center gap-0.5 w-12 py-2 rounded-xl text-[10px] font-medium transition-colors ${
                  activeTool === item.id
                    ? 'bg-[#00CDD4]/15 text-[#00CDD4]'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Center: canvas stage */}
          <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
            <CanvasStage
              baseImageUrl={baseImageUrl}
              filters={filters}
              layers={layers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onLayerChange={updateLayer}
              onDeleteLayer={deleteLayer}
              stageRef={stageRef}
            />
            <p className="text-xs text-slate-400 text-center shrink-0">
              点击图层选中，拖拽移动，右下角拖拽缩放
            </p>
          </div>

          {/* Right: tool panel */}
          <div className="w-56 shrink-0 border-l border-slate-100 bg-slate-50 p-4 overflow-y-auto">
            {activeTool === 'headswap' && (
              <HeadSwapTool stageWidth={stageW} stageHeight={stageH} onAddLayer={addLayer} />
            )}
            {activeTool === 'sticker' && (
              <StickerTool stageWidth={stageW} stageHeight={stageH} onAddLayer={addLayer} />
            )}
            {activeTool === 'text' && (
              <TextTool stageWidth={stageW} stageHeight={stageH} pageText={pageText} onAddLayer={addLayer} />
            )}
            {activeTool === 'filter' && (
              <FilterTool filters={filters} onChange={setFilters} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-[#00CDD4] hover:bg-[#00b8be] text-white font-medium disabled:opacity-60 transition-colors"
          >
            {isExporting
              ? <><Loader2 size={14} className="animate-spin" />合并中…</>
              : <><Check size={14} />应用到画布</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasEditorModal;
