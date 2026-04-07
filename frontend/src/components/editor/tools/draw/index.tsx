/**
 * 涂鸦工具设置面板
 * 右侧工具栏中显示的涂鸦设置界面
 */

import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { Brush, Undo, Trash2, Minimize, Palette } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DrawToolRef, Stroke } from './types';
import { useDrawStrokes, COLOR_PRESETS, BRUSH_SIZES } from './hooks';
import { DrawOverlay } from './Overlay';

interface DrawPanelProps {
  baseImageUrl: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onStrokesChange?: (strokes: Stroke[]) => void;
  onCurrentStrokeChange?: (stroke: any[]) => void;
  onIsDrawingChange?: (isDrawing: boolean) => void;
  onBrushColorChange?: (color: string) => void;
  onBrushSizeChange?: (size: number) => void;
}

const DrawPanel = forwardRef<DrawToolRef, DrawPanelProps>(({
  baseImageUrl,
  onApply,
  containerRef,
  onStrokesChange,
  onCurrentStrokeChange,
  onIsDrawingChange,
  onBrushColorChange,
  onBrushSizeChange,
}, ref) => {
  const {
    strokes,
    currentStroke,
    isDrawing,
    brushColor,
    brushSize,
    setBrushColor,
    setBrushSize,
    startStroke,
    continueStroke,
    endStroke,
    clearStrokes,
    undoLastStroke,
  } = useDrawStrokes(baseImageUrl);

  const hasChanges = strokes.length > 0 || currentStroke !== null;

  // 通知父组件状态变化
  useEffect(() => {
    onStrokesChange?.(strokes);
  }, [strokes, onStrokesChange]);

  useEffect(() => {
    onCurrentStrokeChange?.(currentStroke);
  }, [currentStroke, onCurrentStrokeChange]);

  useEffect(() => {
    onIsDrawingChange?.(isDrawing);
  }, [isDrawing, onIsDrawingChange]);

  useEffect(() => {
    onBrushColorChange?.(brushColor);
  }, [brushColor, onBrushColorChange]);

  useEffect(() => {
    onBrushSizeChange?.(brushSize);
  }, [brushSize, onBrushSizeChange]);

  // 应用涂鸦到图片
  const handleApply = async () => {
    if (!hasChanges) return;
    try {
      // 将涂鸦绘制到 canvas 上
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

      // 计算缩放比例
      const scale = img.naturalWidth / containerWidth;

      // 绘制背景图片
      ctx.drawImage(img, 0, 0);

      // 设置线条样式
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 绘制所有笔画
      strokes.forEach(stroke => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * scale;

        if (stroke.points.length === 1) {
          // 单个点，绘制圆
          const point = stroke.points[0];
          const x = (point.x - containerRect.left) * scale;
          const y = (point.y - containerRect.top) * scale;
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(x, y, (stroke.size * scale) / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 绘制路径
          ctx.beginPath();
          stroke.points.forEach((point, index) => {
            const x = (point.x - containerRect.left) * scale;
            const y = (point.y - containerRect.top) * scale;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        }
      });

      // 转换为base64
      const imageUrl = canvas.toDataURL('image/png');
      onApply(imageUrl);
    } catch (error) {
      console.error('应用涂鸦失败:', error);
      throw error;
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getStrokes: () => strokes,
    getCurrentStroke: () => currentStroke,
    getIsDrawing: () => isDrawing,
    clearStrokes,
    undoLastStroke,
    startStroke,
    continueStroke,
    endStroke,
  }), [strokes, currentStroke, isDrawing, clearStrokes, undoLastStroke, startStroke, continueStroke, endStroke]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部操作按钮 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">涂鸦笔</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={undoLastStroke}
            disabled={strokes.length === 0}
            className="h-8 w-8 p-0"
            title="撤销"
          >
            <Undo size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearStrokes}
            disabled={!hasChanges}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
            title="清空"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultValue="brush" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="brush" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Brush size={14} />
            笔刷
          </TabsTrigger>
          <TabsTrigger value="color" className="gap-1.5 data-[state=active]:text-[#00CDD4]">
            <Palette size={14} />
            颜色
          </TabsTrigger>
        </TabsList>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="brush" className="space-y-4 mt-0">
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
                    className={`h-8 text-xs font-medium transition-all ${
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

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: brushColor }}
                />
                <span className="text-xs text-slate-600">当前颜色</span>
              </div>
              <p className="text-xs text-slate-400">点击"颜色"标签选择更多颜色</p>
            </div>
          </TabsContent>

          <TabsContent value="color" className="space-y-4 mt-0">
            <div>
              <Label className="text-xs text-slate-500 mb-2 block">预设颜色</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={`w-9 h-9 rounded-lg border-2 transition-all ${
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

      {/* 应用按钮 */}
      <div className="pt-4 border-t border-slate-200">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasChanges}
          className="w-full bg-[#00CDD4] hover:bg-[#00b8be] text-white"
        >
          应用
        </Button>
      </div>
    </div>
  );
});

DrawPanel.displayName = 'DrawPanel';

// 导出工具对象
export const DrawTool = {
  Panel: DrawPanel,
  Overlay: DrawOverlay,
};

export default DrawTool;
