---
name: frontend-develop
description: AIrchieve 项目前端开发技能。当处理前端代码（frontend/ 目录）时使用此技能，包括创建组件、页面、功能、UI 改进或任何 React/TypeScript 开发工作。
---

# AIrchieve 前端开发规范

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn/ui) + lucide-react

**重要：使用状态路由，不使用 React Router**

## 目录结构

```
frontend/src/
├── pages/               # 页面组件
│   ├── HomeView.tsx     # 首页（绘本列表）
│   ├── EditorView.tsx   # 编辑器主页面
│   └── editor/          # 编辑器子页面
├── components/
│   ├── ui/             # shadcn/ui 基础组件（见下方列表）
│   └── editor/         # 编辑器组件
│       ├── EditorCanvas.tsx    # 画布
│       ├── EditorHeader.tsx    # 顶部栏
│       ├── PageNavigator.tsx   # 页面导航
│       ├── StorybookList.tsx   # 绘本列表
│       ├── dialogs/            # 弹窗组件
│       └── tools/              # 编辑工具系统
│           ├── ToolRegistry.tsx  # 工具注册表
│           ├── ToolPanel.tsx     # 工具面板容器
│           ├── ToolSelector.tsx  # 工具选择器
│           ├── ai-edit/          # AI 改图工具
│           ├── draw/             # 涂鸦笔工具
│           ├── text-edit/        # 文字编辑工具
│           └── regenerate/       # AI 调整页面工具
├── services/            # API 调用层
├── contexts/            # 全局状态（AuthContext）
├── hooks/               # 自定义 hooks
│   ├── usePolling.ts   # 异步轮询 hook
│   ├── useStorybookLoader.ts  # 绘本数据加载
│   ├── useEditorState.ts      # 编辑器状态
│   └── useToolManager.ts      # 工具状态管理
├── types/               # TypeScript 类型定义
└── constants/           # 静态数据
```

## 编码规范

### 组件模板

```tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  title: string;
  onAction?: () => void;
}

const ComponentName: React.FC<Props> = ({ title, onAction }) => {
  const [state, setState] = useState('');

  const handleClick = useCallback(() => {
    onAction?.();
  }, [onAction]);

  return (
    <div className="p-4">
      <Button onClick={handleClick}>{title}</Button>
    </div>
  );
};

export default ComponentName;
```

**要点：**
- 使用 `React.FC` 和接口定义 props
- 可选 props 使用 `?` 并提供默认值
- 事件处理器用 `useCallback`
- 导出时使用 `export default`

### 暴露方法的组件（Forward Ref）

```tsx
export interface Ref {
  doSomething: () => void;
}

interface Props {
  onChange?: (value: string) => void;
}

const Component = forwardRef<Ref, Props>((props, ref) => {
  useImperativeHandle(ref, () => ({
    doSomething: () => {}
  }));
  return <div>...</div>;
});
Component.displayName = 'Component';
export default Component;
```

### Service 层模板

```tsx
const API_BASE = "/api/v1/resource";
import { getAuthHeaders } from "./authService";

export interface Data { id: number; name: string; }

export const createItem = async (req: CreateRequest): Promise<Data> => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("请先登录");
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "创建失败");
  }
  return res.json();
};
```

**要点：**
- 使用 async/await
- 类型化所有请求和响应
- 处理 401 触发登录弹窗
- 使用 `getAuthHeaders()` 处理认证
- 积分不足场景使用 `InsufficientPointsError`（从 storybookService 导入）

### 状态管理

- **本地状态：** `useState`
- **全局状态：** Context API（参考 `AuthContext`）
- **异步轮询：** 使用 `usePolling` hook（见下方）
- **编辑器状态：** 使用 `useEditorState` hook

### 异步轮询模式

```tsx
import { usePolling } from '@/hooks/usePolling';

const { start: startPolling, stop: stopPolling } = usePolling(
  async (id: number) => {
    const res = await fetch(`/api/v1/storybooks/${id}`, { headers: getAuthHeaders() });
    return res.json();
  },
  async (data) => {
    setCurrentStorybook(data);
    if (data.status === 'finished' || data.status === 'error' || data.status === 'terminated') {
      return { stop: true };
    }
    return { stop: false };
  }
);
```

## UI 组件库

### 可用的 shadcn/ui 组件

**已安装的组件（`@/components/ui/`）：**
- `button` - 按钮（支持 variant: default/outline/ghost/gradient/gradient-emerald/destructive）
- `dialog` - 对话框（Dialog/DialogContent/DialogHeader/DialogTitle/DialogFooter）
- `dropdown-menu` - 下拉菜单
- `input` - 输入框
- `label` - 标签
- `select` - 选择器
- `switch` - 开关
- `tabs` - 标签页（Tabs/TabsList/TabsTrigger/TabsContent）
- `textarea` - 多行输入
- `tooltip` - 提示
- `badge` - 徽章
- `checkbox` - 复选框（`checked` + `onCheckedChange` API）
- `toast` - 提示消息（通过 `useToast` hook 使用）

