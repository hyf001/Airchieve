/**
 * 文字工具设置面板
 * 右侧工具栏中显示的文字编辑界面
 */

import React, { forwardRef, useImperativeHandle, useState, useCallback, useEffect } from 'react';
import { Type, Palette, Minimize, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextEditToolRef, TextLayer } from './types';
import { useTextLayers, FONT_OPTIONS, COLOR_PRESETS } from './hooks';
import { TextEditOverlay } from './Overlay';

interface TextEditPanelProps {
  baseImageUrl: string;
  initialText?: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onLayersChange?: (layers: TextLayer[]) => void;
  onSelectedLayerChange?: (layerId: string | null) => void;
  onIsDraggingChange?: (isDragging: boolean) => void;
  onIsResizingChange?: (isResizing: boolean) => void;
}

const TextEditPanel = forwardRef<TextEditToolRef, TextEditPanelProps>(({
  baseImageUrl,
  initialText,
  onApply,
  containerRef,
  onLayersChange,
  onSelectedLayerChange,
  onIsDraggingChange,
  onIsResizingChange,
}, ref) => {
  // 使用自定义 hook 管理文字图层状态
  const {
    layers,
    selectedLayerId,
    isDragging,
    isResizing,
    resizeStartRef,
    resizeHandleRef,
    dragStartRef,
    updateLayer,
    deleteLayer,
    selectLayer,
    handleTextChange,
    handleLayerMouseDown,
    handleResizeMouseDown,
    setIsDragging,
    setIsResizing,
  } = useTextLayers(initialText);

  const [isApplying, setIsApplying] = useState(false);

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // 通知父组件状态变化
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

  const hasChanges = layers.length > 0;

  // 重置
  const handleReset = () => {
    // 清空所有图层
    layers.forEach(layer => deleteLayer(layer.id));
  };

  // 应用文字到图片
  const handleApply = async () => {
    if (isApplying || !hasChanges) return;
    setIsApplying(true);
    try {
      // 将文字图层合并到图片上
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建canvas上下文');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = baseImageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
      });

      // 检查图片是否成功加载
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        throw new Error('图片尺寸无效');
      }

      // 获取容器实际显示尺寸
      const container = containerRef?.current;
      if (!container) throw new Error('找不到容器元素');
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      // 设置canvas尺寸为原始图片尺寸
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // 计算缩放比例（保持一致的缩放）
      const scale = img.naturalWidth / containerWidth;

      // 绘制背景图片
      ctx.drawImage(img, 0, 0);

      // 绘制文字图层
      layers.forEach(layer => {
        const scaledX = layer.x * scale;
        const scaledY = layer.y * scale;
        const scaledFontSize = layer.fontSize * scale;
        const scaledWidth = layer.width * scale;
        const scaledHeight = layer.height * scale;

        ctx.font = `${layer.bold ? 'bold' : ''} ${scaledFontSize}px ${layer.fontFamily}`;
        ctx.fillStyle = layer.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 添加文字阴影
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4 * scale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1 * scale;

        const text = layer.text || '';

        // 自动换行函数
        const wrapText = (text: string, maxWidth: number): string[] => {
          const paragraphs = text.split('\n');
          const lines: string[] = [];

          paragraphs.forEach(paragraph => {
            const words = paragraph.split('');
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
              const testLine = currentLine + words[i];
              const metrics = ctx.measureText(testLine);
              const testWidth = metrics.width;

              if (testWidth > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = words[i];
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) {
              lines.push(currentLine);
            }
          });

          return lines;
        };

        // 自动换行，每行的最大宽度为文本框宽度减去一些内边距
        const padding = scaledFontSize * 0.5;
        const maxWidth = scaledWidth - padding * 2;
        const lines = wrapText(text, maxWidth);
        const lineHeight = scaledFontSize * 1.2;

        // 计算起始Y位置，使文字在文本框中垂直居中
        const totalHeight = lines.length * lineHeight;
        const startY = scaledY + (scaledHeight - totalHeight) / 2 + lineHeight / 2;

        lines.forEach((line, index) => {
          const x = scaledX + scaledWidth / 2;
          const y = startY + index * lineHeight;
          ctx.fillText(line, x, y);
        });
      });

      // 转换为base64
      const imageUrl = canvas.toDataURL('image/png');
      onApply(imageUrl);
    } catch (error) {
      console.error('应用文字失败:', error);
      throw error;
    } finally {
      setIsApplying(false);
    }
  };

  // 监听鼠标移动和松开（document级别）
  useEffect(() => {
    console.log('useEffect triggered:', { isDragging, isResizing, selectedLayerId, hasContainerRef: !!containerRef?.current });
    if ((!isDragging && !isResizing) || !selectedLayerId || !containerRef?.current) {
      console.log('useEffect early return');
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const rect = containerRef.current!.getBoundingClientRect();
      console.log('Mouse move:', { clientX: e.clientX, clientY: e.clientY, isDragging, isResizing, layerId: layer.id });

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

        // 根据拖拽手柄调整尺寸
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

        console.log('Resizing layer:', { selectedLayerId, newWidth, newHeight, newX, newY });
        updateLayer(selectedLayerId, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY,
        });
      }
    };

    const handleMouseUp = () => {
      console.log('Mouse up');
      setIsDragging(false);
      setIsResizing(false);
      resizeStartRef.current = null;
      resizeHandleRef.current = null;
      dragStartRef.current = null;
    };

    console.log('Adding event listeners');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      console.log('Removing event listeners');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, selectedLayerId, layers, dragStartRef, resizeStartRef, resizeHandleRef, containerRef, updateLayer, setIsDragging, setIsResizing]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getLayers: () => layers,
    getSelectedLayerId: () => selectedLayerId,
    getIsDragging: () => isDragging,
    getIsResizing: () => isResizing,
    updateLayer,
    deleteLayer,
    selectLayer,
    handleLayerMouseDown,
    handleResizeMouseDown,
    handleTextChange,
  }), [layers, selectedLayerId, isDragging, isResizing, updateLayer, deleteLayer, selectLayer, handleLayerMouseDown, handleResizeMouseDown, handleTextChange]);

  // 未选中图层时显示提示
  if (!selectedLayer) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-8 space-y-2">
        <Type size={24} className="mx-auto mb-2" />
        <p>点击图片上的文字进行编辑</p>
        <p className="text-xs">文字已自动添加到图片中</p>
      </div>
    );
  }

  // 选中图层时显示编辑面板
  return (
    <div className="h-full flex flex-col">
      {/* 图层信息 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">编辑文字</span>
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
                    checked={selectedLayer.bold}
                    onChange={e => updateLayer(selectedLayer.id, { bold: e.target.checked })}
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
                    onClick={() => updateLayer(selectedLayer.id, { color })}
                    className={`w-9 h-9 rounded-lg border-2 transition-all ${
                      selectedLayer.color === color
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
                  value={selectedLayer.color}
                  onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <div className="flex-1">
                  <div className="text-sm font-mono text-slate-700">{selectedLayer.color}</div>
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
        点击图片外部自动应用
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
