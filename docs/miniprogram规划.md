# 微信小程序开发规划

## 项目定位

复用现有 `/api/v1/*` 后端接口，用 **Taro + React** 开发微信小程序端，与 Web 端实现功能对等（创建 + 编辑 + 阅读绘本）。

---

## 技术栈

| 分类 | 选型 | 说明 |
|------|------|------|
| 框架 | **Taro 4** | React 语法，与 Web 端知识复用 |
| 语言 | TypeScript | 与 Web 端统一 |
| 样式 | **Taro NutUI** 或 **TDesign Mini** | 微信小程序专用组件库 |
| 状态管理 | React Context（延续 Web 端） | 无需引入 Redux |
| 网络请求 | `Taro.request` 封装（替代 fetch） | 小程序不支持 fetch |
| 本地存储 | `Taro.setStorageSync` | 替代 localStorage |
| 图片上传 | `Taro.chooseMedia` | 替代 `<input type="file">` |
| 支付 | 微信小程序支付（jsapi） | 后端需新增 miniprogram 支付渠道 |

---

## 与 Web 端的关键差异

### 1. 认证方式

小程序**只提供微信一键登录**，不支持账号密码和手机验证码。登录流程：

```
用户点击「微信一键登录」按钮
→ wx.login() 获取临时 code
→ wx.getUserProfile() 获取昵称和头像（需用户授权）
→ POST /api/v1/auth/login/wechat-mini  （后端需新增）
  body: { code, nickname, avatar_url }
→ 后端用 code 换取 openid/session_key
→ 返回 access_token + user（与现有 TokenResponse 结构一致）
→ token 存入 Taro.setStorageSync，后续请求自动携带
```

登录入口设计：
- 未登录用户进入 home 页可浏览公开绘本，但触发创建/编辑时跳转 login 页
- login 页只有一个「微信一键登录」按钮，登录成功后自动返回上一页
- 无需注册流程，首次登录自动创建账号（后端已有 `is_new_user` 字段）

**后端需新增**：`POST /api/v1/auth/login/wechat-mini`，接受 `{ code, nickname, avatar_url }`，内部用 code 换取 openid，关联或创建用户。

### 2. 网络请求

```typescript
// Web 端
fetch('/api/v1/storybooks', { headers: { Authorization: 'Bearer ...' } })

// 小程序端（Taro 封装后接口一致）
Taro.request({ url: `${BASE_URL}/api/v1/storybooks`, header: { Authorization: 'Bearer ...' } })
```

需要将所有 service 层的 `fetch` 替换为 `Taro.request` 封装，其余业务逻辑可复用。

### 3. 本地存储

```typescript
// Web 端
localStorage.setItem('auth_token', token)

// 小程序端
Taro.setStorageSync('auth_token', token)
```

### 4. 图片处理

| 场景 | Web 端 | 小程序端 |
|------|--------|----------|
| 选择图片 | `<input type="file">` + FileReader | `Taro.chooseMedia` |
| 图片转 base64 | FileReader.readAsDataURL | `Taro.getFileSystemManager().readFileSync` |
| Canvas 绘图 | `document.createElement('canvas')` | `Taro.createCanvasContext` / `OffscreenCanvas` |
| 图片下载保存 | jsPDF 生成 PDF | `Taro.saveImageToPhotosAlbum`（保存到相册） |

> ⚠️ **jsPDF 不支持小程序**，PDF 导出改为「逐页保存为图片到相册」，或转为小程序内 Canvas 生成长图分享。

### 5. CanvasEditor（图片编辑器）

Web 端依赖 `@mediapipe/tasks-vision`（换脸工具）、`@imgly/background-removal`，这两个库**不兼容微信小程序环境**。

小程序版 CanvasEditor 方案：
- **保留**：文字叠加、贴纸、亮度/对比度调节（用 Canvas 2D API 实现）
- **去除**：MediaPipe 换脸、AI 背景消除（这两个功能依赖 WebAssembly，小程序限制较多）
- **可后续考虑**：调用后端 AI 接口实现换脸/抠图，前端只负责展示

### 6. 支付

现有 paymentService 支持 `h5 | native` 两种渠道，小程序需增加 `miniprogram` 渠道：

