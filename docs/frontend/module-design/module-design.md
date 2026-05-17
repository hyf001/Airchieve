# 前端模块划分与分层设计

本文基于 `docs/frontend/*.html` 原型和 `docs/picture-book-website-prd.md`，只描述 React 前端的模块划分、分层职责、功能边界和依赖关系，用于多人并行开发。

## 1. 总体分层

前端按五层组织：应用层、页面层、业务模块层、领域资源层、共享基础层。

```text
frontend/src/
  app/
  pages/
  features/
  entities/
  shared/
```

### 1.1 `app` 应用层

职责：

- 路由注册与路由守卫。
- 全局 Provider 组合。
- 全局布局。
- 登录态初始化。
- 当前儿童档案初始化。
- 会员权益初始化。
- 全局错误边界。
- 全局弹窗、Toast、Loading 容器。

边界：

- 不写具体页面业务。
- 不直接处理绘本生成、播放、素材管理等具体流程。
- 只组合全局能力，不承载业务细节。

依赖：

- 可依赖 `features/auth` 获取登录态。
- 可依赖 `features/profile-management` 获取当前儿童档案。
- 可依赖 `features/membership` 获取权益摘要。
- 可依赖 `shared` 的基础组件和 API 客户端。

### 1.2 `pages` 页面层

职责：

- 每个路由页面的入口。
- 组合业务模块组件。
- 处理页面级布局。
- 读取路由参数。
- 控制页面级加载、空态、错误态。

边界：

- 页面层不写复杂业务逻辑。
- 页面层不直接拼装底层 API。
- 页面层不复制业务组件。

依赖：

- 主要依赖 `features`。
- 可依赖 `entities` 的轻量展示组件。
- 可依赖 `shared` 的布局和基础 UI。

### 1.3 `features` 业务模块层

职责：

- 承载业务流程和业务交互。
- 管理模块内部状态。
- 调用模块 API。
- 对页面层提供可组合的业务组件。

边界：

- 不越权修改其他业务模块内部状态。
- 跨模块协作通过明确组件、公开入口或服务入口完成。
- 不重复实现共享 UI。

依赖：

- 可依赖 `entities` 的资源能力。
- 可依赖 `shared`。
- 同级 `features` 之间避免直接深度依赖，必要时通过 `app` 编排或公开入口协作。

### 1.4 `entities` 领域资源层

职责：

- 按业务资源沉淀通用展示和基础操作。
- 包含账号、儿童档案、故事、绘本、绘本模板、形象、声音、画风、会员权益、分享链接、生成任务等资源相关能力。
- 为多个业务模块提供统一资源入口。

边界：

- 不承载完整页面流程。
- 不处理复杂业务编排。
- 不知道页面路由。

依赖：

- 可依赖 `shared`。
- 不依赖 `pages`。
- 尽量不依赖 `features`。

### 1.5 `shared` 共享基础层

职责：

- 基础 UI 组件。
- API 客户端。
- 通用交互能力。
- 工具函数。
- 样式变量。
- 常量配置。
- 通用类型。

边界：

- 不包含业务语义。
- 不依赖 `features`、`pages`、`app`。
- 不能出现“绘本生成”“儿童档案”等具体业务流程。

依赖：

- 最底层，不依赖上层模块。

## 2. 页面模块划分

