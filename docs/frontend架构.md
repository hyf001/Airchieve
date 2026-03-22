# 前端项目架构文档

## 项目概览

AI 绘本创作平台前端，用户可通过自然语言指令生成、编辑、管理绘本故事书。

- **项目名**: `dreamweave-ai-storybook`
- **开发端口**: 3000（代理到后端 8000）
- **构建工具**: Vite 6

---

## 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19 |
| 语言 | TypeScript | 5.8 |
| 构建 | Vite | 6 |
| 样式 | Tailwind CSS | 3.4 |
| UI 组件 | Radix UI + shadcn/ui 风格 | — |
| 图标 | Lucide React | 0.563 |
| 路由 | React Router DOM | 7（仅用于路径别名，实际用状态路由） |
| PDF | jsPDF | 4 |
| AI 视觉 | @google/genai, @mediapipe/tasks-vision | — |
| 背景消除 | @imgly/background-removal | 1.7 |

---

## 目录结构

```
frontend/
├── src/
│   ├── main.tsx                  # 应用入口
│   ├── App.tsx                   # 根组件，状态路由控制器
│   ├── index.css                 # 全局样式
│   ├── vite-env.d.ts             # Vite 环境变量类型
│   ├── mediapipe.d.ts            # MediaPipe 类型声明
│   │
│   ├── types/
│   │   └── index.ts              # 全局基础类型（StoryPage, StoryTemplate, ChatMessage）
│   │
│   ├── constants/
│   │   └── index.tsx             # 静态数据（TEMPLATES 绘本风格列表）
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx       # 认证全局上下文（用户状态、登录弹窗控制）
│   │
│   ├── hooks/
│   │   ├── usePolling.ts         # 通用轮询 Hook（5s 间隔，自动清理）
│   │   └── use-toast.ts          # Toast 消息 Hook
│   │
│   ├── services/                 # API 层（纯函数，fetch 封装）
│   │   ├── authService.ts        # 认证、用户、管理员 API
│   │   ├── storybookService.ts   # 绘本 CRUD、页面操作、PDF 导出
│   │   ├── templateService.ts    # 模板 API
│   │   └── paymentService.ts     # 支付 API
│   │
│   ├── pages/                    # 页面级组件
│   │   ├── HomeView.tsx          # 首页（创建入口）
│   │   ├── EditorView.tsx        # 编辑器主页（绘本列表 + 工作区）
│   │   ├── TemplatesView.tsx     # 模板库
│   │   ├── UserProfileView.tsx   # 用户中心
│   │   ├── UserManagementView.tsx # 管理后台
│   │   └── editor/               # EditorView 的子模式组件
│   │       ├── ReadMode.tsx       # 阅读模式
│   │       ├── EditMode.tsx       # 编辑页模式
│   │       ├── ReorderMode.tsx    # 排序模式
│   │       ├── RegenMode.tsx      # 继续创作模式
│   │       ├── CoverMode.tsx      # 封面生成模式
│   │       ├── BackCoverMode.tsx  # 封底生成模式
│   │       └── back_cover_templates/ # 封底模板
│   │
│   ├── components/               # 通用组件
│   │   ├── CanvasEditor/         # Canvas 图片编辑器
│   │   │   ├── CanvasEditorModal.tsx
│   │   │   ├── CanvasStage.tsx
│   │   │   ├── LayerItem.tsx
│   │   │   ├── types.ts          # 图层、滤镜类型定义
│   │   │   ├── useCanvasExport.ts
│   │   │   └── tools/            # 工具面板（头像换脸、贴纸、文字、滤镜）
│   │   ├── ConfirmDialog.tsx
│   │   ├── InstructionInputBox.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── LoginModal.tsx
│   │   ├── ProgressCaterpillar.tsx
│   │   ├── StorybookPreview.tsx
│   │   └── ui/                   # shadcn/ui 风格基础组件
│   │       ├── button.tsx, badge.tsx, dialog.tsx
│   │       ├── input.tsx, label.tsx, select.tsx
│   │       ├── tabs.tsx, textarea.tsx, tooltip.tsx
│   │       ├── dropdown-menu.tsx
│   │       └── toast.tsx, toaster.tsx, toast-provider.tsx
│   │
│   └── lib/
│       └── utils.ts              # cn() 工具函数（clsx + tailwind-merge）
│
├── public/                       # 静态资源（watermark.png 等）
├── index.html                    # HTML 入口
├── vite.config.ts                # Vite 配置
├── tailwind.config.js            # Tailwind 配置
├── tsconfig.json                 # TypeScript 配置
└── package.json
```

---

## 架构设计

### 路由方式

