/**
 * 编辑器工具类型定义
 */

export type ToolId =
  | 'ai-edit'       // AI改图
  | 'regenerate'    // AI调整当前页
  | 'text'          // 文字工具
  | 'adjust'        // 调整工具
  | 'color'         // 调色工具
  | 'filter'        // 滤镜工具
  | 'eraser'        // 消除笔
  | 'border'        // 边框工具
  | 'draw'          // 涂鸦笔
  | 'mosaic'        // 马赛克
  | 'marker'        // 标记工具
  | 'optimize'      // 智能优化
  | 'blur'          // 背景虚化
  | 'cutout'        // 抠图
  | 'background'    // 背景工具
  | 'effect'        // 特效
  | 'creative'      // 创意玩法
  | 'repair';       // 画质修复

/**
 * 可选的工具ID（包含null表示未选中任何工具）
 */
export type OptionalToolId = ToolId | null;

export type ToolCategory = 'basic' | 'advanced' | 'creative';

/**
 * 工具配置接口
 */
export interface ToolConfig {
  id: ToolId;
  label: string;
  icon: string;
  category: ToolCategory;
  component: React.ComponentType<ToolComponentProps>;  // 兼容旧的单组件格式
  Panel?: React.ComponentType<any>;  // 新格式：设置面板组件
  Overlay?: React.ComponentType<any>;  // 新格式：叠加层组件
  shortcut?: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * 工具组件 Props 统一接口
 * 扩展以支持不同工具的特定需求
 */
export interface ToolComponentProps {
  storybookId: string | number;
  baseImageUrl: string;
  onPageEdited: (newImageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  // 通用回调
  onApply?: (imageUrl: string) => void;
  // AIEditTool 特定字段
  onImageGenerated?: (imageUrl: string, instruction: string) => void;
  // DrawTool 特定字段
  onStrokesChange?: (strokes: any[]) => void;
  onCurrentStrokeChange?: (stroke: any[] | null) => void;
  onIsDrawingChange?: (isDrawing: boolean) => void;
  onBrushColorChange?: (color: string) => void;
  onBrushSizeChange?: (size: number) => void;
  // 其他工具的回调（如果需要）
  [key: string]: any;
}

/**
 * 工具状态管理接口
 */
export interface ToolState {
  activeTool: ToolId;
  toolHistory: ToolId[];
  toolStates: Record<ToolId, any>;
}

/**
 * 工具操作接口
 */
export interface ToolActions {
  setActiveTool: (toolId: ToolId) => void;
  setToolState: (toolId: ToolId, state: any) => void;
  getToolState: (toolId: ToolId) => any;
  previousTool: () => void;
  resetTool: (toolId: ToolId) => void;
}

/**
 * 工具栏配置
 */
export interface ToolPanelConfig {
  showLabels: boolean;
  columns: number;
  size: 'sm' | 'md' | 'lg';
}

/**
 * Canvas 操作相关类型
 */
export interface CanvasOperation {
  type: 'filter' | 'draw' | 'text' | 'transform';
  data: any;
}

export interface CanvasState {
  operations: CanvasOperation[];
  currentImage: string;
  originalImage: string;
}

/**
 * 涂鸦笔画类型（DrawTool 使用）
 */
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

/**
 * 滤镜预设类型
 */
export interface FilterPreset {
  id: string;
  label: string;
  filter: string;
  thumbnail?: string;
}

/**
 * 编辑模式类型
 */
export type EditorMode = 'read' | 'edit' | 'reorder' | 'regen';

/**
 * 编辑器状态类型
 */
export interface EditorState {
  currentMode: EditorMode;
  selectedPageId?: string;
  isGenerating: boolean;
  hasUnsavedChanges: boolean;
}