| 原型文件 | React 页面目录 | 页面职责 | 主要依赖模块 |
| --- | --- | --- | --- |
| `index.html` | `pages/home` | 首页发现、继续阅读、快速创建入口、推荐内容 | `discovery`, `book-create`, `profile-management`, `membership` |
| `auth.html` | `pages/auth` | 登录注册、微信登录、手机号验证码登录、账号绑定示例 | `auth`, `safety` |
| `book-detail.html` | `pages/book-detail` | 绘本详情、开始阅读、创建类似作品、学习卡片 | `discovery`, `book-player`, `book-create`, `membership` |
| `player.html` | `pages/player` | 绘本在线播放、语言切换、共读提示、页面列表 | `book-player`, `voice-library`, `membership`, `safety` |
| `create.html` | `pages/create` | 绘本创建向导 | `book-create`, `story-library`, `character-library`, `art-style-library`, `voice-library`, `membership` |
| `stories.html` | `pages/stories` | 我的故事、系统故事、故事详情、发起生成 | `story-library`, `book-create`, `membership` |
| `characters.html` | `pages/characters` | 我的形象、系统形象、创建形象 | `character-library`, `membership`, `safety` |
| `voices.html` | `pages/voices` | 我的声音、系统声音、上传声音、试听 | `voice-library`, `membership`, `safety` |
| `artstyle.html` | `pages/art-styles` | 系统画风、自定义画风、画风对比 | `art-style-library`, `membership` |
| `profile.html` | `pages/profiles` | 儿童档案、阅读历史、素材入口 | `profile-management`, `character-library`, `voice-library`, `art-style-library` |
| `membership.html` | `pages/membership` | 会员套餐、权益对比、订阅入口 | `membership`, `auth` |
| `share.html` | `pages/share` | 分享链接、访问范围、PDF 导出、隐私确认、分享记录 | `share-export`, `book-player`, `membership`, `safety` |

## 3. 业务模块划分

## 3.1 `features/auth` 账号与登录模块

功能范围：

- 手机号验证码登录。
- 微信登录。
- 新用户自动注册。
- 登录成功后恢复原访问上下文。
- 退出登录。
- 登录方式展示。
- 手机号绑定、换绑、解绑。
- 微信绑定。
- 验证码倒计时。
- 验证码错误、发送频率限制、失败次数限制提示。
- 账号初始化流程入口。

功能边界：

- 不负责儿童档案管理。
- 不负责会员套餐展示。
- 不负责具体业务资源权限判断。
- 不负责真人验证具体 UI 以外的风控策略，只接入 `safety` 提供的验证入口。

依赖关系：

- 依赖 `safety`：真人验证、风险操作确认。
- 依赖 `shared`：表单、弹窗、Toast、API 客户端。
- 被 `app` 依赖：全局登录态。
- 被 `membership`、`book-create`、`share-export` 等模块依赖：登录守卫。

## 3.2 `features/discovery` 首页发现与绘本详情模块

功能范围：

- 首页推荐内容展示。
- 精选绘本、新上架、热门播放、免费可读、会员精选、睡前推荐、中英双语推荐。
- 搜索入口。
- 按年龄段、主题、教育目标、语言、阅读水平、免费/VIP 状态浏览。
- 继续阅读模块。
- 最近生成绘本和未完成生成任务入口。
- 按场景开始入口。
- 绘本卡片。
- 绘本详情页主体。
- 相关绘本推荐。
- 创建类似作品入口。

功能边界：

- 不实现播放器。
- 不实现生成流程。
- 不直接处理会员扣减或权益计算。
- 不管理故事正文编辑。

依赖关系：

- 依赖 `profile-management`：根据当前儿童档案展示个性化推荐。
- 依赖 `membership`：展示免费、试看、会员状态。
- 依赖 `book-create`：进入创建类似作品。
- 依赖 `book-player`：进入播放页。
- 依赖 `shared`：搜索、卡片、标签、布局。

## 3.3 `features/book-player` 绘本播放器模块

功能范围：

- 绘本播放、暂停。
- 上一页、下一页。
- 进度条。
- 重新播放。
- 自动朗读。
- 手动翻页。
- 中文、英文、中英双语模式切换。
- 双语显示顺序切换。
- 当前句或段落高亮。
- 语速切换。
- 背景音乐开关。
- 音效开关。
- 朗读声音切换。
- 当前声音展示。
- 形象对白播放。
- 对口型动画同步。
- 共读提示。
- 学习卡片。
- 页面列表。
- 试看页数限制。
- 试看结束后的家长引导。

功能边界：

- 不负责绘本详情推荐。
- 不负责声音上传和声音创建。
- 不负责会员套餐页面。
- 不负责分享链接管理。
- 儿童播放主流程不展示购买、充值、诱导消费弹窗。

依赖关系：

- 依赖 `voice-library`：声音选择器。
- 依赖 `membership`：判断试看和会员访问状态。
- 依赖 `safety`：内容举报入口。
- 被 `share-export` 依赖：分享页只读播放能力。
- 被 `book-detail` 页面依赖：开始阅读入口跳转。

