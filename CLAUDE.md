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
├── api/v1/          # API 路由处理器（auth、user、storybook、template、payment、oss）
├── core/            # 配置、安全、工具
├── db/              # 数据库会话管理（SQLAlchemy 2.0 异步）
├── models/          # SQLAlchemy ORM 模型（user、storybook、payment、points、template）
├── schemas/         # Pydantic 请求/响应模型
├── services/        # 业务逻辑层（gemini_cli、storybook_service、user_service 等）
└── main.py          # FastAPI 应用入口
```

**关键模式：**
- **全面使用 async/await** - 所有数据库操作使用 `aiosqlite`（开发环境）或 `aiomysql`（生产环境）
- **服务层** - 业务逻辑在 `services/` 中，API 路由只是薄包装
- **后台任务** - 长时间运行的 AI 生成在后台线程中执行，状态由客户端轮询
- **OSS 代理** - `/api/v1/oss/...` 端点代理阿里云 OSS 以避免 CORS 问题

### 前端结构 ([frontend/src/](frontend/src/))

```
frontend/src/
├── pages/           # 页面级组件（HomeView、EditorView、TemplatesView 等）
├── components/      # 可复用 UI 组件（CanvasEditor、Dialog、Toast 等）
├── services/        # API 客户端层（authService、storybookService、templateService）
├── contexts/        # 全局状态（AuthContext 用于用户认证）
├── hooks/           # 自定义 hooks（usePolling 用于异步操作）
├── types/           # TypeScript 类型定义
├── constants/       # 静态数据（绘本模板）
└── App.tsx          # 基于状态的路由（不使用 React Router）
```

**关键模式：**
- **状态路由** - `App.tsx` 使用 `useState` 切换视图，而非 URL 路由
- **轮询异步操作** - `usePolling` hook 每 5 秒轮询一次绘本生成状态
- **基于 Token 的认证** - JWT 存储在 `localStorage`，通过 `getAuthHeaders()` 自动注入
- **OSS 图片处理** - `toApiUrl()` 将 OSS URL 转换为代理 URL 以避免 CORS

### 小程序结构 ([miniprogram/](miniprogram/))

```
miniprogram/
├── pages/           # 微信小程序页面（login、home、editor、profile、templates）
├── services/        # API 客户端层（authService、storybookService）
├── utils/           # 请求封装、存储工具
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
- `User` - 用户账户，包含会员等级（free/lite/pro/max）
- `Storybook` - 绘本，包含状态机（init/creating/updating/finished/error/terminated）
- `Storyboard` - 单个页面，包含文字/图片
- `Template` - 预定义的绘本风格模板
- `Payment` - 微信支付交易
- `Points` - 用户积分余额

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
GEMINI_MODEL=gemini-3.1-flash-image-preview

# 微信小程序登录
WECHAT_MINI_APP_ID=wx...
WECHAT_MINI_APP_SECRET=...

# 微信支付（可选，用于支付功能）
WECHAT_PAY_APP_ID=wx...
WECHAT_PAY_MCHID=...
WECHAT_PAY_API_KEY_V3=...

# 阿里云 OSS（可选，用于文件存储）
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_ENDPOINT=oss-cn-...
OSS_BUCKET_NAME=...
```

将 [deploy/.env.production](deploy/.env.production) 复制为 `.env` 并填写实际值。

---

## API 端点

**基础 URL：** `/api/v1/`

**认证：**
- `POST /auth/login/password` - 用户名/密码登录
- `POST /auth/login/phone` - 手机号 + 短信验证码登录
- `POST /auth/login/wechat-mini` - 微信小程序登录（code + userInfo）
- `GET /users/me` - 获取当前用户信息

**绘本：**
- `POST /storybooks` - 创建新绘本（异步，立即返回，status=creating）
- `GET /storybooks` - 获取用户的绘本列表
- `GET /storybooks/{id}` - 获取绘本详情（轮询此接口获取状态更新）
- `PATCH /storybooks/{id}/pages` - 更新页面文字/图片
- `POST /storybooks/{id}/pages/{page_id}/regenerate` - 重新生成单个页面
- `POST /storybooks/{id}/insert` - 插入新页面（异步）
- `DELETE /storybooks/{id}/pages/{page_id}` - 删除页面
- `POST /storybooks/{id}/reorder` - 重新排序页面
- `POST /storybooks/{id}/terminate` - 取消正在进行的生成
- `POST /storybooks/{id}/cover` - 生成封面
- `POST /storybooks/{id}/back-cover` - 生成封底

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

### Gemini API

用于 AI 图片和文字生成。实现在 [services/gemini_cli.py](app/services/gemini_cli.py)。

**两种模式：**
1. **图片生成** - `generate_images()` 用于绘本插图
2. **文字生成** - `generate_text()` 用于故事文本

**错误处理：** 自定义 `LLMError` 异常，带有用户友好的错误信息。错误码参见 [docs/gemini错误处理.md](docs/gemini错误处理.md)。

### 微信支付

实现在 [services/wechat_pay.py](app/services/wechat_pay.py)。使用微信支付 API v3。

### 阿里云 OSS

实现在 [services/oss_service.py](app/services/oss_service.py)。存储生成的图片。

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

---

## 重要注意事项

1. **前端不使用 React Router** - 所有路由通过 `App.tsx` 状态控制，URL 不变化
2. **OSS CORS 问题** - 前端中使用 OSS 图片时务必使用 `/api/v1/oss/...` 代理
3. **异步操作耗时较长** - 图片生成每页可能需要 30-60 秒
4. **Token 过期** - 前端在 401 时自动清除 token，触发登录弹窗
5. **小程序使用 `wx.*` API** - 不是 `Taro.*`，仅使用微信原生 API
6. **数据库是异步的** - 所有数据库调用使用 `await session.execute()`，不是同步查询
7. **SSL 证书** - 部署脚本自动配置 Let's Encrypt 并设置自动续期 cron
