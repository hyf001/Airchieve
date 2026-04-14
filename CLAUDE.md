# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

AIrchieve 是一个 AI 驱动的绘本创作平台。用户通过自然语言指令来生成带插图和文字的儿童绘本故事书。

**三个客户端实现：**
- **Web 前端** ([frontend/](frontend/)) - React + Vite + TypeScript，运行在 3000 端口
- **微信小程序** ([miniprogram/](miniprogram/)) - 原生 WXML + WXSS + JS
- **后端 API** ([app/](app/)) - FastAPI + Python，运行在 8000 端口

---

## 开发命令

### 后端 (FastAPI)

```bash
# 创建/激活虚拟环境
python3.12 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 使用生产配置运行
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 前端 (React)

```bash
cd frontend

# 安装依赖
npm install

# 开发服务器（将 /api 代理到 localhost:8000）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

### 小程序

在微信开发者工具中打开 [miniprogram/](miniprogram/) 目录。无需构建步骤。

### 部署

```bash
# 初始服务器设置
sudo bash deploy/1_init_server.sh

# 部署/更新应用
sudo bash deploy/2_deploy.sh
```

部署脚本会：
1. 安装/更新 Python 依赖
2. 构建前端
3. 配置 systemd 服务（`gunicorn` + `uvicorn.workers.UvicornWorker`）
4. 配置 Nginx 反向代理
5. 可选地配置 Let's Encrypt SSL

**生产环境服务管理：**
```bash
sudo systemctl restart airchieve     # 重启后端
sudo journalctl -u airchieve -f      # 查看日志
sudo systemctl reload nginx          # 重载 Nginx
```

---

## 架构

### 后端结构 ([app/](app/))

```
app/
├── api/v1/          # API 路由处理器（auth、user、storybook、page、template、payment、oss）
├── core/            # 配置、安全、工具
│   └── utils/       # 日志、prompt 工具
├── db/              # 数据库会话管理（SQLAlchemy 2.0 异步）
├── models/          # SQLAlchemy ORM 模型
│   ├── enums.py     # 枚举定义（CliType、PageType、LayerType、StoryType 等）
│   ├── storybook.py # 绘本模型
│   ├── page.py      # 页面模型（独立表，含分镜 JSON）
│   ├── layer.py     # 图层模型（文字/绘画/图片/贴纸/调整图层）
│   ├── user.py      # 用户模型
│   ├── template.py  # 模板模型
│   ├── payment.py   # 支付模型
│   └── points.py    # 积分模型
├── schemas/         # Pydantic 请求/响应模型（page.py、media.py 等）
├── services/        # 业务逻辑层
│   ├── llm_cli.py       # LLM 客户端基类接口（LLMClientBase）
│   ├── gemini_cli.py    # Gemini API 客户端实现
│   ├── doubao_cli.py    # 豆包（火山方舟）API 客户端实现
│   ├── storybook_service.py
│   ├── page_service.py  # 页面操作服务
│   ├── layer_service.py # 图层操作服务
│   ├── thumbnail_service.py  # 缩略图生成服务
│   ├── template_service.py
│   ├── user_service.py
│   ├── payment_service.py
│   ├── points_service.py
│   └── oss_service.py
└── main.py          # FastAPI 应用入口
```

**关键模式：**
- **全面使用 async/await** - 所有数据库操作使用 `aiosqlite`（开发环境）或 `aiomysql`（生产环境）
- **服务层** - 业务逻辑在 `services/` 中，API 路由只是薄包装
- **LLM 客户端抽象** - `LLMClientBase` 定义统一接口，`GeminiCli` 和 `DoubaoCli` 分别实现，通过 `LLMClientBase.get_client(cli_type)` 工厂方法获取实例
- **后台任务** - 长时间运行的 AI 生成在后台线程中执行，状态由客户端轮询
- **OSS 代理** - `/api/v1/oss/...` 端点代理阿里云 OSS 以避免 CORS 问题

### 前端结构 ([frontend/src/](frontend/src/))