## 3.4 `features/book-create` 绘本创建模块

功能范围：

- 创建绘本向导。
- 基于故事生成绘本。
- 基于绘本模板创作绘本。
- 从系统故事开始。
- 从我的故事开始。
- 从上传或粘贴故事开始。
- 从一个想法生成故事开始。
- 选择儿童档案并带入默认配置。
- 选择或生成形象。
- 选择画风。
- 编辑分镜。
- 选择声音。
- 生成语音。
- 播放预览。
- 保存到个人绘本库。
- 生成任务状态展示。
- 失败重试。
- 局部重新生成。
- 创建类似作品预填。

功能边界：

- 基于故事生成时，可以选择画风、编辑分镜、重新生成页面。
- 基于绘本模板创作时，只允许替换模板角色头像/形象区域和朗读声音。
- 基于绘本模板创作时，不允许替换画风。
- 基于绘本模板创作时，不允许修改页面结构、正文、插图背景、视频、音效、对白内容、播放节奏。
- 不负责素材库完整管理页面，只调用素材选择器。
- 不负责会员套餐展示，只做权益限制提示。

依赖关系：

- 依赖 `auth`：创建流程登录守卫。
- 依赖 `profile-management`：儿童档案选择和默认配置。
- 依赖 `story-library`：故事选择器。
- 依赖 `character-library`：形象选择器。
- 依赖 `art-style-library`：画风选择器。
- 依赖 `voice-library`：声音选择器。
- 依赖 `membership`：生成次数、VIP 素材使用权限。
- 依赖 `safety`：上传授权、个人素材风险提示。
- 依赖 `book-player`：生成结果预览。

## 3.5 `features/story-library` 故事库模块

功能范围：

- 我的故事列表。
- 系统故事列表。
- 故事分类筛选。
- 主题标签筛选。
- 适龄范围筛选。
- 教育目标筛选。
- 免费/VIP 状态展示。
- 故事详情弹窗。
- 上传故事文本。
- 粘贴故事文本。
- 创建故事。
- 编辑故事。
- 删除故事。
- 保存故事。
- 从故事发起生成绘本。
- 展示故事关联的已生成绘本。

功能边界：

- 故事只作为纯文本内容资产。
- 不包含页面、插图、视频、音频、对白时间轴、播放进度。
- 不作为绘本模板管理。
- 不负责完整绘本播放。

依赖关系：

- 依赖 `auth`：我的故事需要登录。
- 依赖 `membership`：VIP 故事使用权限。
- 依赖 `book-create`：发起生成绘本。
- 依赖 `safety`：上传版权提示。
- 被 `book-create` 依赖：故事选择。
- 被 `discovery` 依赖：首页系统故事预览。

## 3.6 `features/profile-management` 儿童档案模块

功能范围：

- 创建儿童档案。
- 编辑儿童档案。
- 删除儿童档案。
- 设置当前儿童档案。
- 昵称、年龄段、兴趣标签、阅读水平、教育目标维护。
- 关联默认形象。
- 关联默认声音。
- 关联默认画风。
- 儿童档案独立阅读历史。
- 儿童档案独立收藏。
- 儿童档案关联个人绘本库。
- 档案详情面板。

功能边界：

- 不负责具体形象创建。
- 不负责具体声音上传。
- 不负责具体画风创建。
- 不负责推荐算法，只提供当前档案信息给推荐模块使用。

依赖关系：

- 依赖 `auth`：档案属于登录账号。
- 依赖 `character-library`：默认形象选择。
- 依赖 `voice-library`：默认声音选择。
- 依赖 `art-style-library`：默认画风选择。
- 依赖 `membership`：档案数量限制。
- 被 `discovery` 依赖：个性化推荐。
- 被 `book-create` 依赖：生成默认配置。

## 3.7 `features/character-library` 形象库模块

功能范围：

- 我的形象列表。
- 系统形象库。
- 创建个人形象。
- 通过文字描述生成形象。
- 上传参考图片辅助创建形象。
- 形象预览。
- 形象重命名。
- 删除形象。
- 设置默认形象。
- 系统形象分类筛选。
- 免费/VIP 状态展示。
- 形象选择器。