```
后端需新增：POST /api/v1/payment/recharge（miniprogram 渠道）
返回：{ order_no, timeStamp, nonceStr, package, signType, paySign }
前端调用：Taro.requestPayment(...)
```

---

## 页面规划

### 路由结构（Taro Pages）

```
pages/
├── home/index          # 首页（创建入口 + 公开绘本展示）
├── editor/index        # 编辑器（绘本列表 + 工作区）
├── reader/index        # 沉浸式阅读（全屏翻页）
├── templates/index     # 模板库
├── profile/index       # 个人中心（积分/会员/订单）
└── login/index         # 登录页（微信一键登录）

tabBar 底部导航:
  首页 | 我的绘本 | 模板 | 我的
```

### 各页面对应关系

| 小程序页面 | Web 端对应 | 主要差异 |
|-----------|-----------|---------|
| home | HomeView | 布局适配移动端，图片上传用 chooseMedia |
| editor | EditorView | 绘本列表改为下拉/抽屉，模式标签在底部 |
| reader | ReadMode | 全屏展示，左右滑动翻页 |
| templates | TemplatesView | 基本一致 |
| profile | UserProfileView | 增加微信一键登录、小程序支付入口 |

---

## 目录结构

```
miniprogram/               # 与 frontend/ 平级
├── src/
│   ├── app.tsx            # Taro App 入口
│   ├── app.config.ts      # 路由、tabBar、窗口配置
│   ├── app.scss           # 全局样式
│   │
│   ├── pages/
│   │   ├── home/
│   │   │   ├── index.tsx
│   │   │   └── index.config.ts
│   │   ├── editor/
│   │   │   ├── index.tsx
│   │   │   └── editor-modes/    # ReadMode/EditMode/RegenMode 等
│   │   ├── reader/
│   │   ├── templates/
│   │   ├── profile/
│   │   └── login/
│   │
│   ├── components/        # 小程序专用组件（复用 Web 端逻辑，改造 UI）
│   │   ├── StorybookCard/
│   │   ├── InstructionInput/
│   │   ├── ProgressBar/
│   │   ├── CanvasEditor/  # 精简版（无 MediaPipe）
│   │   └── LoginButton/   # 微信一键授权按钮
│   │
│   ├── services/          # 复用 Web 端大部分逻辑，替换 fetch → Taro.request
│   │   ├── request.ts     # 统一请求封装（含 token 注入、401 处理）
│   │   ├── authService.ts
│   │   ├── storybookService.ts
│   │   ├── templateService.ts
│   │   └── paymentService.ts
│   │
│   ├── hooks/
│   │   ├── usePolling.ts  # 直接复用（逻辑无差异）
│   │   └── useAuth.ts
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx # 替换 localStorage → Taro.setStorageSync
│   │
│   └── utils/
│       ├── storage.ts     # 封装 Taro Storage，与 Web localStorage API 一致
│       └── image.ts       # chooseMedia、base64 转换工具
│
├── project.config.json    # 微信开发者工具配置
├── project.private.config.json
└── package.json
```

---

## 开发阶段规划

### Phase 1 — 脚手架 & 基础能力（约 1 周）

- [ ] Taro 项目初始化，配置 TypeScript + SCSS
- [ ] 配置 tabBar 和所有页面路由
- [ ] 封装 `request.ts`（替代 fetch，统一注入 Authorization 头）
- [ ] 封装 `storage.ts`（同 API 替换 localStorage）
- [ ] 移植 `AuthContext`（微信一键登录流程）
- [ ] 移植 `usePolling`（无需改动）
- [ ] 搭建 login 页（`wx.login` → 后端换 token → 存储）

**后端配合**：新增 `POST /api/v1/auth/login/wechat-mini` 接口

### Phase 2 — 核心流程（约 1.5 周）

- [ ] home 页：创建表单（指令输入 + 模板选择 + 参数配置）
- [ ] home 页：图片上传（`Taro.chooseMedia` + base64 转换）
- [ ] editor 页：绘本列表 + 状态展示
- [ ] editor 页：ReadMode（翻页阅读 + 进度展示）
- [ ] 轮询逻辑接入（复用 usePolling，接口与 Web 端一致）
- [ ] 全局 Toast / Loading 组件

### Phase 3 — 编辑功能（约 1.5 周）

