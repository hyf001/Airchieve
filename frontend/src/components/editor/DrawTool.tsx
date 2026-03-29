import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Brush2, Undo, Trash2, Minimize, Palette } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  size: number;
}

export interface DrawToolRef {
  getStrokes: () => Stroke[];
  getCurrentStroke: () => StrokePoint[] | null;
  getIsDrawing: () => boolean;
  clearStrokes: () => void;
  undoLastStroke: () => void;
  startStroke: (e: React.MouseEvent) => void;
  continueStroke: (e: React.MouseEvent) => void;
  endStroke: () => void;
}

interface DrawToolProps {
  baseImageUrl: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onStrokesChange?: (strokes: Stroke[]) => void;
  onCurrentStrokeChange?: (stroke: StrokePoint[] | null) => void;
  onIsDrawingChange?: (isDrawing: boolean) => void;
  onBrushColorChange?: (color: string) => void;
  onBrushSizeChange?: (size: number) => void;
}

const COLOR_PRESETS = [
  '#ffffff', '#000000', '#FF0000', '#FF6B6B', '#FFA500', '#FFD700',
  '#FFFF00', '#00FF00', '#00CDD4', '#0000FF', '#8B5CF6', '#FF1493',
  '#8B4513', '#A52A2A', '#808080', '#FFC0CB',
];

const BRUSH_SIZES = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32];

