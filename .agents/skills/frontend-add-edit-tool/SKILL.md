---
name: frontend-add-edit-tool
description: 添加新的编辑工具到 AIrchieve 项目的编辑页面。用于创建类似 DrawTool、TextEditTool 等图片编辑工具组件。当用户要求"添加一个XX工具"、"创建一个编辑功能"时使用此技能。
---

# 添加编辑工具到 AIrchieve

此技能指导如何在前端编辑页面添加新的图片编辑工具。

## 项目架构

**文件位置：**
- 编辑器主页面：[EditorView.tsx](../../../frontend/src/pages/EditorView.tsx)
- 画布组件：[EditorCanvas.tsx](../../../frontend/src/components/editor/EditorCanvas.tsx)
- 工具目录：[frontend/src/components/editor/tools/](../../../frontend/src/components/editor/tools/)
- 工具类型定义：[frontend/src/types/tool.ts](../../../frontend/src/types/tool.ts)
- UI 组件：[frontend/src/components/ui/](../../../frontend/src/components/ui/)

**目录结构：**
```
tools/
├── EditorToolbar.tsx      # 简化版工具栏（仅包含选择器 + 面板）
├── ToolSelector.tsx        # 工具选择器（网格按钮）
├── ToolRegistry.tsx        # 工具注册表（注册所有工具的配置）
├── ToolContext.tsx          # 工具状态 Context（可选）
├── ToolPanel.tsx           # 工具面板容器（动态渲染活跃工具）
├── draw/                   # 涂鸦笔工具（已实现）
│   ├── index.tsx           # Panel 组件 + 导出
│   ├── types.ts            # 类型定义
│   ├── hooks.ts            # 自定义 hooks + 常量
│   └── Overlay.tsx         # 画布叠加层
├── text-edit/              # 文字工具（已实现）
│   ├── index.tsx           # Panel 组件 + 导出
│   ├── types.ts            # 类型定义
│   ├── hooks.ts            # 自定义 hooks + 常量
│   └── Overlay.tsx         # 画布叠加层
└── [your-tool]/            # 新工具目录（待创建）
    ├── index.tsx
    ├── types.ts
    ├── hooks.ts
    └── Overlay.tsx
```

**架构关系：**
```
EditorView (页面级)
  ├─ useToolManager() hook → activeTool 状态
  ├─ EditorCanvas → 画布 + Overlay 渲染
  ├─ ToolPanelWithSelector → 工具选择器 + 工具面板
  │   ├─ ToolSelector → 工具网格按钮
  │   └─ ToolPanel → 动态渲染活跃工具的 Panel 组件
  │       └─ ToolRegistry → 查找工具配置
  └─ 各工具的状态通过 props 回调同步到 EditorView

工具内部结构（以 text-edit 为例）：
  text-edit/
    ├─ types.ts        → 数据类型 (Layer, Ref, State)
    ├─ hooks.ts        → 状态管理 hooks + 常量
    ├─ index.tsx       → Panel 组件 (forwardRef) + 导出 { Panel, Overlay }
    └─ Overlay.tsx     → 画布叠加层组件
```

**通信机制：**
- EditorView → ToolPanel: `activeTool`、`baseImageUrl`、`onPageEdited`、`containerRef`
- ToolPanel → EditorView: 状态回调 (如 `onLayersChange`、`onIsDraggingChange`)
- EditorView → EditorCanvas: 工具状态 props (如 `textLayers`、`isDragging`)
- EditorCanvas → Overlay: 直接渲染 Overlay 组件，事件通过 ref 方法回调
- Overlay → Tool Panel: 通过 `textEditToolRef.current?.handleXxx()` 调用 Panel 暴露的方法

## 工具组件模式

每个工具遵循统一的 **4 文件模式**：

### 1. types.ts — 类型定义

