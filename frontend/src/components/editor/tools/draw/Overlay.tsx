/**
 * 涂鸦工具叠加层组件
 * 在画布上显示笔画
 */

import React from 'react';
import { Stroke, StrokePoint } from './types';

interface DrawOverlayProps {
  strokes: Stroke[];
  currentStroke: StrokePoint[] | null;
  isDrawing: boolean;
  brushColor: string;
  brushSize: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onStartStroke: (e: React.MouseEvent) => void;
  onContinueStroke: (e: React.MouseEvent) => void;
  onEndStroke: () => void;
}

/**
 * 笔画渲染函数
 */
const renderStroke = (
  points: StrokePoint[],
  color: string,
  size: number,
  containerRef: React.RefObject<HTMLDivElement>
) => {
  if (!containerRef.current || points.length === 0) return null;

  const rect = containerRef.current.getBoundingClientRect();

  // 将客户端坐标转换为相对于容器的坐标
  const relativePoints = points.map(p => ({
    x: p.x - rect.left,
    y: p.y - rect.top,
  }));

  // 创建 SVG 路径
  if (relativePoints.length === 1) {
    // 单个点，渲染为圆
    return (
      <circle
        cx={relativePoints[0].x}
        cy={relativePoints[0].y}
        r={size / 2}
        fill={color}
      />
    );
  }

  // 多个点，渲染为路径
  const pathData = relativePoints.reduce((acc, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  return (
    <path
      d={pathData}
      stroke={color}
      strokeWidth={size}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
};

/**
 * 涂鸦叠加层组件
 */
export const DrawOverlay: React.FC<DrawOverlayProps> = ({
  strokes,
  currentStroke,
  isDrawing,
  brushColor,
  brushSize,
  containerRef,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
}) => {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    >
      {/* 渲染已完成的笔画 */}
      {strokes.map(stroke => (
        <g key={stroke.id}>
          {renderStroke(stroke.points, stroke.color, stroke.size, containerRef)}
        </g>
      ))}

      {/* 渲染当前正在绘制的笔画 */}
      {currentStroke && currentStroke.length > 0 && (
        <g>
          {renderStroke(currentStroke, brushColor, brushSize, containerRef)}
        </g>
      )}

      {/* 交互层 - 捕获鼠标事件 */}
      {isDrawing && (
        <rect
          className="pointer-events-auto"
          width="100%"
          height="100%"
          fill="transparent"
          onMouseMove={onContinueStroke}
          onMouseUp={onEndStroke}
          onMouseLeave={onEndStroke}
        />
      )}
    </svg>
  );
};

export default DrawOverlay;
