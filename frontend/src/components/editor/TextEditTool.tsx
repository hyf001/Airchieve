import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Type, Palette, Minimize, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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

interface TextEditToolProps {
  baseImageUrl: string;
  initialText?: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onLayersChange?: (layers: TextLayer[]) => void;
  onSelectedLayerChange?: (layerId: string | null) => void;
  onIsDraggingChange?: (isDragging: boolean) => void;
  onIsResizingChange?: (isResizing: boolean) => void;
}

const FONT_OPTIONS = [
  { label: '黑体', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"Songti SC", "SimSun", serif' },
  { label: '楷体', value: '"KaiTi", "STKaiti", serif' },
  { label: '圆体', value: '"YouYuan", "STYuanti", "Rounded Mplus 1c", sans-serif' },
  { label: '手写体', value: '"Xingkai SC", "STXingkai", "Huawen Xingkai", "cursive", serif' },
];

const COLOR_PRESETS = [
  '#ffffff', '#000000', '#FF0000', '#FF6B6B', '#FFA500', '#FFD700',
  '#FFFF00', '#00FF00', '#00CDD4', '#0000FF', '#8B5CF6', '#FF1493',
];

const TextEditTool = forwardRef<TextEditToolRef, TextEditToolProps>(({
  baseImageUrl,
  initialText,
  onApply,
  containerRef,
  onLayersChange,
  onSelectedLayerChange,
  onIsDraggingChange,
  onIsResizingChange,
}, ref) => {
  // 内部管理文字图层状态
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  const selectedLayer = textLayers.find(l => l.id === selectedLayerId);

  // 当 baseImageUrl 变化时重置状态
  useEffect(() => {
    setTextLayers([]);
    setSelectedLayerId(null);
  }, [baseImageUrl]);

  // 当切换到文字工具且当前没有文字图层时，自动添加页面文字
  useEffect(() => {
    if (textLayers.length === 0 && initialText?.trim()) {
      const newLayer: TextLayer = {
        id: `text-${Date.now()}`,
        text: initialText.trim(),
        x: 400 - 150,
        y: 200 - 30,
        width: 300,
        height: 60,
        fontSize: 15,
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        color: '#ffffff',
        bold: false,
      };
      setTextLayers([newLayer]);
      setSelectedLayerId(newLayer.id);
    }
  }, [initialText]);

  // 当文字图层变化时，通知父组件
  useEffect(() => {
    onLayersChange?.(textLayers);
  }, [textLayers, onLayersChange]);

  // 当选中的图层变化时，通知父组件
  useEffect(() => {
    onSelectedLayerChange?.(selectedLayerId);
  }, [selectedLayerId, onSelectedLayerChange]);

  // 当拖拽状态变化时，通知父组件
  useEffect(() => {
    onIsDraggingChange?.(isDragging);
  }, [isDragging, onIsDraggingChange]);

  // 当调整大小状态变化时，通知父组件
  useEffect(() => {
    onIsResizingChange?.(isResizing);
  }, [isResizing, onIsResizingChange]);

  const hasChanges = textLayers.length > 0;

  // 内部图层操作方法
  const handleUpdateLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleDeleteLayer = (id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    setSelectedLayerId(null);
  };

  const handleReset = () => {
    setTextLayers([]);
    setSelectedLayerId(null);
  };

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
      textLayers.forEach(layer => {
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

  // 拖动处理
  const handleLayerMouseDown = (e: React.MouseEvent, layer: TextLayer) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - layer.x,
      y: e.clientY - layer.y,
    });
  };

  // 调整大小处理
  const handleResizeMouseDown = (e: React.MouseEvent, layer: TextLayer, handle: string) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: layer.width,
      height: layer.height,
    });
  };

  // 更新文字内容
  const handleTextChange = (id: string, newText: string) => {
    handleUpdateLayer(id, { text: newText });
  };

  // 选中图层
  const handleLayerClick = (id: string) => {
    setSelectedLayerId(id);
  };

  // 监听鼠标移动和松开（document级别）
  useEffect(() => {
    if ((!isDragging && !isResizing) || !selectedLayerId || !containerRef?.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const layer = textLayers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const rect = containerRef.current!.getBoundingClientRect();

      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        // 限制在画布范围内
        const constrainedX = Math.max(0, Math.min(newX, rect.width - layer.width));
        const constrainedY = Math.max(0, Math.min(newY, rect.height - layer.height));

        handleUpdateLayer(selectedLayerId, { x: constrainedX, y: constrainedY });
      } else if (isResizing && resizeHandle) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;

        // 根据拖拽手柄调整尺寸
        if (resizeHandle.includes('e')) {
          newWidth = Math.max(50, resizeStart.width + deltaX);
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(30, resizeStart.height + deltaY);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(50, resizeStart.width - deltaX);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(30, resizeStart.height - deltaY);
        }

        handleUpdateLayer(selectedLayerId, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, selectedLayerId, textLayers, dragStart, resizeStart, resizeHandle, containerRef]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getLayers: () => textLayers,
    getSelectedLayerId: () => selectedLayerId,
    getIsDragging: () => isDragging,
    getIsResizing: () => isResizing,
    updateLayer: handleUpdateLayer,
    deleteLayer: handleDeleteLayer,
    selectLayer: setSelectedLayerId,
    handleLayerMouseDown,
    handleResizeMouseDown,
    handleTextChange,
  }), [textLayers, selectedLayerId, isDragging, isResizing]);

  // 未选中图层时显示提示
  if (!selectedLayer) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-center text-slate-400 text-sm py-8 space-y-2 flex-1">
          <Type size={24} className="mx-auto mb-2" />
          <p>点击图片上的文字进行编辑</p>
          <p className="text-xs">文字已自动添加到图片中</p>
        </div>

        {/* 应用和重置按钮 */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex-1"
          >
            重置
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
            className="flex-1 bg-[#00CDD4] hover:bg-[#00b8be] text-white"
          >
            {isApplying ? '应用中…' : '应用'}
          </Button>
        </div>
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
          onClick={() => handleDeleteLayer(selectedLayer.id)}
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
                    onChange={e => handleUpdateLayer(selectedLayer.id, { bold: e.target.checked })}
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
                    onClick={() => handleUpdateLayer(selectedLayer.id, { fontFamily: font.value })}
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
                onChange={e => handleUpdateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
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
                    onClick={() => handleUpdateLayer(selectedLayer.id, { fontSize: size })}
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
                    onClick={() => handleUpdateLayer(selectedLayer.id, { color })}
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
                  onChange={e => handleUpdateLayer(selectedLayer.id, { color: e.target.value })}
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

      {/* 应用和重置按钮 */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex-1"
        >
          重置
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasChanges || isApplying}
          className="flex-1 bg-[#00CDD4] hover:bg-[#00b8be] text-white"
        >
          {isApplying ? '应用中…' : '应用'}
        </Button>
      </div>
    </div>
  );
});

TextEditTool.displayName = 'TextEditTool';

export default TextEditTool;

// 导出文字图层叠加层组件
export const TextEditToolOverlay: React.FC<{
  layers: TextLayer[];
  selectedLayerId: string | null;
  onLayerMouseDown: (e: React.MouseEvent, layer: TextLayer) => void;
  onResizeMouseDown: (e: React.MouseEvent, layer: TextLayer, handle: string) => void;
  onTextChange: (id: string, text: string) => void;
  onDeleteLayer: (id: string) => void;
  onLayerClick: (id: string) => void;
  isDragging: boolean;
  isResizing: boolean;
}> = ({ layers, selectedLayerId, onLayerMouseDown, onResizeMouseDown, onTextChange, onDeleteLayer, onLayerClick, isDragging, isResizing }) => {
  const resizeHandles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

  const getHandleCursor = (handle: string) => {
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
