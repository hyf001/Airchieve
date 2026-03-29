---
name: frontend-add-edit-tool
description: 添加新的编辑工具到 AIrchieve 项目的编辑页面。用于创建类似 DrawTool、TextEditTool 等图片编辑工具组件。当用户要求"添加一个XX工具"、"创建一个编辑功能"时使用此技能。
---

# 添加编辑工具到 AIrchieve

此技能指导如何在前端编辑页面添加新的图片编辑工具。

## 项目架构

**文件位置：**
- 编辑器：[EditMode.tsx](../../../frontend/src/pages/editor/EditMode.tsx)
- 工具目录：[frontend/src/components/editor/](../../../frontend/src/components/editor/)
- UI 组件：[frontend/src/components/ui/](../../../frontend/src/components/ui/)

**架构关系：**
```
EditMode (父组件)
  ├─ 管理状态 (activeCanvasTool, 各工具的状态)
  ├─ 协调工具切换和显示
  └─ 保存和页面管理

Tool 组件 (子组件)
  ├─ 工具面板 UI (右侧设置面板)
  ├─ 内部状态管理
  ├─ 编辑逻辑
  └─ 通过回调同步状态到 EditMode

Overlay 组件
  ├─ 在图片上叠加显示编辑内容
  └─ 处理鼠标事件交互
```

**通信机制：**
- Edit Mode → Tool: props 传递数据
- Tool → Edit Mode: 回调函数通知状态变化
- Edit Mode → Overlay: props 传递状态
- 用户 → Overlay → Tool: 鼠标事件 → ref 方法调用

## 工具组件模式

### 1. 组件结构

```typescript
// 1. 数据类型
export interface ToolLayer {
  id: string;
  // 工具特定的数据
}

// 2. Ref 接口（暴露给父组件的方法）
export interface ToolNameRef {
  getLayers: () => ToolLayer[];
  clearLayers: () => void;
  // 其他操作方法
}

// 3. Props 接口
interface ToolNameProps {
  baseImageUrl: string;
  onApply: (imageUrl: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onLayersChange?: (layers: ToolLayer[]) => void;
  // ... 其他状态回调
}

// 4. 使用 forwardRef
const ToolName = forwardRef<ToolNameRef, ToolNameProps>((props, ref) => {
  // 组件实现
  useImperativeHandle(ref, () => ({
    getLayers: () => layers,
    clearLayers: handleClear,
  }), [layers]);

  return <div>工具面板 UI</div>;
});

// 5. 导出 Overlay 组件
export const ToolNameOverlay: React.FC<OverlayProps> = (props) => {
  return <div>叠加层</div>;
};
```

### 2. 状态管理

**内部状态：** 工具内部管理核心状态
```typescript
const [layers, setLayers] = useState<ToolLayer[]>([]);
```

**状态同步：** 通过回调通知父组件
```typescript
useEffect(() => {
  onLayersChange?.(layers);
}, [layers, onLayersChange]);
```

**重要：** 使用 props 回调代替 ref getter
```typescript
// ✅ 正确
onBrushColorChange={setBrushColor}

// ❌ 错误（会导致时序问题）
brushColor={toolRef.current?.getBrushColor()}
```

### 3. 图片处理

所有工具都需要将编辑内容应用到图片：

```typescript
const handleApply = async () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 加载原图
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = baseImageUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('图片加载失败'));
  });

  // 计算缩放
  const container = containerRef?.current;
  const containerWidth = container.getBoundingClientRect().width;
  const scale = img.naturalWidth / containerWidth;

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  // 绘制背景图
  ctx.drawImage(img, 0, 0);

  // 绘制编辑内容（坐标需乘以 scale）
  // ...

  // 导出
  const imageUrl = canvas.toDataURL('image/png');
  onApply(imageUrl);
};
```

## 集成到 EditMode

### 步骤 1: 创建工具组件

在 `frontend/src/components/editor/` 创建新文件，例如：`YourTool.tsx`

**必须包含：**
- ✅ 数据类型定义
- ✅ Ref 接口定义
- ✅ Props 接口（包含 onApply、containerRef、状态回调）
- ✅ 使用 forwardRef
- ✅ 导出 Overlay 组件
- ✅ displayName 设置

### 步骤 2: 更新 EditMode.tsx