```
frontend/src/
├── pages/               # 页面级组件
│   ├── HomeView.tsx     # 首页（绘本列表）
│   ├── EditorView.tsx   # 编辑器主页面
│   ├── TemplatesView.tsx # 模板选择
│   ├── UserProfileView.tsx   # 用户资料
│   ├── UserManagementView.tsx # 用户管理（管理员）
│   └── editor/          # 编辑器子页面
│       └── BackCoverMode.tsx  # 封底编辑模式
├── components/          # 可复用 UI 组件
│   ├── editor/          # 编辑器组件
│   │   ├── EditorCanvas.tsx    # 画布
│   │   ├── EditorHeader.tsx    # 顶部栏
│   │   ├── PageNavigator.tsx   # 页面导航
│   │   ├── StorybookList.tsx   # 绘本列表
│   │   ├── dialogs/            # 弹窗组件
│   │   └── tools/              # 编辑工具系统
│   │       ├── ToolRegistry.tsx  # 工具注册
│   │       ├── ToolPanel.tsx     # 工具面板
│   │       ├── ToolSelector.tsx  # 工具选择器
│   │       ├── ToolContext.tsx    # 工具上下文
│   │       ├── EditorToolbar.tsx  # 工具栏
│   │       ├── ai-edit/          # AI 改图工具
│   │       ├── draw/             # 绘画工具
│   │       └── text-edit/        # 文字编辑工具
│   ├── ConfirmDialog.tsx
│   ├── LoadingSpinner.tsx
│   ├── LoginModal.tsx
│   ├── ProgressCaterpillar.tsx
│   ├── StoryboardCard.tsx
│   └── StorybookPreview.tsx
├── services/            # API 客户端层
│   ├── authService.ts
│   ├── storybookService.ts
│   ├── storyboardService.ts
│   ├── templateService.ts
│   └── paymentService.ts
├── contexts/            # 全局状态（AuthContext 用于用户认证）
├── hooks/               # 自定义 hooks（usePolling 用于异步操作）
├── types/               # TypeScript 类型定义（creation.ts、tool.ts 等）
├── constants/           # 静态数据（editor.ts、index.tsx）
├── utils/               # 工具函数（editorUtils.ts）
└── App.tsx              # 基于状态的路由（不使用 React Router）
```

**关键模式：**
- **状态路由** - `App.tsx` 使用 `useState` 切换视图，而非 URL 路由
- **轮询异步操作** - `usePolling` hook 每 5 秒轮询一次绘本生成状态
- **基于 Token 的认证** - JWT 存储在 `localStorage`，通过 `getAuthHeaders()` 自动注入
- **OSS 图片处理** - `toApiUrl()` 将 OSS URL 转换为代理 URL 以避免 CORS
- **编辑器工具系统** - 基于 ToolRegistry 的模块化工具架构，每种工具（ai-edit、draw、text-edit）包含独立的 Overlay、hooks 和 types

### 小程序结构 ([miniprogram/](miniprogram/))

```
miniprogram/
├── pages/           # 微信小程序页面（login、home、storybook、profile、templates、agreement）
├── services/        # API 客户端层（authService、storybookService、templateService）
├── utils/           # 请求封装、存储工具
├── assets/          # 静态资源
├── app.js           # 全局状态（getApp().globalData 存储 token 和 user）
└── app.json         # 路由、tabBar、窗口配置
```

**关键模式：**
- **原生 API** - `wx.request`、`wx.login`、`wx.chooseMedia`
- **全局状态** - `getApp().globalData` 用于认证状态
- **无需构建** - 微信开发者工具直接打开目录

---

## 数据库

**开发环境：** SQLite 位于 `data/app.db`（自动创建）
**生产环境：** MySQL（通过 `DATABASE_URL` 环境变量配置）

**核心模型：**
- `User` - 用户账户，包含角色（admin/user）、状态（active/banned/deleted）、会员等级（free/lite/pro/max）
- `Storybook` - 绘本，包含状态机（init/creating/updating/finished/error/terminated）、CLI 类型、比例和尺寸配置
- `Page` - 页面（独立表，非 JSON 字段），包含文字、图片、页面类型（cover/content/back_cover）、分镜信息（storyboard JSON）
- `Layer` - 图层，支持类型（text/draw/image/sticker/adjustment），包含排序、显隐、锁定和 JSON 内容
- `Template` - 预定义的绘本风格模板
- `Payment` - 微信支付交易
- `Points` - 用户积分余额