```typescript
// 工具特有的数据结构
export interface YourLayer {
  id: string;
  // 工具特定的字段...
}

// Ref 接口 — 暴露给外部（EditorCanvas 的 Overlay）调用的方法
export interface YourToolRef {
  getLayers: () => YourLayer[];
  // 操作方法（供 Overlay 回调）
  handleSomething: (e: React.MouseEvent, layer: YourLayer) => void;
  updateLayer: (id: string, updates: Partial<YourLayer>) => void;
  deleteLayer: (id: string) => void;
}

// 状态接口（可选，用于描述工具状态）
export interface YourToolState {
  layers: YourLayer[];
  // 其他状态字段...
}
```

### 2. hooks.ts — 状态管理 Hook + 常量

```typescript
import { useState, useCallback, useEffect } from 'react';
import { YourLayer } from './types';

// 核心 Hook — 管理工具状态和操作
export const useYourLayers = () => {
  const [layers, setLayers] = useState<YourLayer[]>([]);
  // 其他状态...

  // 操作方法
  const updateLayer = useCallback((id: string, updates: Partial<YourLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  }, []);

  // 清空
  const clearLayers = useCallback(() => {
    setLayers([]);
  }, []);

  // 撤销
  const undoLast = useCallback(() => {
    setLayers(prev => prev.slice(0, -1));
  }, []);

  return {
    layers, setLayers,
    updateLayer, deleteLayer,
    clearLayers, undoLast,
    // 其他状态和方法...
  };
};

// 常量
export const YOUR_PRESETS = [
  // 选项列表...
];
```

### 3. Overlay.tsx — 画布叠加层

在画布图片上叠加显示交互内容，接收 props 渲染。

```typescript
import React from 'react';
import { YourLayer } from './types';

interface YourOverlayProps {
  layers: YourLayer[];
  selectedLayerId: string | null;
  // 状态标志
  isDragging?: boolean;
  isResizing?: boolean;
  // 事件回调（由 Overlay 调用，实际处理在 Panel 的 ref 方法中）
  onLayerMouseDown: (e: React.MouseEvent, layer: YourLayer) => void;
  onDeleteLayer: (id: string) => void;
  onLayerClick: (id: string) => void;
  // 其他工具特定的回调...
}

export const YourOverlay: React.FC<YourOverlayProps> = ({
  layers,
  selectedLayerId,
  onLayerMouseDown,
  onDeleteLayer,
  onLayerClick,
}) => {
  return (
    <>
      {layers.map(layer => {
        const isSelected = selectedLayerId === layer.id;
        return (
          <div
            key={layer.id}
            data-your-layer="true"
            style={{
              position: 'absolute',
              left: layer.x,
              top: layer.y,
              // ... 定位和样式
              outline: isSelected ? '2px solid #00CDD4' : 'none',
            }}
            onMouseDown={(e) => onLayerMouseDown(e, layer)}
            onClick={() => onLayerClick(layer.id)}
          >
            {/* 图层内容 */}
            {isSelected && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 ..."
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

export default YourOverlay;
```

### 4. index.tsx — Panel 组件 + 导出

**使用 forwardRef 暴露方法，导出 `{ Panel, Overlay }` 对象。**

