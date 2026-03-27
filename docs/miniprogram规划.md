# 微信小程序开发规划（原生版）

## 项目定位

复用现有 `/api/v1/*` 后端接口，用**原生微信小程序**（无 Taro/React）开发，直接使用 WXML + WXSS + JS + `wx.*` API，零构建依赖，微信开发者工具直接打开运行。

---

## 技术栈

| 分类 | 选型 | 说明 |
|------|------|------|
| 框架 | **原生微信小程序** | WXML + WXSS + JS，无第三方框架 |
| 语言 | **JavaScript（ES2020）** | 微信开发者工具内置转译，无需 Babel |
| 样式 | **WXSS** | 支持 rpx 自适应，类 CSS 语法 |
| 状态管理 | **`getApp().globalData`** | 全局存用户/token，页面间共享 |
| 网络请求 | **`wx.request` 封装** | utils/request.js |
| 本地存储 | **`wx.setStorageSync`** | utils/storage.js |
| 图片上传 | **`wx.chooseMedia`** | 替代 Web 的 `<input type="file">` |

**放弃 Taro 的原因：**
- Taro 引入 React 运行时，包体积膨胀，且编译产物难以调试
- 原生小程序开发体验更直接，`wx.*` API 与 WXML 数据绑定天然契合
- 无需 npm install / build 步骤，开发者工具直接打开 `miniprogram-native/` 目录即可

---

## 目录结构

```
miniprogram-native/          # 新建目录，替代现有 miniprogram/
├── app.js                   # App() 入口，全局 globalData
├── app.json                 # 路由、tabBar、窗口配置
├── app.wxss                 # 全局样式（重置 + CSS 变量）
│
├── pages/
│   ├── login/
│   │   ├── index.js         # Page({ data, onLoad, ... })
│   │   ├── index.json       # 页面级配置（标题等）
│   │   ├── index.wxml       # 模板
│   │   └── index.wxss       # 页面样式
│   ├── home/
│   ├── editor/
│   ├── templates/
│   └── profile/
│
├── utils/
│   ├── request.js           # wx.request 封装（含 token 注入、401 处理）
│   └── storage.js           # wx.getStorageSync 封装
│
└── services/
    ├── authService.js       # 登录、用户信息 API
    └── storybookService.js  # 绘本 CRUD API
```

`project.config.json` 中 `miniprogramRoot` 改为 `miniprogram-native/`。

---

## 全局状态设计（替代 React Context）

```js
// app.js
App({
  globalData: {
    token: null,      // string | null
    user: null,       // UserOut | null
  },

  onLaunch() {
    // 读取持久化 token，验证有效性
    const token = wx.getStorageSync('auth_token')
    const user  = wx.getStorageSync('auth_user')
    if (token && user) {
      this.globalData.token = token
      this.globalData.user  = user
      // 异步验证 token（调 /users/me），失败则清除
    }
  },

  // 任何页面通过 getApp().login(token, user) 登录
  login(token, user) {
    this.globalData.token = token
    this.globalData.user  = user
    wx.setStorageSync('auth_token', token)
    wx.setStorageSync('auth_user', user)
  },

  logout() {
    this.globalData.token = null
    this.globalData.user  = null
    wx.removeStorageSync('auth_token')
    wx.removeStorageSync('auth_user')
    wx.reLaunch({ url: '/pages/login/index' })
  },
})
```

页面访问：
```js
const app = getApp()
const { token, user } = app.globalData
```

---

## 网络请求封装

```js
// utils/request.js
const BASE_URL = 'https://www.nanbende.com'  // 生产；开发时改为 http://localhost:8000

function request(path, options = {}) {
  const { method = 'GET', data, auth = true } = options
  const app = getApp()
  const header = { 'Content-Type': 'application/json' }
  if (auth && app.globalData.token) {
    header['Authorization'] = `Bearer ${app.globalData.token}`
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data: data ? JSON.stringify(data) : undefined,
      header,
      success(res) {
        if (res.statusCode === 401) {
          getApp().logout()
          reject(new Error('请先登录'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        const detail = res.data?.detail
        const msg = typeof detail === 'string' ? detail : `请求失败 (${res.statusCode})`
        reject(new Error(msg))
      },
      fail(err) { reject(new Error(err.errMsg || '网络请求失败')) },
    })
  })
}

export const get   = (path, auth = true)       => request(path, { auth })
export const post  = (path, data, auth = true) => request(path, { method: 'POST', data, auth })
export const put   = (path, data)              => request(path, { method: 'PUT', data })
export const patch = (path, data)              => request(path, { method: 'PATCH', data })
export const del   = (path)                    => request(path, { method: 'DELETE' })
```

---

## 页面规划

### tabBar 底部导航