功能边界：

- 不负责绘本生成向导，只提供选择和管理能力。
- 不决定最终绘本画风。
- 推荐画风只是辅助信息，不能替代独立画风选择。
- 删除形象不删除历史绘本中的已生成图片。

依赖关系：

- 依赖 `auth`：我的形象需要登录。
- 依赖 `membership`：个人形象数量、VIP 系统形象权限。
- 依赖 `safety`：上传图片授权确认。
- 被 `book-create` 依赖：形象选择。
- 被 `profile-management` 依赖：默认形象选择。

## 3.8 `features/voice-library` 声音库模块

功能范围：

- 我的声音列表。
- 系统声音库。
- 上传声音样本。
- 声音授权确认。
- 声音处理状态展示。
- 声音试听。
- 声音重命名。
- 删除声音。
- 设置默认声音。
- 系统声音筛选。
- 免费/VIP 状态展示。
- 声音选择器。

功能边界：

- 不负责播放器整体控制。
- 不负责生成绘本流程。
- 不负责音频合成任务编排，只展示处理状态和可用结果。
- 删除声音不删除历史绘本中的已生成音频。

依赖关系：

- 依赖 `auth`：我的声音需要登录。
- 依赖 `membership`：个人声音数量、VIP 系统声音权限。
- 依赖 `safety`：声音授权确认、风险提示。
- 被 `book-player` 依赖：播放时切换朗读声音。
- 被 `book-create` 依赖：生成时选择声音。
- 被 `profile-management` 依赖：默认声音选择。

## 3.9 `features/art-style-library` 画风库模块

功能范围：

- 系统画风展示。
- 画风详情。
- 画风筛选。
- 画风对比。
- 自定义画风描述。
- 免费/VIP 状态展示。
- 画风选择器。

功能边界：

- 画风是独立资源，不属于形象必填属性。
- 不负责形象创建。
- 不负责绘本模板创作中的画风变更。
- 模板创作流程不应调用画风选择器。

依赖关系：

- 依赖 `membership`：VIP 画风使用权限。
- 被 `book-create` 依赖：基于故事生成时选择画风。
- 被 `profile-management` 依赖：默认画风选择。
- 被 `discovery` 依赖：首页画风预览。

## 3.10 `features/membership` 会员与权益模块

功能范围：

- 会员套餐展示。
- 权益对比。
- 当前权益摘要。
- 会员绘本访问判断。
- 试看页数判断。
- 生成次数判断。
- 儿童档案数量限制。
- 个人故事数量限制。
- 个人形象数量限制。
- 个人声音数量限制。
- 分享数量限制。
- PDF 导出次数限制。
- VIP 故事、形象、画风、声音使用限制。
- 升级提示。

功能边界：

- 不负责具体支付实现细节。
- 不负责绘本播放。
- 不负责素材创建。
- 不负责登录表单，只在需要时跳转或调用登录守卫。

依赖关系：

- 依赖 `auth`：订阅和权益归属账号。
- 被 `discovery` 依赖：绘本访问状态。
- 被 `book-player` 依赖：试看控制。
- 被 `book-create` 依赖：生成额度和 VIP 素材权限。
- 被 `story-library`、`character-library`、`voice-library`、`art-style-library` 依赖：资源权益展示。
- 被 `share-export` 依赖：分享和导出额度。

## 3.11 `features/share-export` 分享与导出模块

功能范围：

- 选择要分享或导出的绘本。
- 生成分享链接。
- 复制分享链接。
- 关闭分享链接。
- 恢复分享链接。
- 重新生成分享链接。
- 设置访问范围。
- 展示二维码。
- PDF 导出。
- PDF 清晰度选择。
- 导出次数展示。
- 分享记录。
- 分享含个人形象或个人声音的隐私确认。

功能边界：

- 不负责绘本内容编辑。
- 不负责播放器内部实现，只复用只读播放能力。
- 不负责会员套餐展示。
- 不负责个人素材管理。

依赖关系：