## 样式规范

### 品牌色

- 主色：`#00CDD4`（青色）
- 背景：`#061428`（夜空）
- 文字：`#e2e8f0`

### 常用类

```tsx
// 玻璃卡片
<div className="glass-card rounded-lg p-6">内容</div>

// 渐变按钮
<Button variant="gradient">渐变</Button>
<Button variant="gradient-emerald">翠绿</Button>

// 布局
className="h-screen flex flex-col items-center justify-center"
className="overflow-auto"  // 可滚动
className="overflow-hidden"  // 不可滚动
```

### 内置组件

```tsx
import LoadingSpinner from '@/components/LoadingSpinner';
<LoadingSpinner size={48} text="加载中..." />

import { useToast } from '@/hooks/use-toast';
const { toast } = useToast();
toast({ variant: "destructive", title: "错误", description: "详情" });
```

## 路由模式

**使用状态路由，不使用 React Router**

```tsx
// App.tsx
const [showProfile, setShowProfile] = useState(false);
const [currentId, setCurrentId] = useState<number>();

// 条件渲染
{showProfile ? (
  <ProfileView onBack={() => setShowProfile(false)} />
) : (
  <HomeView onStart={(id) => setCurrentId(id)} />
)}
```

## 编辑器工具系统

编辑器使用模块化工具架构，每种工具注册到 `ToolRegistry`。

**工具类型（`types/tool.ts`）：**
- `ai-edit` — AI 改图（有 Overlay）
- `regenerate` — AI 调整页面（仅 Panel，无 Overlay）
- `text` — 文字编辑（有 Overlay，使用 forwardRef）
- `draw` — 涂鸦笔（有 Overlay）

**集成流程：**
1. 在 `types/tool.ts` 的 `ToolId` 中添加新 ID
2. 在 `ToolRegistry.tsx` 中注册工具配置
3. 在 `ToolPanel.tsx` 的 `getToolProps()` 中为新工具准备 props
4. 如需 Overlay，在 `EditorCanvas.tsx` 和 `EditorView.tsx` 中集成

**不是所有工具都需要完整的 4 文件结构。** 简单面板工具（如 regenerate）只需一个 `index.tsx` 即可。

详细工具创建流程参考 `frontend-add-edit-tool` 技能。

## 页面类型

编辑器中的页面有三种类型（`PageType`）：

- `cover` — 封面（page_index = 0）
- `content` — 正文页（page_index 1..N）
- `back_cover` — 封底（page_index N+1，固定底图，不可 AI 重新生成）

```tsx
import { PageType } from '@/services/storybookService';
```

## 常用模式

### 异步操作

```tsx
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  try {
    setLoading(true);
    await apiCall();
  } catch (err) {
    toast({ variant: "destructive", title: err.message });
  } finally {
    setLoading(false);
  }
};
```

### 积分不足处理

```tsx
import { InsufficientPointsError } from '@/services/storybookService';

try {
  await somePaidAction();
} catch (err) {
  if (err instanceof InsufficientPointsError) {
    toast({ variant: 'destructive', title: '积分不足', description: err.message });
  } else {
    toast({ variant: 'destructive', title: '操作失败', description: err instanceof Error ? err.message : undefined });
  }
}
```

### 表单处理

```tsx
const [formData, setFormData] = useState({ name: '' });

const handleChange = (field: string) => (value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

### 空状态列表

```tsx
{loading ? (
  <LoadingSpinner size={32} />
) : items.length === 0 ? (
  <div className="text-center text-slate-400 py-8">暂无数据</div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => <div key={item.id}>{item.name}</div>)}
  </div>
)}
```

### 认证

```tsx
import { useAuth } from '@/contexts/AuthContext';
const { user, logout, openLoginModal } = useAuth();

if (!user) {
  openLoginModal();
  return;
}
```

### 图片处理

```tsx
// OSS 图片必须转换 URL 避免跨域
import { toApiUrl } from '@/services/storybookService';
<img src={toApiUrl(imageUrl)} alt="" />
```

## 文件命名

- 组件：PascalCase（如 `UserProfileView.tsx`）
- 服务：camelCase（如 `storybookService.ts`）
- Hooks：camelCase + use 前缀（如 `usePolling.ts`）

## TypeScript 规范

- 总是为 props 定义接口
- 避免使用 `any`，使用 `unknown`
- API 响应必须有类型定义
- 使用类型守卫进行运行时检查

## 性能优化

- 传递给子组件的函数使用 `useCallback`
- 昂贵计算使用 `useMemo`
- 搜索输入使用防抖
- 避免在 JSX 中使用内联函数
