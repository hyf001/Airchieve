# 编辑器工具架构设计

## 核心原则
- 每个工具**完全独立**，互不影响
- 工具内部管理自己的状态
- 通过 `ref` 暴露方法给外部使用
- 通过回调传递结果给父组件

## 目录结构
```
tools/
├── EditorToolbar.tsx      # 工具栏主组件（包含工具选择器 + 工具面板）
├── ToolSelector.tsx        # 工具选择器（网格按钮）
├── ToolRegistry.tsx        # 工具注册表
├── ToolContext.tsx         # 工具状态管理 Context（可选）
└── tools/
    ├── AIEditTool.tsx      # AI改图工具
    ├── TextEditTool.tsx    # 文字工具
    └── DrawTool.tsx        # 涂鸦工具
```

## 工具接口定义

### 1. 工具组件 Props
```typescript
interface ToolComponentProps {
  storybookId: string | number;
  baseImageUrl: string;       // 当前页面图片 URL
  onPageEdited: (url: string) => void;  // 编辑完成回调
  containerRef?: React.RefObject<HTMLDivElement>;  // 画布容器引用
  // 工具特定的 props...
}
```

### 2. 工具应该导出的内容
```typescript
// 工具组件
const MyTool: React.FC<MyToolProps> = (props) => { ... };

// 工具的 ref 接口（用于外部调用）
interface MyToolRef {
  // 暴露的方法（如获取状态、执行操作等）
  getState: () => MyState;
  doSomething: () => void;
}

// 工具的 Overlay 组件（可选，用于在画布上显示交互层）
const MyToolOverlay: React.FC<MyOverlayProps> = (props) => { ... };

export default MyTool;
export type { MyToolRef, MyToolOverlay };
```

## 使用示例

### EditorView.tsx
```typescript
// 创建 ref 和状态
const textEditToolRef = useRef<TextEditToolRef>(null);
const [textLayers, setTextLayers] = useState<TextLayer[]>([]);

// 渲染工具栏
<EditorToolbar
  storybookId={storybook.id}
  baseImageUrl={currentPage.image_url}
  onPageEdited={(imageUrl) => {
    // 处理编辑完成
    console.log('图片编辑完成:', imageUrl);
  }}
  containerRef={canvasRef}
  textEditToolRef={textEditToolRef}
  onLayersChange={setTextLayers}
/>

// 渲染画布（包含 overlay）
<div ref={canvasRef} className="relative">
  <img src={currentPage.image_url} />
  {activeTool === 'text' && (
    <TextEditToolOverlay
      layers={textLayers}
      // ... 其他 props
    />
  )}
</div>
```

### TextEditTool.tsx
```typescript
// 管理自己的状态
const [layers, setLayers] = useState<TextLayer[]>([]);

// 通过 ref 暴露方法
useImperativeHandle(ref, () => ({
  getLayers: () => layers,
  updateLayer: (id, updates) => { ... },
  deleteLayer: (id) => { ... },
}), [layers]);

// 通过回调通知父组件状态变化
useEffect(() => {
  props.onLayersChange?.(layers);
}, [layers]);

// 渲染设置面板
return (
  <div className="tool-panel">
    {/* 工具设置界面 */}
  </div>
);
```

## 工具之间的独立性

### ✅ 正确示例
```typescript
// TextEditTool 管理自己的文字图层状态
const TextEditTool = () => {
  const [layers, setLayers] = useState<TextLayer[]>([]);
  // 只关心文字相关的事情
};

// DrawTool 管理自己的笔画状态
const DrawTool = () => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // 只关心涂鸦相关的事情
};
```

### ❌ 错误示例
```typescript
// 不要在工具栏组件中管理所有工具的状态
const EditorToolbar = () => {
  const [textLayers, setTextLayers] = useState([]);  // ❌
  const [drawStrokes, setDrawStrokes] = useState([]);  // ❌
  const [filterConfig, setFilterConfig] = useState({});  // ❌
  // 这会让代码变得复杂且难以维护
};
```

## 优势

1. **模块化**：每个工具是独立的模块，可以单独开发和测试
2. **可维护性**：修改一个工具不会影响其他工具
3. **可扩展性**：添加新工具只需创建新组件并注册
4. **代码简洁**：每个工具只关注自己的功能

## 当前需要调整的地方

1. `TextEditTool` - 需要简化，去掉不必要的状态传递
2. `DrawTool` - 同上
3. `EditorCanvas` - 只负责显示图片和 overlay，不管理工具状态
4. `EditorToolbar` - 只负责切换工具和显示工具面板