- 依赖 `auth`：个人绘本分享需要登录。
- 依赖 `book-player`：分享页只读播放。
- 依赖 `membership`：分享数量、导出次数、导出清晰度。
- 依赖 `safety`：个人素材隐私确认。

## 3.12 `features/safety` 安全与隐私模块

功能范围：

- 真人验证入口。
- 上传图片授权确认。
- 上传故事版权提示。
- 上传声音授权确认。
- 个人形象分享隐私提醒。
- 个人声音分享隐私提醒。
- 风险操作二次确认。
- 内容举报入口。
- 儿童阅读区商业干扰约束提示。

功能边界：

- 不负责具体业务流程。
- 不负责账号登录。
- 不负责会员权益计算。
- 不负责素材管理。

依赖关系：

- 被 `auth` 依赖：真人验证。
- 被 `character-library` 依赖：图片上传授权。
- 被 `voice-library` 依赖：声音授权。
- 被 `story-library` 依赖：故事上传版权提示。
- 被 `share-export` 依赖：分享隐私确认。
- 被 `book-player` 依赖：举报入口。

## 4. 领域资源模块划分

`entities` 层不做完整业务流程，只沉淀跨模块共用的资源能力。

| 资源模块 | 职责 | 被哪些业务模块使用 |
| --- | --- | --- |
| `entities/account` | 账号摘要、登录方式展示、账号状态展示 | `auth`, `app` |
| `entities/child-profile` | 儿童档案卡片、档案摘要、档案标签展示 | `profile-management`, `discovery`, `book-create` |
| `entities/story` | 故事卡片、故事标签、故事状态展示 | `story-library`, `book-create`, `discovery` |
| `entities/picture-book` | 绘本卡片、封面、绘本元信息、访问状态展示 | `discovery`, `book-player`, `share-export` |
| `entities/picture-book-template` | 模板卡片、模板角色替换说明、模板锁定信息展示 | `book-create` |
| `entities/character` | 形象卡片、形象头像、形象来源和权益状态展示 | `character-library`, `book-create`, `profile-management` |
| `entities/voice` | 声音卡片、试听入口、声音状态展示 | `voice-library`, `book-create`, `book-player`, `profile-management` |
| `entities/art-style` | 画风卡片、示例预览、权益状态展示 | `art-style-library`, `book-create`, `profile-management` |
| `entities/membership-plan` | 套餐卡片、权益项展示 | `membership` |
| `entities/generation-task` | 生成任务状态、进度、失败原因展示 | `book-create`, `discovery` |
| `entities/share-link` | 分享链接状态、访问范围、分享记录展示 | `share-export` |

## 5. 共享模块划分

### 5.1 基础 UI

范围：

- Button。
- IconButton。
- Input。
- Textarea。
- Select。
- Checkbox。
- Switch。
- Tabs。
- Modal。
- Drawer。
- Toast。
- Badge。
- Tag。
- Card。
- EmptyState。
- Skeleton。
- ConfirmDialog。
- ProgressBar。
- Stepper。
- SearchInput。

边界：

- 只提供视觉和交互基础能力。
- 不包含业务判断。
- 不直接调用业务 API。

### 5.2 通用布局

范围：

- 顶部导航。
- 底部导航。
- 页面标题。
- 双栏布局。
- 响应式网格。
- 内容容器。
- Sticky 侧栏。

边界：

- 不内置具体业务数据。
- 菜单项和操作入口由上层传入。

### 5.3 通用 API

范围：

- HTTP 客户端。
- 请求拦截。
- 响应错误处理。
- 登录失效处理。
- 分页参数。
- 文件上传基础能力。

边界：

- 不写具体业务接口。
- 业务接口放在对应 feature 或 entity 内。

### 5.4 通用交互能力

范围：

- 响应式断点。
- 防抖。
- 节流。
- 倒计时。
- 本地存储。
- 弹窗状态。
- 异步状态。
- URL Query 读写。

边界：

- 不包含具体业务语义。

### 5.5 样式与主题

范围：

- 品牌色。
- 字体。
- 圆角。
- 阴影。
- 间距。
- 断点。
- 动效时长。
- 层级 z-index。

边界：