const DrawTool = forwardRef<DrawToolRef, DrawToolProps>(({
  baseImageUrl,
  onApply,
  containerRef,
  onStrokesChange,
  onCurrentStrokeChange,
  onIsDrawingChange,
  onBrushColorChange,
  onBrushSizeChange,
}, ref) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // 笔刷设置
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(8);

  // 当 baseImageUrl 变化时重置状态
  useEffect(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, [baseImageUrl]);

  // 当笔画变化时，通知父组件
  useEffect(() => {
    onStrokesChange?.(strokes);
  }, [strokes, onStrokesChange]);

  // 当当前笔画变化时，通知父组件
  useEffect(() => {
    onCurrentStrokeChange?.(currentStroke);
  }, [currentStroke, onCurrentStrokeChange]);

  // 当绘制状态变化时，通知父组件
  useEffect(() => {
    onIsDrawingChange?.(isDrawing);
  }, [isDrawing, onIsDrawingChange]);

  // 当画笔颜色变化时，通知父组件
  useEffect(() => {
    onBrushColorChange?.(brushColor);
  }, [brushColor, onBrushColorChange]);

  // 当画笔大小变化时，通知父组件
  useEffect(() => {
    onBrushSizeChange?.(brushSize);
  }, [brushSize, onBrushSizeChange]);

  const hasChanges = strokes.length > 0 || currentStroke !== null;

  // 清除所有笔画
  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
  };

  // 撤销最后一笔
  const handleUndo = () => {
    if (strokes.length > 0) {
      setStrokes(prev => prev.slice(0, -1));
    }
  };

  // 应用涂鸦到图片
  const handleApply = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
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

      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        throw new Error('图片尺寸无效');
      }

      const container = containerRef?.current;
      if (!container) throw new Error('找不到容器元素');
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const scale = img.naturalWidth / containerWidth;

      // 绘制背景图片
      ctx.drawImage(img, 0, 0);

      // 设置线条样式
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 绘制所有笔画
      const allStrokes = [...strokes];
      if (currentStroke && currentStroke.length > 0) {
        allStrokes.push({
          id: 'current',
          points: currentStroke,
          color: brushColor,
          size: brushSize,
        });
      }

      allStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * scale;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);

        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
        }

        ctx.stroke();
      });

      const imageUrl = canvas.toDataURL('image/png');
      onApply(imageUrl);
    } catch (error) {
      console.error('应用涂鸦失败:', error);
      throw error;
    } finally {
      setIsApplying(false);
    }
  };

  // 开始绘制
  const handleStartStroke = (e: React.MouseEvent) => {
    if (!containerRef?.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke([{ x, y }]);
    setIsDrawing(true);
  };

  // 继续绘制
  const handleContinueStroke = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef?.current || !currentStroke) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke(prev => [...(prev || []), { x, y }]);
  };

  // 结束绘制
  const handleEndStroke = () => {
    if (!isDrawing || !currentStroke || currentStroke.length < 2) {
      setCurrentStroke(null);
      setIsDrawing(false);
      return;
    }

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}`,
      points: currentStroke,
      color: brushColor,
      size: brushSize,
    };

    setStrokes(prev => [...prev, newStroke]);
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getStrokes: () => strokes,
    getCurrentStroke: () => currentStroke,
    getIsDrawing: () => isDrawing,
    clearStrokes: handleClear,
    undoLastStroke: handleUndo,
    startStroke: handleStartStroke,
    continueStroke: handleContinueStroke,
    endStroke: handleEndStroke,
  }), [strokes, currentStroke, isDrawing, brushColor, brushSize, containerRef]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部提示和操作按钮 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">涂鸦笔</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="h-8 w-8 p-0 hover:bg-slate-100"
            title="撤销"
          >
            <Undo size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!hasChanges}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
            title="清空"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultValue="size" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="size" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Minimize size={14} />
            笔刷大小
          </TabsTrigger>
          <TabsTrigger value="color" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Palette size={14} />
            颜色
          </TabsTrigger>
        </TabsList>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="size" className="space-y-4 mt-0">
            <div>
              <Label className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                <span>笔刷大小</span>
                <span className="font-mono font-medium text-[#00CDD4]">{brushSize}px</span>
              </Label>
              <input
                type="range"
                min={2}
                max={32}
                value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="w-full accent-[#00CDD4] h-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>2px</span>
                <span>32px</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-2 block">快捷选择</Label>
              <div className="grid grid-cols-5 gap-2">
                {BRUSH_SIZES.map(size => (
                  <Button
                    key={size}
                    variant={brushSize === size ? "default" : "outline"}
                    onClick={() => setBrushSize(size)}
                    className={`h-10 text-xs font-medium transition-all ${
                      brushSize === size
                        ? 'bg-[#00CDD4] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-2 block">笔刷预览</Label>
              <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-center">
                <div
                  style={{
                    width: `${brushSize * 2}px`,
                    height: `${brushSize * 2}px`,
                    backgroundColor: brushColor,
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="color" className="space-y-4 mt-0">
            <div>
              <Label className="text-xs text-slate-500 mb-2 block">预设颜色</Label>
              <div className="grid grid-cols-8 gap-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      brushColor === color
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
                  value={brushColor}
                  onChange={e => setBrushColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <div className="flex-1">
                  <div className="text-sm font-mono text-slate-700">{brushColor}</div>
                  <div className="text-[10px] text-slate-400">点击色块选择颜色</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-500 via-green-500 to-blue-500 h-2 rounded-full opacity-80" />
          </TabsContent>
        </div>
      </Tabs>

      {/* 提示信息 */}
      <div className="text-center text-xs text-slate-400 py-2">
        在图片上拖动鼠标开始绘制
      </div>

      {/* 应用和重置按钮 */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!hasChanges}
          className="flex-1"
        >
          清空
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

DrawTool.displayName = 'DrawTool';

export default DrawTool;

// 导出涂鸦叠加层组件
export const DrawToolOverlay: React.FC<{
  strokes: Stroke[];
  currentStroke: StrokePoint[] | null;
  isDrawing: boolean;
  currentBrushColor: string;
  currentBrushSize: number;
  onStartStroke: (e: React.MouseEvent) => void;
  onContinueStroke: (e: React.MouseEvent) => void;
  onEndStroke: () => void;
}> = ({ strokes, currentStroke, isDrawing, currentBrushColor, currentBrushSize, onStartStroke, onContinueStroke, onEndStroke }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 在 canvas 上绘制笔画
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置线条样式
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 绘制所有已完成的笔画
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });

    // 绘制当前正在绘制的笔画
    if (currentStroke && currentStroke.length > 1) {
      ctx.strokeStyle = currentBrushColor;
      ctx.lineWidth = currentBrushSize;

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }

      ctx.stroke();
    }
  }, [strokes, currentStroke, currentBrushColor, currentBrushSize]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        cursor: 'crosshair',
      }}
      onMouseDown={onStartStroke}
      onMouseMove={onContinueStroke}
      onMouseUp={onEndStroke}
      onMouseLeave={onEndStroke}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
