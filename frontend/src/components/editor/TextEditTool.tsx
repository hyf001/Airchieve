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
  updateLayer: (id: string, updates: Partial<TextLayer>) => void;
  deleteLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  handleLayerMouseDown: (e: React.MouseEvent, layer: TextLayer) => void;
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
}

const FONT_OPTIONS = [
  { label: '黑体', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"Songti SC", "SimSun", serif' },
  { label: '楷体', value: '"KaiTi", "STKaiti", serif' },
  { label: '圆体', value: '"PingFang SC", "Noto Sans SC", sans-serif' },
  { label: '手写体', value: '"Brush Script MT", "cursive", sans-serif' },
  { label: '艺术体', value: '"Impact", "Arial Black", sans-serif' },
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
}, ref) => {
  // 内部管理文字图层状态
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
        fontSize: 32,
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        color: '#ffffff',
        bold: true,
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

      // 获取图片容器尺寸
      const containerWidth = 800;
      const containerHeight = 400;

      // 设置canvas尺寸为原始图片尺寸
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // 计算缩放比例
      const scaleX = img.naturalWidth / containerWidth;
      const scaleY = img.naturalHeight / containerHeight;

      // 绘制背景图片
      ctx.drawImage(img, 0, 0);

      // 绘制文字图层
      textLayers.forEach(layer => {
        const scaledX = layer.x * scaleX;
        const scaledY = layer.y * scaleY;
        const scaledFontSize = layer.fontSize * Math.min(scaleX, scaleY);

        ctx.font = `${layer.bold ? 'bold' : ''} ${scaledFontSize}px ${layer.fontFamily}`;
        ctx.fillStyle = layer.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 添加文字阴影
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4 * Math.min(scaleX, scaleY);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1 * Math.min(scaleX, scaleY);

        const text = layer.text || '';
        const lines = text.split('\n');
        const lineHeight = scaledFontSize * 1.2;
        const startY = scaledY + (layer.height * scaleY) / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
          const x = scaledX + (layer.width * scaleX) / 2;
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
    if (!isDragging || !selectedLayerId || !containerRef?.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const layer = textLayers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // 限制在画布范围内
      const constrainedX = Math.max(0, Math.min(newX, rect.width - layer.width));
      const constrainedY = Math.max(0, Math.min(newY, rect.height - layer.height));

      handleUpdateLayer(selectedLayerId, { x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectedLayerId, textLayers, dragStart, containerRef]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getLayers: () => textLayers,
    getSelectedLayerId: () => selectedLayerId,
    getIsDragging: () => isDragging,
    updateLayer: handleUpdateLayer,
    deleteLayer: handleDeleteLayer,
    selectLayer: setSelectedLayerId,
    handleLayerMouseDown,
    handleTextChange,
  }), [textLayers, selectedLayerId, isDragging]);

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
              <Label className="text-xs text-slate-500 mb-2 block">字��风格</Label>
              <div className="space-y-1.5">
                {FONT_OPTIONS.map(font => (
                  <Button
                    key={font.label}
                    variant={selectedLayer.fontFamily === font.value ? "default" : "outline"}
                    onClick={() => handleUpdateLayer(selectedLayer.id, { fontFamily: font.value })}
                    className={`w-full justify-start text-sm transition-all ${
                      selectedLayer.fontFamily === font.value
                        ? 'bg-[#00CDD4] text-white border-[#00CDD4]'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-transparent'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <input
                type="checkbox"
                id="bold"
                checked={selectedLayer.bold}
                onChange={e => handleUpdateLayer(selectedLayer.id, { bold: e.target.checked })}
                className="accent-[#00CDD4] w-4 h-4"
              />
              <Label htmlFor="bold" className="cursor-pointer font-medium flex-1">
                加粗
              </Label>
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
              <div className="grid grid-cols-4 gap-2">
                {[16, 24, 32, 48, 64, 80, 96, 120].map(size => (
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
  onTextChange: (id: string, text: string) => void;
  onDeleteLayer: (id: string) => void;
  onLayerClick: (id: string) => void;
  isDragging: boolean;
}> = ({ layers, selectedLayerId, onLayerMouseDown, onTextChange, onDeleteLayer, onLayerClick, isDragging }) => {
  return (
    <>
      {layers.map(layer => (
        <div
          key={layer.id}
          style={{
            position: 'absolute',
            left: layer.x,
            top: layer.y,
            width: layer.width,
            height: layer.height,
            cursor: isDragging && selectedLayerId === layer.id ? 'grabbing' : 'grab',
            outline: selectedLayerId === layer.id ? '2px solid #00CDD4' : '2px dashed transparent',
            userSelect: 'none',
          }}
          onMouseDown={(e) => onLayerMouseDown(e, layer)}
          onClick={() => onLayerClick(layer.id)}
        >
          {selectedLayerId === layer.id ? (
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
              }}
            >
              {layer.text}
            </div>
          )}

          {/* 选中时显示删除按钮 */}
          {selectedLayerId === layer.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteLayer(layer.id);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{ fontSize: '12px' }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </>
  );
};