- 原型中的重复按钮、卡片、导航、标签样式统一迁移到共享层。
- 页面模块只保留页面特有布局样式。

## 6. 跨模块依赖关系

### 6.1 登录依赖

需要登录守卫的模块：

- `book-create`
- `profile-management`
- `character-library` 的我的形象
- `voice-library` 的我的声音
- `story-library` 的我的故事
- `share-export`
- `membership` 的订阅操作

允许游客访问但需限制能力的模块：

- `discovery`
- `book-player`
- `story-library` 的系统故事
- `art-style-library`
- `membership`

### 6.2 会员依赖

依赖会员权益的模块：

- `discovery`：会员绘本、试看状态。
- `book-player`：试看页数、试看结束。
- `book-create`：生成次数、VIP 素材使用。
- `story-library`：VIP 系统故事。
- `character-library`：VIP 系统形象、个人形象数量。
- `voice-library`：VIP 系统声音、个人声音数量。
- `art-style-library`：VIP 系统画风。
- `profile-management`：儿童档案数量。
- `share-export`：分享数量、PDF 导出次数和清晰度。

约束：

- 权益判断由 `membership` 统一提供。
- 其他模块只消费权益结果，不自行计算套餐规则。

### 6.3 当前儿童档案依赖

依赖当前儿童档案的模块：

- `discovery`：个性化推荐、继续阅读。
- `book-create`：自动带入适龄范围、兴趣、阅读水平、教育目标、默认形象、默认声音、默认画风。
- `book-player`：记录阅读进度和阅读历史。
- `profile-management`：维护当前档案。

约束：

- 当前儿童档案由 `profile-management` 管理。
- 其他模块只读取和使用，不直接修改档案结构。

### 6.4 素材选择依赖

`book-create` 依赖三个素材选择能力：

- `character-library` 提供形象选择。
- `voice-library` 提供声音选择。
- `art-style-library` 提供画风选择。

约束：

- 素材库模块负责资源管理。
- 创建模块负责流程编排。
- 创建模块不得复制素材库列表逻辑。

### 6.5 播放能力依赖

依赖播放器能力的模块：

- `pages/player`：完整播放页。
- `book-detail`：开始阅读入口。
- `book-create`：生成后预览。
- `share-export`：分享页只读播放。

约束：

- 播放状态和播放控制归 `book-player`。
- 分享页只读播放不得开放编辑和生成入口。

### 6.6 安全隐私依赖

依赖安全隐私能力的模块：

- `auth`：异常登录、频繁验证码、真人验证。
- `story-library`：上传故事版权提示。
- `character-library`：上传参考图授权确认。
- `voice-library`：上传声音授权确认。
- `share-export`：个人形象、个人声音分享确认。
- `book-player`：内容举报。

约束：

- 儿童阅读主流程不得出现真人验证。
- 如确需验证，应引导家长在账号操作上下文完成。

## 7. 创建流程内部边界

### 7.1 基于故事生成绘本

包含步骤：

- 选择或生成故事。
- 选择或生成形象。
- 确定画风。
- 生成和编辑分镜。
- 选择声音并生成语音。
- 播放预览。
- 保存到个人绘本库。

依赖模块：

- `story-library`
- `character-library`
- `art-style-library`
- `voice-library`
- `book-player`
- `membership`
- `safety`

边界：

- 可以修改故事方向。
- 可以编辑分镜。
- 可以选择画风。
- 可以重新生成局部页面、局部语音或整本语音。

### 7.2 基于绘本模板创作

包含步骤：

- 选择绘本模板。
- 替换模板角色头像或形象。
- 选择朗读声音。
- 预览替换效果。
- 保存到个人绘本库。

依赖模块：

- `character-library`
- `voice-library`
- `book-player`
- `membership`
- `safety`

边界：

- 不能选择画风。
- 不能修改正文。
- 不能修改页面结构。
- 不能修改插图背景。
- 不能修改视频素材。
- 不能修改音效。
- 不能修改互动提示。
- 不能修改学习卡片。
- 不能修改播放节奏。

## 8. 多人开发拆分

### A 组：应用壳与共享基础

负责范围：

- `app`
- `shared`
- 全局样式。
- 路由骨架。
- 基础 UI。
- API 客户端。