```typescript
import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { YourToolRef, YourLayer } from './types';
import { useYourLayers, YOUR_PRESETS } from './hooks';
import { YourOverlay } from './Overlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface YourPanelProps {
  baseImageUrl: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  // 状态回调（通知 EditorView，用于传递给 EditorCanvas/Overlay）
  onLayersChange?: (layers: YourLayer[]) => void;
  // 其他工具特定的回调...
}

const YourPanel = forwardRef<YourToolRef, YourPanelProps>(({
  baseImageUrl,
  onApply,
  containerRef,
  onLayersChange,
}, ref) => {
  const {
    layers,
    updateLayer, deleteLayer,
    clearLayers, undoLast,
  } = useYourLayers();

  const [isApplying, setIsApplying] = useState(false);
  const selectedLayer = layers.find(l => l.id === selectedLayerId);
  const hasChanges = layers.length > 0;

  // 通知父组件状态变化（关键！Overlay 需要这些数据）
  useEffect(() => {
    onLayersChange?.(layers);
  }, [layers, onLayersChange]);

  // 应用编辑到图片
  const handleApply = async () => {
    if (isApplying || !hasChanges) return;
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
      const containerWidth = container.getBoundingClientRect().width;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const scale = img.naturalWidth / containerWidth;

      // 绘制背景图
      ctx.drawImage(img, 0, 0);

      // 绘制编辑内容（坐标需乘以 scale）
      // ...

      const imageUrl = canvas.toDataURL('image/png');
      onApply(imageUrl);
    } catch (error) {
      console.error('应用失败:', error);
      throw error;
    } finally {
      setIsApplying(false);
    }
  };

  // 暴露方法给父组件（供 EditorCanvas 的 Overlay 回调调用）
  useImperativeHandle(ref, () => ({
    getLayers: () => layers,
    updateLayer,
    deleteLayer,
    // 其他操作方法...
  }), [layers, updateLayer, deleteLayer]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部：标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">工具名称</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={undoLast} disabled={!hasChanges} className="h-8 w-8 p-0">
            <Undo size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearLayers} disabled={!hasChanges}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Tab 内容 */}
      <Tabs defaultValue="tab1" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="tab1">标签1</TabsTrigger>
          <TabsTrigger value="tab2">标签2</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="tab1" className="space-y-4 mt-0">
            {/* 工具设置内容 */}
          </TabsContent>
        </div>
      </Tabs>

      {/* 底部：应用按钮 */}
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

YourPanel.displayName = 'YourPanel';

// 导出工具对象 — 必须同时导出 Panel 和 Overlay
export const YourTool = {
  Panel: YourPanel,
  Overlay: YourOverlay,
};

export default YourTool;
```

## 集成步骤

### 步骤 1: 创建工具文件

在 `frontend/src/components/editor/tools/your-tool/` 下创建 4 个文件：
- `types.ts` — 数据类型
- `hooks.ts` — 状态 Hook + 常量
- `Overlay.tsx` — 画布叠加层
- `index.tsx` — Panel 组件 + 导出

### 步骤 2: 注册工具 ID

在 [frontend/src/types/tool.ts](../../../frontend/src/types/tool.ts) 的 `ToolId` 类型中添加新 ID：

```typescript
export type ToolId =
  | 'ai-edit'
  | 'text'
  // ... 现有工具
  | 'your-tool';  // 新增
```

### 步骤 3: 注册工具配置

在 [ToolRegistry.tsx](../../../frontend/src/components/editor/tools/ToolRegistry.tsx) 中：

```typescript
import { YourTool } from './your-tool';

// 在 TOOL_REGISTRY 中添加
'your-tool': {
  id: 'your-tool',
  label: '工具名称',
  icon: '🔧',
  category: 'basic',  // 或 'advanced' / 'creative'
  Panel: YourTool.Panel,
  Overlay: YourTool.Overlay,
  component: YourTool.Panel as any,
  description: '工具描述',
},
```

在 `getAllTools()` 的 `order` 数组中添加 `'your-tool'` 到合适位置。

### 步骤 4: 更新 ToolPanel.tsx

在 [ToolPanel.tsx](../../../frontend/src/components/editor/tools/ToolPanel.tsx) 的 `getToolProps()` 中为新工具准备 props：

```typescript
if (activeTool === 'your-tool') {
  return {
    ...baseProps,
    onApply: onPageEdited,
    containerRef,
    // 工具特定的状态回调...
  };
}
```

### 步骤 5: 更新 EditorCanvas.tsx

在 [EditorCanvas.tsx](../../../frontend/src/components/editor/EditorCanvas.tsx) 中：

1. 导入 Overlay 组件和类型
2. 在 `EditorCanvasProps` 中添加工具相关的 props
3. 在画布区域渲染 Overlay

