---
name: web-develop
description: AIrchieve 项目前端开发技能。当处理前端代码（frontend/ 目录）时使用此技能，包括创建组件、页面、功能、UI 改进或任何 React/TypeScript 开发���作。
---

# AIrchieve 前端开发规范

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn/ui) + lucide-react

**重要：使用状态路由，不使用 React Router**

## 目录结构

```
frontend/src/
├── pages/           # 页面组件
├── components/      
│   ├── ui/         # shadcn/ui 基础组件
│   └── editor/     # 编辑器工具
├── services/        # API 调用层
├── contexts/        # 全局状态
├── hooks/           # 自定义 hooks
├── types/           # 类型定义
└── constants/       # 静态数据
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

### 状态管理

**本地状态：**`useState`
**全局状态：**Context API（参考 `AuthContext`）
**��步轮询：**使用 `usePolling` hook

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