项目**不使用 React Router 的 URL 路由**，而是用 `App.tsx` 中的 `useState` 控制当前视图（状态路由）：

```
App
├── HomeView          (默认)
├── EditorView        (currentStorybookId 不为空)
├── TemplatesView     (showMyTemplates)
├── UserProfileView   (showProfile)
└── UserManagementView (showAdmin)
```

### 状态管理

无 Redux / Zustand，完全使用 React 内置能力：
- **全局状态**: `AuthContext`（认证信息、登录弹窗）
- **页面级状态**: 各 View 组件内 `useState`
- **跨组件通信**: props 回调（`onBack`, `onStorybookChange` 等）

### 认证机制

1. Token 存储在 `localStorage`（key: `auth_token`, `auth_user`）
2. 启动时自动调用 `/api/v1/users/me` 验证 token 有效性
3. Service 层检测到 401 时调用 `triggerUnauthorized()` → 自动弹登录框
4. 登录支持：账号密码、手机验证码、微信扫码

### 异步绘本生成（轮询模式）

绘本创建/编辑为异步操作：
1. 前端发起请求，后端立即返回 `status: "creating"` + `storybookId`
2. 前端启动 `usePolling`（每 5 秒轮询 `GET /api/v1/storybooks/{id}`）
3. 轮询结果判断：`finished / error / terminated` 时停止
4. 新页生成时 toast 提示，自动跳转到最新页

```
usePolling(getStorybook, onResult)
  → fetchFn(id) 每 5s 调用一次
  → onResult 返回 { stop: true } 时停止
  → 组件卸载自动清理
```

### API 层设计

所有 API 调用封装在 `src/services/` 目录，规范如下：

- 使用原生 `fetch`，无 axios 依赖
- 路径别名统一：`const API_BASE = "/api/v1/storybooks"`
- 统一错误处理：`handleWriteError()` 处理 401 / 402 / 业务错误
- 认证头：`getAuthHeaders()` 返回 `{ Authorization: "Bearer xxx" }`
- OSS 图片 CORS：`toApiUrl()` 将 OSS 直链转换为 `/api/v1/oss/...` 代理路径

---

## 核心数据类型

```typescript
// 绘本状态机
type StorybookStatus = "init" | "creating" | "updating" | "finished" | "error" | "terminated"

// AI 模型选择
type CliType = "gemini" | "claude" | "openai"

// 图片规格
type AspectRatio = "1:1" | "16:9" | "4:3"
type ImageSize   = "1k" | "2k" | "4k"

// 页面类型
type PageType = "cover" | "content" | "back_cover"

// 用户会员等级
type MembershipLevel = "free" | "lite" | "pro" | "max"
```

---

## 样式规范

### Tailwind 配置扩展

- **字体**: `font-lexend`（标题）、`font-inter`（正文）
- **圆角**: 使用 CSS 变量 `--radius`
- **颜色**: 使用 HSL CSS 变量（支持暗色模式切换）
- **动画**: `tailwindcss-animate` 提供 accordion 动画

### 主色调

- 背景深色: `#061428`（首页）、`#FAF3ED`（编辑器）
- 品牌色: `#00CDD4`（主操作色，teal 系）
- UI 白底: `bg-white/80 backdrop-blur-md`（毛玻璃效果）

### 组件规范

- 基础组件来自 `src/components/ui/`，遵循 shadcn/ui 模式
- 样式通过 `cn()` 工具函数合并（`clsx` + `tailwind-merge`）
- 响应式：移动端优先，`hidden md:flex` / `lg:w-[320px]` 控制布局

---

## CanvasEditor 模块

独立的图片编辑器，支持：

| 工具 | 功能 |
|------|------|
| FilterTool | 亮度/对比度/饱和度/模糊调节 |
| TextTool | 添加文字图层，支持字体/大小/颜色/加粗 |
| StickerTool | 贴纸叠加 |
| HeadSwapTool | AI 头像换脸（使用 MediaPipe） |

图层系统：`CanvasLayer[]`，支持图片层和文字层的位置/尺寸编辑。

---

## PDF 导出

`downloadStorybookImage()` 在浏览器端完成，流程：

1. 并行加载所有页面图片（通过 OSS 代理避免 CORS）
2. 每页用 `<canvas>` 绘制：背景色 + 图片（letterbox fit）+ 渐变遮罩 + 文字
3. 封面/封底页跳过文字渲染
4. 可选水印（右下角，透明度 0.55）
5. 通过 jsPDF 合并为 PDF 下载

---

## 开发命令

```bash
npm run dev      # 开发服务器（localhost:3000）
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

Vite 代理配置：`/api/*` → `http://127.0.0.1:8000`