```typescript
import { YourOverlay } from './tools/your-tool/Overlay';

// 在 canvasRef div 内，现有 overlay 旁边添加
{activeTool === 'your-tool' && yourLayers.length > 0 && yourToolRef?.current && (
  <YourOverlay
    layers={yourLayers}
    onLayerMouseDown={(e, layer) => yourToolRef.current?.handleLayerMouseDown(e, layer)}
    onDeleteLayer={(id) => yourToolRef.current?.deleteLayer(id)}
    // ... 其他 props
  />
)}
```

### 步骤 6: 更新 EditorView.tsx

在 [EditorView.tsx](../../../frontend/src/pages/EditorView.tsx) 中：

1. 导入 ref 类型和 Overlay 组件
2. 创建 ref 和状态
3. 传递给 EditorCanvas 和 ToolPanelWithSelector

```typescript
import { YourToolRef, YourLayer } from '../components/editor/tools/your-tool/types';

const yourToolRef = useRef<YourToolRef>(null);
const [yourLayers, setYourLayers] = useState<YourLayer[]>([]);

// 传递给 EditorCanvas
<EditorCanvas
  yourToolRef={yourToolRef}
  yourLayers={yourLayers}
  // ...
/>

// 传递给 ToolPanelWithSelector
<ToolPanelWithSelector
  yourToolRef={yourToolRef}
  onYourLayersChange={setYourLayers}
  // ...
/>
```

## UI 设计规范

### 使用 shadcn/ui 组件

项目使用 shadcn/ui，位于 [frontend/src/components/ui/](../../../frontend/src/components/ui/)

```typescript
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
```

**重要原则：**
- 优先使用 shadcn/ui 组件
- 使用 Tailwind 类名（不创建 CSS 文件）
- 只对动态值使用 style 属性

### 颜色和样式

```typescript
// 主色
'#00CDD4'  // 用于激活状态、主要按钮、选中边框

// 文本层级
text-slate-700  // 主要文本
text-slate-500  // 次要文本/标签
text-slate-400  // 提示文本

// 边框和背景
border-slate-200
bg-white / bg-slate-50
```

### 标准 Panel 布局

```typescript
<div className="h-full flex flex-col">
  {/* 顶部：标题 + 操作按钮 */}
  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
    <span className="text-xs font-medium text-slate-500">工具名称</span>
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Undo size={14} /></Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Trash2 size={14} /></Button>
    </div>
  </div>

  {/* 中部：Tab 内容 */}
  <Tabs defaultValue="tab1" className="flex-1 flex flex-col overflow-hidden">
    <TabsList className="grid grid-cols-2 w-full mb-4">
      <TabsTrigger value="tab1">标签1</TabsTrigger>
      <TabsTrigger value="tab2">标签2</TabsTrigger>
    </TabsList>
    <div className="flex-1 overflow-y-auto">
      <TabsContent value="tab1" className="space-y-4 mt-0">
        {/* 内容 */}
      </TabsContent>
    </div>
  </Tabs>

  {/* 底部：应用按钮 */}
  <div className="pt-4 border-t border-slate-200">
    <Button size="sm" className="w-full bg-[#00CDD4] hover:bg-[#00b8be] text-white">应用</Button>
  </div>
</div>
```

### 常见 UI 模式

**颜色选择器：**
```typescript
<div className="grid grid-cols-6 gap-2">
  {COLORS.map(color => (
    <button
      key={color}
      onClick={() => setSelectedColor(color)}
      className={`w-9 h-9 rounded-lg border-2 transition-all ${
        selectedColor === color
          ? 'border-[#00CDD4] scale-110 shadow-md ring-2 ring-[#00CDD4]/20'
          : 'border-slate-200 hover:border-slate-300 hover:scale-105'
      }`}
      style={{ backgroundColor: color }}
    />
  ))}
</div>
```

