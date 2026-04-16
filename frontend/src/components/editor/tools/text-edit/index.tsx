/**
 * 文字工具设置面板
 * 右侧工具栏中显示的文字编辑界面
 * 基于 Layer API 持久化，不再做 Canvas 合成
 */

import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { Type, Palette, Minimize, X, Plus, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StorybookLayer } from '@/services/storybookService';
import { TextEditToolRef, TextLayerViewModel } from './types';
import { useTextLayers, FONT_OPTIONS, COLOR_PRESETS } from './hooks';
import { TextEditOverlay } from './Overlay';

interface TextEditPanelProps {
  pageId: number;
  initialLayers: StorybookLayer[];
  containerRef?: React.RefObject<HTMLDivElement>;
  onLayersChange?: (layers: TextLayerViewModel[]) => void;
  onSelectedLayerChange?: (layerId: number | null) => void;
  onIsDraggingChange?: (isDragging: boolean) => void;
  onIsResizingChange?: (isResizing: boolean) => void;
  onPersisted?: () => void;
}

const TextEditPanel = forwardRef<TextEditToolRef, TextEditPanelProps>(({
  pageId,
  initialLayers,
  containerRef,
  onLayersChange,
  onSelectedLayerChange,
  onIsDraggingChange,
  onIsResizingChange,
  onPersisted,
}, ref) => {
  const {
    layers,
    selectedLayerId,
    isDragging,
    isResizing,
    isAdding,
    resizeStartRef,
    resizeHandleRef,
    dragStartRef,
    addLayer,
    updateLayer,
    deleteLayer,
    selectLayer,
    handleTextChange,
    handleLayerMouseDown,
    handleResizeMouseDown,
    handleInteractionEnd,
    commitCurrentEdits,
    setIsDragging,
    setIsResizing,
  } = useTextLayers({ pageId, initialLayers, onPersisted });

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // 通知父组件状态变化（供 EditorCanvas 渲染 Overlay）
  useEffect(() => {
    onLayersChange?.(layers);
  }, [layers, onLayersChange]);

  useEffect(() => {
    onSelectedLayerChange?.(selectedLayerId);
  }, [selectedLayerId, onSelectedLayerChange]);

  useEffect(() => {
    onIsDraggingChange?.(isDragging);
  }, [isDragging, onIsDraggingChange]);

  useEffect(() => {
    onIsResizingChange?.(isResizing);
  }, [isResizing, onIsResizingChange]);

  // 监听鼠标移动和松开（document级别）——拖拽/缩放
  useEffect(() => {
    if ((!isDragging && !isResizing) || !selectedLayerId || !containerRef?.current) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const rect = containerRef.current!.getBoundingClientRect();

      if (isDragging && dragStartRef.current) {
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;

        // 限制在画布范围内
        const constrainedX = Math.max(0, Math.min(newX, rect.width - layer.width));
        const constrainedY = Math.max(0, Math.min(newY, rect.height - layer.height));

        updateLayer(selectedLayerId, { x: constrainedX, y: constrainedY });
      } else if (isResizing && resizeStartRef.current && resizeHandleRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;

        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = layer.x;
        let newY = layer.y;

        if (resizeHandleRef.current.includes('e')) {
          newWidth = Math.max(50, resizeStartRef.current.width + deltaX);
        }
        if (resizeHandleRef.current.includes('s')) {
          newHeight = Math.max(30, resizeStartRef.current.height + deltaY);
        }
        if (resizeHandleRef.current.includes('w')) {
          newWidth = Math.max(50, resizeStartRef.current.width - deltaX);
          newX = layer.x + deltaX;
        }
        if (resizeHandleRef.current.includes('n')) {
          newHeight = Math.max(30, resizeStartRef.current.height - deltaY);
          newY = layer.y + deltaY;
        }

        updateLayer(selectedLayerId, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY,
        });
      }
    };

    const handleMouseUp = () => {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer && (isDragging || isResizing)) {
        handleInteractionEnd(layer);
      }
      setIsDragging(false);
      setIsResizing(false);
      resizeStartRef.current = null;
      resizeHandleRef.current = null;
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, selectedLayerId, layers, dragStartRef, resizeStartRef, resizeHandleRef, containerRef, updateLayer, setIsDragging, setIsResizing, handleInteractionEnd]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getLayers: () => layers,
    getSelectedLayerId: () => selectedLayerId,
    getIsDragging: () => isDragging,
    getIsResizing: () => isResizing,
    addLayer,
    updateLayer,
    deleteLayer,
    selectLayer,
    handleLayerMouseDown,
    handleResizeMouseDown,
    handleTextChange,
    commitCurrentEdits,
  }), [layers, selectedLayerId, isDragging, isResizing, addLayer, updateLayer, deleteLayer, selectLayer, handleLayerMouseDown, handleResizeMouseDown, handleTextChange, commitCurrentEdits]);

  // 无文字图层时：显示添加按钮
  if (layers.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-8 space-y-4">
        <Type size={32} className="mx-auto text-slate-300" />
        <p>当前页面没有文字图层</p>
        <Button
          onClick={addLayer}
          disabled={isAdding}
          className="gap-2 bg-[#00CDD4] hover:bg-[#00b8be] text-white"
        >
          {isAdding ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Plus size={14} />
              添加文字图层
            </>
          )}
        </Button>
      </div>
    );
  }

  // 未选中图层时：显示提示 + 添加按钮
  if (!selectedLayer) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-8 space-y-4">
        <Type size={24} className="mx-auto" />
        <p>点击图片上的文字进行编辑</p>
        <Button
          variant="outline"
          size="sm"
          onClick={addLayer}
          disabled={isAdding}
          className="gap-1.5 text-xs"
        >
          <Plus size={12} />
          添加新图层
        </Button>
      </div>
    );
  }

  // 选中图层时显示编辑面板
  return (
    <div className="h-full flex flex-col">
      {/* 图层信息 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">编辑文字</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={addLayer}
            disabled={isAdding}
            className="h-8 w-8 p-0 hover:bg-slate-100"
            title="添加新文字图层"
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteLayer(selectedLayer.id)}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
            title="删除此文字"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultValue="font" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-3 w-full mb-4">
          <TabsTrigger value="font" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Type size={14} />
            字体
          </TabsTrigger>
          <TabsTrigger value="size" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Minimize size={14} />
            大小
          </TabsTrigger>
          <TabsTrigger value="color" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Palette size={14} />
            颜色
          </TabsTrigger>
        </TabsList>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="font" className="space-y-4 mt-0">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Label className="text-xs text-slate-500">字体风格</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="bold"
                    checked={selectedLayer.fontWeight === 'bold'}
                    onChange={e => updateLayer(selectedLayer.id, { fontWeight: e.target.checked ? 'bold' : 'normal' })}
                    className="accent-[#00CDD4] w-4 h-4"
                  />
                  <Label htmlFor="bold" className="cursor-pointer font-medium text-xs text-slate-500">
                    加粗
                  </Label>
                </div>
              </div>
              <div className="space-y-1.5">
                {FONT_OPTIONS.map(font => (
                  <Button
                    key={font.label}
                    variant={selectedLayer.fontFamily === font.value ? "default" : "outline"}
                    onClick={() => updateLayer(selectedLayer.id, { fontFamily: font.value })}
                    className={`w-full justify-start text-sm transition-all ${
                      selectedLayer.fontFamily === font.value
                        ? 'bg-[#00CDD4] text-white border-[#00CDD4] hover:bg-[#00d7df]'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-transparent'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="size" className="space-y-4 mt-0">
            <div>
              <Label className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                <span>字号大小</span>
                <span className="font-mono font-medium text-[#00CDD4]">{selectedLayer.fontSize}px</span>
              </Label>
              <input
                type="range"
                min={12}
                max={120}
                value={selectedLayer.fontSize}
                onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                className="w-full accent-[#00CDD4] h-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>12px</span>
                <span>120px</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-2 block">快捷选择</Label>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 17 }, (_, i) => 8 + i).map(size => (
                  <Button
                    key={size}
                    variant={selectedLayer.fontSize === size ? "default" : "outline"}
                    onClick={() => updateLayer(selectedLayer.id, { fontSize: size })}
                    className={`h-8 text-xs font-medium transition-all ${
                      selectedLayer.fontSize === size
                        ? 'bg-[#00CDD4] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="color" className="space-y-4 mt-0">
            <div>
              <Label className="text-xs text-slate-500 mb-2 block">预设颜色</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => updateLayer(selectedLayer.id, { fontColor: color })}
                    className={`w-9 h-9 rounded-lg border-2 transition-all ${
                      selectedLayer.fontColor === color
                        ? 'border-[#00CDD4] scale-110 shadow-md ring-2 ring-[#00CDD4]/20'
                        : 'border-slate-200 hover:border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-2 block">自定义颜色</Label>
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <input
                  type="color"
                  value={selectedLayer.fontColor}
                  onChange={e => updateLayer(selectedLayer.id, { fontColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <div className="flex-1">
                  <div className="text-sm font-mono text-slate-700">{selectedLayer.fontColor}</div>
                  <div className="text-[10px] text-slate-400">点击色块选择颜色</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-500 via-green-500 to-blue-500 h-2 rounded-full opacity-80" />
          </TabsContent>
        </div>
      </Tabs>

      {/* 提示信息 */}
      <div className="text-center text-xs text-slate-400 pt-2">
        文字修改自动保存
      </div>
    </div>
  );
});

TextEditPanel.displayName = 'TextEditPanel';

// 导出工具对象
export const TextEditTool = {
  Panel: TextEditPanel,
  Overlay: TextEditOverlay,
};

export default TextEditTool;