对外交付：

- 可运行的前端应用骨架。
- 全局布局。
- 基础组件。
- 请求封装。
- 全局 Toast、Modal、Loading。

主要依赖：

- 无上游业务依赖。

### B 组：账号与儿童档案

负责范围：

- `features/auth`
- `features/profile-management`
- `entities/account`
- `entities/child-profile`

对外交付：

- 登录注册页。
- 登录守卫。
- 当前账号状态。
- 儿童档案管理。
- 当前儿童档案能力。

主要依赖：

- 依赖 A 组共享能力。
- 被 C、D、E、F、G 组依赖。

### C 组：首页、故事库与绘本详情

负责范围：

- `features/discovery`
- `features/story-library`
- `pages/home`
- `pages/stories`
- `pages/book-detail`
- `entities/story`
- `entities/picture-book`

对外交付：

- 首页。
- 故事库。
- 绘本详情。
- 创建类似作品入口。
- 进入播放入口。

主要依赖：

- 依赖 A 组共享能力。
- 依赖 B 组当前儿童档案和登录态。
- 依赖 G 组会员状态。
- 依赖 E 组创建入口。
- 依赖 D 组播放入口。

### D 组：播放器与共读

负责范围：

- `features/book-player`
- `pages/player`

对外交付：

- 绘本播放器。
- 播放控制。
- 语言模式。
- 共读提示。
- 学习卡片。
- 页面列表。
- 试看控制。
- 分享页只读播放能力。

主要依赖：

- 依赖 A 组共享能力。
- 依赖 G 组会员与安全能力。
- 依赖 F 组声音选择能力。
- 被 C、E、G 组依赖。

### E 组：绘本创建流程

负责范围：

- `features/book-create`
- `pages/create`
- `entities/picture-book-template`
- `entities/generation-task`

对外交付：

- 创建向导。
- 基于故事生成流程。
- 基于模板创作流程。
- 生成任务状态。
- 播放预览。
- 保存个人绘本。

主要依赖：

- 依赖 A 组共享能力。
- 依赖 B 组登录态和儿童档案。
- 依赖 C 组故事选择。
- 依赖 D 组预览播放。
- 依赖 F 组形象、声音、画风选择。
- 依赖 G 组会员与安全能力。

### F 组：素材库

负责范围：

- `features/character-library`
- `features/voice-library`
- `features/art-style-library`
- `pages/characters`
- `pages/voices`
- `pages/art-styles`
- `entities/character`
- `entities/voice`
- `entities/art-style`

对外交付：

- 形象管理。
- 声音管理。
- 画风管理。
- 形象选择器。
- 声音选择器。
- 画风选择器。

主要依赖：

- 依赖 A 组共享能力。
- 依赖 B 组登录态。
- 依赖 G 组会员与安全能力。
- 被 B、D、E 组依赖。

### G 组：会员、分享与安全

负责范围：

- `features/membership`
- `features/share-export`
- `features/safety`
- `pages/membership`
- `pages/share`
- `entities/membership-plan`
- `entities/share-link`

对外交付：

- 会员页。
- 权益判断能力。
- 升级提示。
- 分享与导出。
- 隐私确认。
- 举报入口。
- 上传授权确认。
- 真人验证入口。

主要依赖：

- 依赖 A 组共享能力。
- 依赖 B 组登录态。
- 依赖 D 组只读播放能力。
- 被 C、D、E、F 组依赖。

## 9. 模块边界约束

- 页面只负责组合模块，不沉淀业务逻辑。
- 登录态只由 `auth` 管理。
- 当前儿童档案只由 `profile-management` 管理。
- 权益判断只由 `membership` 管理。
- 播放控制只由 `book-player` 管理。
- 素材资源管理只由对应素材库模块管理。
- 创建流程只负责编排，不复制素材库、播放器、会员逻辑。
- 分享页复用播放器，只读展示，不开放编辑。
- 故事是纯文本资产，不进入播放器逻辑。
- 绘本模板创作不得开放画风、正文、背景、结构修改能力。
- 儿童播放主流程不得出现商业购买入口。
- 个人素材分享前必须经过隐私确认。