- [ ] EditMode：文字编辑 + AI 图片重绘
- [ ] RegenMode：继续创作（插入页、重新生成）
- [ ] ReorderMode：拖拽排序（小程序用 `movable-view` 实现）
- [ ] CoverMode / BackCoverMode：封面封底生成
- [ ] 精简版 CanvasEditor（文字 + 贴纸 + 滤镜，去除 MediaPipe 依赖）

### Phase 4 — 下载 & 分享（约 0.5 周）

- [ ] 逐页生成图片 → `Taro.saveImageToPhotosAlbum` 保存相册
- [ ] 生成小程序分享卡片（封面图 + 标题）
- [ ] `onShareAppMessage` / `onShareTimeline` 配置

### Phase 5 — 支付 & 个人中心（约 1 周）

- [ ] profile 页：用户信息、积分余量、会员状态
- [ ] 小程序支付（`Taro.requestPayment`）接入积分充值和会员订阅
- [ ] 订单查询轮询（复用 paymentService 模式）

**后端配合**：支付接口增加 `miniprogram` 渠道，返回小程序支付所需签名参数

---

## 关键技术问题 & 解决方案

### 问题 1：OSS 图片 CORS

Web 端通过 Vite 代理 `/api/v1/oss/...` 解决。
小程序无代理，但**小程序不受 CORS 限制**，可直接使用 OSS 直链，无需转换。
→ `toApiUrl()` 函数在小程序中直接返回原始 URL 即可。

### 问题 2：图片 Canvas 绘制（PDF 替代方案）

```typescript
// 小程序端：用 Canvas 2D 绘制单页，保存到相册
const canvas = await Taro.createOffscreenCanvas({ type: '2d', width, height })
// ... 绘制图片 + 渐变 + 文字
const tempPath = await canvasToTempFilePath(canvas)
await Taro.saveImageToPhotosAlbum({ filePath: tempPath })
```

### 问题 3：base64 图片上传

```typescript
// Web 端：FileReader → base64
// 小程序端：
const res = await Taro.chooseMedia({ count: 9, mediaType: ['image'] })
const base64 = Taro.getFileSystemManager()
  .readFileSync(res.tempFiles[0].tempFilePath, 'base64')
```

### 问题 4：ReorderMode 拖拽

Web 端用 CSS drag API，小程序用内置的 `movable-area` + `movable-view` 组件实现拖拽排序。

### 问题 5：小程序分包

绘本功能页面较多，建议将 editor 相关页面和 CanvasEditor 打入分包，主包只保留 home/login/profile，控制主包体积在 **2MB** 以内。

```
主包：home、login、profile
分包A：editor、reader（含 CanvasEditor）
分包B：templates
```

---

## 后端需要新增的接口

| 接口 | 说明 |
|------|------|
| `POST /api/v1/auth/login/wechat-mini` | 接受微信小程序 code，换取 openid，返回 TokenResponse |
| `POST /api/v1/payment/recharge`（增加 miniprogram 渠道） | 返回小程序支付签名参数 |
| `POST /api/v1/payment/subscription`（增加 miniprogram 渠道） | 同上 |

其余所有接口**无需改动**，直接复用。

---

## 代码复用策略

可直接复用（零改动）的逻辑：
- `usePolling.ts` — 轮询逻辑
- `types/index.ts` — 基础类型
- Service 层的**类型定义**和**业务逻辑**

需适配改造的：
- Service 层的**网络请求**（fetch → Taro.request）
- `AuthContext`（localStorage → Taro.setStorageSync）
- 所有 UI 组件（Tailwind CSS → 小程序 SCSS，HTML 标签 → Taro 组件）

建议将 Service 层类型和纯逻辑提取为共享包（`packages/shared/`），供 Web 端和小程序端同时引用，避免代码重复。

---

## 里程碑总览

| 阶段 | 目标 | 预计周期 |
|------|------|---------|
| Phase 1 | 脚手架 + 登录通 | 第 1 周 |
| Phase 2 | 创建 + 阅读主流程可用 | 第 2-3 周 |
| Phase 3 | 完整编辑功能 | 第 4-5 周 |
| Phase 4 | 分享 + 下载 | 第 5 周 |
| Phase 5 | 支付 + 个人中心 | 第 6-7 周 |
| 测试上线 | 真机测试 + 审核提交 | 第 7-8 周 |