**Page 与 Storybook 的关系：** Page 从 Storybook 的 JSON 字段中独立为单独的 `pages` 表，通过 `storybook_id` 外键关联。

**Layer 与 Page 的关系：** Layer 属于 Page，通过 `page_id` 外键关联，支持 `layer_index` 排序。

数据库初始化在应用启动时通过 [main.py](app/main.py) 中的 `lifespan()` 自动完成。

---

## 配置

所有配置在 [app/core/config.py](app/core/config.py) 中，从 `.env` 文件加载。

**必需的环境变量：**
```bash
# 数据库
DATABASE_URL=sqlite+aiosqlite:///data/app.db  # 或 mysql+aiomysql://...

# 安全
SECRET_KEY=your-secret-key-here

# Gemini API（AI 图片/文字生成）
GEMINI_API_URL=https://...
GEMINI_API_KEY=sk-...
GEMINI_MODEL=gemini-3-pro-image-preview          # 默认模型
GEMINI_EDIT_MODEL=gemini-2.0-flash-preview-image-generation  # 图片编辑模型
GEMINI_TEXT_MODEL=gemini-2.5-flash-lite-preview-09-2025      # 文本生成模型

# 豆包 API（火山方舟，可选，替代 Gemini）
DOUBAO_API_KEY=...
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_IMAGE_MODEL=doubao-seedream-5-0-260128   # 图片生成模型
DOUBAO_TEXT_MODEL=doubao-seed-2-0-lite-260215    # 文本生成模型

# 微信小程序登录
WECHAT_MINI_APP_ID=wx...
WECHAT_MINI_APP_SECRET=...

# 微信支付（可选，用于支付功能）
WECHAT_PAY_APP_ID=wx...
WECHAT_PAY_MCHID=...
WECHAT_PAY_API_KEY_V3=...
WECHAT_PAY_CERT_SERIAL_NO=...
WECHAT_PAY_PRIVATE_KEY_PATH=/etc/wechat/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://example.com/api/v1/payment/notify

# 阿里云 OSS（可选，用于文件存储）
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_ENDPOINT=oss-cn-...
OSS_BUCKET_NAME=...
OSS_BASE_URL=https://cdn.example.com  # 自定义域名（可选）
```

将 [deploy/.env.production](deploy/.env.production) 复制为 `.env` 并填写实际值。

---

## API 端点

**基础 URL：** `/api/v1/`

**健康检查：**
- `GET /ping` - 健康检查

**认证：**
- `POST /auth/login/password` - 用户名/密码登录
- `POST /auth/login/phone` - 手机号 + 短信验证码登录
- `POST /auth/login/wechat-mini` - 微信小程序登录（code + userInfo）
- `GET /users/me` - 获取当前用户信息

**绘本：**
- `POST /storybooks` - 创建新绘本（异步，立即返回，status=creating）
- `GET /storybooks` - 获取用户的绘本列表
- `GET /storybooks/{id}` - 获取绘本详情（轮询此接口获取状态更新）
- `POST /storybooks/{id}/pages/{page_id}/regenerate` - 重新生成单个页面
- `POST /storybooks/{id}/insert` - 插入新页面（异步）
- `POST /storybooks/{id}/reorder` - 重新排序页面
- `POST /storybooks/{id}/terminate` - 取消正在进行的生成
- `POST /storybooks/{id}/cover` - 生成封面
- `POST /storybooks/{id}/back-cover` - 生成封底

**页面与图层：**
- `GET /pages/{page_id}` - 获取页面详情（含图层列表）
- `PUT /pages/{page_id}` - 更新页面文字
- `POST /pages/{page_id}/base-image` - 替换基图（AI 改图后调用）
- `DELETE /pages/{page_id}` - 删除页面
- `GET /pages/{page_id}/layers` - 获取页面所有图层
- `POST /pages/{page_id}/layers` - 新增图层
- `PATCH /pages/{page_id}/layers/{layer_id}` - 更新图层
- `DELETE /pages/{page_id}/layers/{layer_id}` - 删除图层
- `PATCH /pages/{page_id}/layers/reorder` - 批量调整图层顺序