**2.1 导入组件：**
```typescript
import YourTool, { YourLayer, YourToolOverlay, YourToolRef } from '../../components/editor/YourTool';
```

**2.2 添加 ref 和状态：**
```typescript
const yourToolRef = useRef<YourToolRef>(null);
const [yourLayers, setYourLayers] = useState<YourLayer[]>([]);
const [selectedYourId, setSelectedYourId] = useState<string | null>(null);
```

**2.3 在图片区域添加 Overlay：**
```typescript
{activeCanvasTool === 'your-tool' && (
  <YourToolOverlay
    layers={yourLayers}
    onLayerMouseDown={(e, layer) => yourToolRef.current?.handleLayerMouseDown?.(e, layer)}
    // ... 其他 props
  />
)}
```

**2.4 在工具面板添加组件：**
```typescript
{activeCanvasTool === 'your-tool' && (
  <YourTool
    ref={yourToolRef}
    baseImageUrl={currentDisplayImage}
    containerRef={canvasRef}
    onLayersChange={setYourLayers}
    onApply={(imageUrl) => handleAIImageGenerated(imageUrl, '工具名称')}
  />
)}
```

**2.5 如果是新工具，在工具列表添加按钮：**
```typescript
{[
  // ... 现有工具
  { id: 'your-tool' as const, label: '工具名称', icon: '🔧' },
].map(tool => (...))}
```

## UI 设计规范

### ⚠️ 使用现有组件库

**项目使用 shadcn/ui**，位于 [frontend/src/components/ui/](../../../frontend/src/components/ui/)

**常用组件：**
```typescript
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
```

**重要原则：**
- ✅ 优先使用 shadcn/ui 组件
- ✅ 使用 Tailwind 类名（不要写 CSS 文件）
- ✅ 只对动态值使用 style 属性
- ❌ 不要创建自定义 CSS 文件
- ❌ 不要使用普通 HTML 元素（如 `<button>`）

### 颜色和样式

```typescript
// 主色
'#00CDD4'  // 用于激活状态、主要按钮

// 文本
text-slate-700  // 主要文本
text-slate-500  // 次要文本
text-slate-400  // 提示文本

// 边框和背景
border-slate-200
bg-white / bg-slate-50
```

### 标准布局

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

  {/* 底部：应用和重置 */}
  <div className="flex gap-3 pt-4 border-t border-slate-200">
    <Button variant="outline" size="sm" className="flex-1">重置</Button>
    <Button size="sm" className="flex-1 bg-[#00CDD4] text-white">应用</Button>
  </div>
</div>
```

### 常见 UI 模式

**颜色选择器：**
```typescript
<div className="grid grid-cols-8 gap-2">
  {COLORS.map(color => (
    <button
      key={color}
      onClick={() => setSelectedColor(color)}
      className={`w-8 h-8 rounded-lg border-2 transition-all ${
        selectedColor === color
          ? 'border-[#00CDD4] scale-110 shadow-md'
          : 'border-slate-200 hover:border-slate-300'
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
      className={`h-10 text-xs ${
        selected === option.value ? 'bg-[#00CDD4] text-white' : 'bg-slate-100'
      }`}
    >
      {option.label}
    </Button>
  ))}
</div>
```

## 注意事项

### Canvas 处理
- ✅ 使用 `crossOrigin = 'anonymous'` 避免 CORS
- ✅ 计算缩放比例：`scale = naturalWidth / containerWidth`
- ✅ 坐标转换：`canvasX = displayX * scale`

### 状态管理
- ✅ 工具内部管理核心状态
- ✅ 通过回调同步到父组件（用于 Overlay）
- ✅ ref 只暴露操作方法，不暴露 getter
- ❌ 避免在 JSX 中调用 ref 方法

### 用户体验
- ✅ 提供撤销、清空功能
- ✅ 提供预览（笔刷、颜色等）
- ✅ 禁用不可用的按钮
- ✅ 加载状态提示

## 检查清单

创建工具后确认：

- [ ] 使用 forwardRef 并导出 Overlay 组件
- [ ] 实现 onApply 回调，正确处理缩放
- [ ] 在 EditMode 中正确集成
- [ ] **使用 shadcn/ui 组件，没用普通 HTML 元素**
- [ ] **没用创建 CSS 文件**
- [ ] 状态通过回调同步，不用 ref getter
- [ ] 提供撤销/清空功能
- [ ] 使用项目主色 #00CDD4