**选项网格：**
```typescript
<div className="grid grid-cols-5 gap-2">
  {OPTIONS.map(option => (
    <Button
      key={option.value}
      variant={selected === option.value ? "default" : "outline"}
      onClick={() => setSelected(option.value)}
      className={`h-8 text-xs font-medium transition-all ${
        selected === option.value
          ? 'bg-[#00CDD4] text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {option.label}
    </Button>
  ))}
</div>
```

**滑块控件：**
```typescript
<div>
  <Label className="text-xs text-slate-500 mb-2 flex items-center justify-between">
    <span>标签</span>
    <span className="font-mono font-medium text-[#00CDD4]">{value}px</span>
  </Label>
  <input
    type="range"
    min={12}
    max={120}
    value={value}
    onChange={e => setValue(Number(e.target.value))}
    className="w-full accent-[#00CDD4] h-2"
  />
</div>
```

## 简化模式（仅 Panel 工具）

不是所有工具都需要完整的 4 文件结构和 Overlay。对于纯面板工具（如 `regenerate`），只需一个 `index.tsx` 文件：

```typescript
// tools/your-tool/index.tsx
import React, { useState, useCallback } from 'react';

interface YourPanelProps {
  storybookId: string | number;
  pageId?: number;
  onPageEdited?: (result: any) => void;
}

const YourPanel: React.FC<YourPanelProps> = ({ storybookId, pageId, onPageEdited }) => {
  return (
    <div className="h-full flex flex-col">
      {/* 面板内容 */}
    </div>
  );
};

export const YourTool = {
  Panel: YourPanel,
};

export default YourTool;
```

**判断依据：**
- 需要在画布图片上交互（拖拽、绘制、点击定位）→ 使用完整 4 文件模式 + Overlay
- 只在右侧面板中操作（表单、按钮、API 调用）→ 使用简化模式，只需 index.tsx

## 注意事项

### Canvas 处理
- 使用 `crossOrigin = 'anonymous'` 避免 CORS
- 缩放比例：`scale = img.naturalWidth / containerWidth`
- 坐标转换：`canvasX = displayX * scale`
- 图片加载需要 error 处理

### 状态管理
- 工具内部通过 hooks 管理核心状态
- 通过 `useEffect` + 回调通知父组件状态变化（Overlay 需要这些数据）
- `useImperativeHandle` 暴露操作方法供 Overlay 回调
- `baseImageUrl` 变化时应在 hook 中重置状态（参见 `useDrawStrokes`）

### 集成要点
- **ToolRegistry 注册**：必须同时设置 `Panel`、`Overlay` 和 `component`
- **ToolPanel props 映射**：在 `getToolProps()` 中为新工具准备正确的 props
- **EditorCanvas Overlay 渲染**：需要检查 `activeTool`、`layers.length > 0`、`ref.current` 三个条件
- **EditorView 状态桥接**：创建 ref + 状态，分别传给 EditorCanvas 和 ToolPanelWithSelector

### 用户体验
- 提供撤销、清空功能
- 禁用不可用的按钮（`disabled={!hasChanges}`）
- 加载状态提示（`isApplying`）

## 检查清单

创建工具后确认：

- [ ] 4 文件结构完整（types.ts、hooks.ts、Overlay.tsx、index.tsx）
- [ ] `index.tsx` 使用 `forwardRef` 并导出 `{ Panel, Overlay }` 对象
- [ ] `ToolId` 类型中添加了新 ID
- [ ] `ToolRegistry` 中注册了工具配置（Panel、Overlay、component）
- [ ] `getAllTools()` 的 order 中添加了新工具
- [ ] `ToolPanel.getToolProps()` 中为新工具准备了 props
- [ ] `EditorCanvas` 中渲染了 Overlay（带条件检查）
- [ ] `EditorView` 中创建了 ref + 状态并传递
- [ ] `handleApply` 正确处理了图片缩放
- [ ] 状态通过回调同步（Overlay 能获取到最新数据）
- [ ] 使用 shadcn/ui 组件和 Tailwind 类名
- [ ] 使用项目主色 `#00CDD4`
- [ ] 提供撤销/清空功能