**模板：**
- `GET /templates` - 获取模板列表
- `POST /templates` - 创建模板（仅管理员）

**支付：**
- `POST /payment/recharge` - 发起充值（微信支付）
- `POST /payment/notify/recharge` - 微信支付回调

**OSS 代理：**
- `GET /oss/...` - 代理 OSS 图片以避免 CORS

---

## 核心集成

### LLM 客户端抽象

[llm_cli.py](app/services/llm_cli.py) 定义了 `LLMClientBase` 抽象基类，统一了所有大模型客户端的接口。通过 `LLMClientBase.get_client(cli_type)` 工厂方法获取对应实例。

**支持的客户端：**
- `GeminiCli` ([gemini_cli.py](app/services/gemini_cli.py)) - Google Gemini API
- `DoubaoCli` ([doubao_cli.py](app/services/doubao_cli.py)) - 豆包（火山方舟 Ark SDK）

**核心方法：**
- `generate_page()` - 生成单页图片
- `edit_image()` - AI 改图
- `create_story()` - 创建纯文本故事（标题 + 内容）
- `create_storyboard_from_story()` - 基于故事创建分镜描述
- `create_insertion_story_and_storyboard()` - 创建插入页面的故事和分镜
- `generate_cover()` - 生成封面图片

**错误处理：** 自定义 `LLMError` 异常，带有 `dev_message`（开发调试）和 `user_message`（用户展示）两个维度的错误信息。

### 微信支付

实现在 [payment_service.py](app/services/payment_service.py)。使用微信支付 API v3。

### 阿里云 OSS

实现在 [oss_service.py](app/services/oss_service.py)。存储生成的图片，支持自定义域名。

### 缩略图服务

实现在 [thumbnail_service.py](app/services/thumbnail_service.py)。基于 Pillow 生成文件缩略图。

---

## 异步绘本生成流程

**创建：**
1. 客户端 `POST /storybooks`，传入指令 + 模板
2. 后端验证，创建 `status="creating"` 的 Storybook 记录，立即返回 ID
3. 后台任务（`run_create_storybook_background()`）顺序生成页面
4. 客户端每 5 秒轮询 `GET /storybooks/{id}`
5. 当 `status="finished"` 时，停止轮询

**编辑/插入：**
- 类似的异步流程，`status="updating"`
- 客户端使用 `usePolling` hook（前端）或 `setTimeout`（小程序）

**AI 改图：**
- 用户通过编辑器 ai-edit 工具提交改图指令
- 后端调用 `LLMClientBase.edit_image()` 进行图片编辑
- 编辑完成后通过 `POST /pages/{page_id}/base-image` 更新基图

---

## 重要注意事项

1. **前端不使用 React Router** - 所有路由通过 `App.tsx` 状态控制，URL 不变化
2. **OSS CORS 问题** - 前端中使用 OSS 图片时务必使用 `/api/v1/oss/...` 代理
3. **异步操作耗时较长** - 图片生成每页可能需要 30-60 秒
4. **Token 过期** - 前端在 401 时自动清除 token，触发登录弹窗
5. **小程序使用 `wx.*` API** - 不是 `Taro.*`，仅使用微信原生 API
6. **数据库是异步的** - 所有数据库调用使用 `await session.execute()`，不是同步查询
7. **SSL 证书** - 部署脚本自动配置 Let's Encrypt 并设置自动续期 cron
8. **Page 独立存储** - 页面数据存储在 `pages` 表中，不是 Storybook 的 JSON 字段
9. **图层系统** - 编辑操作（文字/绘画/图片/贴纸）以图层形式存储在 `layers` 表中
10. **多 LLM 支持** - 绘本创建时可选择 Gemini 或豆包作为 AI 后端，通过 `cli_type` 字段区分
11. **JSON 兼容性** - 使用 `JsonText`/`JsonColumn` 自定义类型以 Text 存储 JSON，兼容低版本 MariaDB