| Tab | 页面路径 | 图标 |
|-----|---------|------|
| 首页 | pages/home/index | home / home-active |
| 我的绘本 | pages/storybook/list/index | book / book-active |
| 模板 | pages/templates/index | template / template-active |
| 我的 | pages/profile/index | user / user-active |

login 页不在 tabBar 中，通过 `wx.navigateTo` 跳转。

### 各页面功能

| 页面 | 核心功能 |
|------|---------|
| **login** | `wx.getUserProfile` 获取昵称头像 → `wx.login` 获取 code → POST /auth/login/wechat-mini → 存 token |
| **home** | textarea 输入故事指令 → POST /storybooks 创建 → 跳转 editor 并传 storybookId |
| **editor** | 横向 scroll-view 展示绘本列表；选中后展示当前页图文；轮询状态；翻页导航 |
| **templates** | 模板列表（开发中占位） |
| **profile** | 展示用户信息、积分余量、免费次数；退出登录按钮 |

---

## 轮询实现（替代 React usePolling hook）

原生小程序用 `setTimeout` + 页面变量实现，逻辑与原 `usePolling.ts` 一致：

```js
// editor/index.js
Page({
  data: { ... },
  _pollTimer: null,
  _pollingId: null,

  startPolling(id) {
    this.stopPolling()
    this._pollingId = id
    this._pollTick()
  },

  stopPolling() {
    if (this._pollTimer) clearTimeout(this._pollTimer)
    this._pollTimer = null
    this._pollingId = null
  },

  async _pollTick() {
    if (!this._pollingId) return
    try {
      const book = await getStorybook(this._pollingId)
      this.applyBookUpdate(book)
      const TERMINAL = ['finished', 'error', 'terminated']
      if (!TERMINAL.includes(book.status)) {
        this._pollTimer = setTimeout(() => this._pollTick(), 5000)
      }
    } catch {
      this._pollTimer = setTimeout(() => this._pollTick(), 5000)
    }
  },

  onUnload() { this.stopPolling() },
})
```

---

## 与原 Taro 版本的对照

| 能力 | Taro 版 | 原生版 |
|------|---------|------|
| 组件 | `<View>` `<Text>` `<Image>` | `<view>` `<text>` `<image>` |
| 路由 | `Taro.navigateTo` | `wx.navigateTo` |
| 存储 | `Taro.setStorageSync` | `wx.setStorageSync` |
| 请求 | `Taro.request` | `wx.request` |
| 状态 | React Context + useState | `getApp().globalData` + `this.setData()` |
| 生命周期 | `useLoad` hook | `onLoad(options)` |
| 样式 | SCSS → 编译 | WXSS 直写（支持 `rpx`） |
| 构建 | `npm run dev:weapp` | 无需构建，直接用开发者工具打开 |

---

## 开发阶段规划

### Phase 1 — 脚手架 & 基础能力（当前）

- [ ] 创建 `miniprogram-native/` 目录，建立完整文件骨架
- [ ] `app.js` 全局状态（globalData + login/logout）
- [ ] `app.json` 路由、tabBar、窗口配置
- [ ] `utils/request.js` 封装（token 注入、401 处理、错误提取）
- [ ] `services/authService.js` + `services/storybookService.js`
- [ ] **login 页**：微信一键登录完整流程
- [ ] **home 页**：指令输入 + 创建绘本
- [ ] **editor 页**：绘本列表 + 状态展示 + 翻页 + 轮询
- [ ] **profile 页**：用户信息 + 退出登录
- [ ] **templates 页**：占位页
- [ ] 修改 `project.config.json` 指向新目录

### Phase 2 — 编辑功能（后续）

- [ ] EditMode：文字编辑 + AI 图片重绘指令
- [ ] RegenMode：插入页、重新生成
- [ ] 封面 / 封底生成
- [ ] 图片保存到相册（`wx.saveImageToPhotosAlbum`）
- [ ] 分享（`onShareAppMessage`）

### Phase 3 — 支付 & 会员（后续）

- [ ] 积分充值（`wx.requestPayment`）
- [ ] 会员订阅

---

## 后端依赖接口（已实现）

| 接口 | 说明 |
|------|------|
| `POST /api/v1/auth/login/wechat-mini` | 微信小程序登录，接受 code + nickname + avatar_url |
| `GET /api/v1/users/me` | 获取当前用户信息 |
| `POST /api/v1/storybooks` | 创建绘本 |
| `GET /api/v1/storybooks` | 绘本列表 |
| `GET /api/v1/storybooks/{id}` | 绘本详情（含 pages） |

---

## project.config.json 配置

```json
{
  "miniprogramRoot": "miniprogram-native/",
  "appid": "wx23bbed625a584e5b",
  "compileType": "miniprogram",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "minified": false
  }
}
```

`urlCheck: false` 开发阶段关闭域名校验，上线前改回 `true` 并在后台配置合法域名。
