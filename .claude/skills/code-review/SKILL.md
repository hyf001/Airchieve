---
name: code-review
description: 用于 AIrchieve 项目的代码审查技能。当用户要求 review、审查代码、检查改动、评估实现是否合理时使用。重点检查三件事：1. 逻辑是否正确；2. 是否尽量复用了项目已有的公共模块、服务、hooks、utils 和组件；3. 代码分层、职责边界和目录结构是否符合当前项目约定。
---

# AIrchieve Code Review

这个技能面向 AIrchieve 项目的代码审查，核心不是泛泛找问题，而是围绕下面三类检查展开：

1. 逻辑是否正确
2. 是否尽量使用了项目已有的公共模块
3. 代码分层和结构是否合规
4. 类型是否尽量收窄，是否避免使用万能类型

## 什么时候使用

当用户明确要求以下任务时触发：

- “review 这段代码”
- “帮我做 code review”
- “看看这个实现是否合理”
- “检查这次改动有没有问题”
- “审一下这个 PR / diff”

如果用户主要是在请求实现、修复、测试或解释代码，不要优先使用这个技能。

## 审查范围

默认覆盖当前仓库三端：

- 后端：`app/`
- Web 前端：`frontend/src/`
- 小程序：`miniprogram/`

## 审查主轴

### 1. 逻辑正确性

重点检查：

- 功能流程是否符合需求
- 分支、边界值、空值、异常路径是否正确
- 状态更新是否完整
- 异步流程、轮询、后台任务是否有竞态、遗漏或重复执行
- 数据读写顺序是否正确
- 返回值、状态码、字段含义是否和调用方契约一致

### 2. 公共模块复用情况

重点检查：

- 是否重复造轮子
- 是否绕过了已有服务层、工具函数、认证依赖或 UI 组件
- 是否新增了本可复用的逻辑，却散落在错误位置
- 是否直接写死了已有抽象本应统一管理的行为

### 3. 分层与结构合规性

重点检查：

- API 层是否只做请求解析、鉴权和响应封装
- 业务逻辑是否留在 `services/`
- 数据结构是否放在 `models/` 或 `schemas/`
- 公共能力是否放在 `core/`、`utils/`、`hooks/`、`services/`
- 前端页面、组件、hooks、service 是否各司其职
- 是否有跨层直连、职责混乱、目录放错或循环依赖倾向
- API 文件里是否堆积了过多 `BaseModel` 请求/响应对象；如果这些对象已经服务于完整业务域而不是极小范围局部场景，应下沉到 `app/schemas/`

### 4. 类型收窄情况

重点检查：

- 是否出现了不必要的 `any`
- 是否把本应有结构的数据写成 `unknown`
- 是否把本应区分类型的数据写成万能 `dict` / `Record<string, unknown>` / `Record<string, any>`
- Python 里是否出现了过宽的 `Any`、`Optional[Any]`
- 是否大量手拼 `dict` 来表达有稳定字段的业务对象、请求/响应、服务层入参或返回值；这类结构应优先使用 Pydantic schema、dataclass、TypedDict、ORM model 或明确的领域类
- JSON / content / payload 类型是否本可按 `layer_type`、`kind`、`type` 等字段收窄却没有收窄
- 泛型、联合类型、TypedDict、Pydantic schema、TS interface 是否可以进一步表达真实约束

优先指出这些会带来真实风险的情况：

- 掩盖字段拼写错误
- 让调用方无法获得正确提示
- 让字段契约散落在多个手写 `dict` 中，导致响应、service 入参和测试断言容易漂移
- 让运行时非法数据混入核心流程
- 让后续重构和 review 难以判断真实结构

## AIrchieve 项目中已有的公共模块和工具

review 时要主动检查新代码是否应该复用这些现成能力。

### 后端公共能力

- `app/api/deps.py`
  - `get_current_user`
  - `get_current_admin`
  - 用于统一鉴权与管理员校验

- `app/core/config.py`
  - 统一配置读取
  - 不应在业务代码中自行散落读取环境变量

- `app/core/security.py`
  - 统一 token / 安全相关逻辑

- `app/core/utils/logger.py`
  - `get_logger`
  - 统一日志输出

- `app/core/utils/prompt_util.py`
  - 已有 prompt 相关工具时优先复用

- `app/db/session.py`
  - `async_session_maker`
  - `get_db`
  - 统一数据库 session 获取方式

- `app/services/llm_cli.py`
  - `LLMClientBase`
  - `LLMError`
  - 统一 LLM 客户端抽象与错误模型

- `app/services/oss_service.py`
  - 统一 OSS 上传/访问逻辑

- `app/services/points_service.py`
  - 积分检查和扣减逻辑应优先复用这里

- `app/services/payment_service.py`
  - 支付业务逻辑应集中在这里

- `app/services/storybook_service.py`
- `app/services/page_service.py`
- `app/services/layer_service.py`
- `app/services/template_service.py`
- `app/services/user_service.py`
- `app/services/thumbnail_service.py`
  - 相关业务应尽量接入已有 service，而不是在 API 或别处复制逻辑

- `app/models/enums.py`
  - 已有枚举应优先复用，避免重复写字符串常量

- `app/schemas/`
  - 已有 Pydantic schema、TypedDict、内容结构定义优先复用
  - 不要把本应结构化的请求、响应、content 长期保留为 `Any`

### Web 前端公共能力

- `frontend/src/services/`
  - `authService.ts`
  - `storybookService.ts`
  - `storyboardService.ts`
  - `templateService.ts`
  - `paymentService.ts`
  - API 调用应优先走这里，不要在组件里直接散写 fetch

- `frontend/src/hooks/`
  - `usePolling.ts`
  - `useEditorState.ts`
  - `useStorybookLoader.ts`
  - `useToolManager.ts`
  - 已有状态和异步封装应尽量复用

- `frontend/src/utils/editorUtils.ts`
  - 编辑器相关工具逻辑优先复用

- `frontend/src/contexts/AuthContext.tsx`
  - 登录态、用户态优先复用上下文，不要重复维护

- `frontend/src/components/ui/`
  - 通用 UI 组件优先复用，不要重复造基础按钮、弹窗、输入框

- `frontend/src/types/`
  - 共享类型应优先集中管理
  - 不要因为图省事把跨模块数据长期写成 `any`

### 小程序公共能力

- `miniprogram/services/`
  - `authService.js`
  - `storybookService.js`
  - `templateService.js`

- `miniprogram/utils/request.js`
  - 网络请求应优先复用统一封装

## 分层约定

### 后端

- `api/v1/`
  - 路由层
  - 负责参数接收、鉴权、调用 service、返回响应
  - 不应堆大量业务逻辑、数据库细节、外部服务调用细节

- `services/`
  - 业务逻辑层
  - 负责状态流转、跨模块协调、积分/支付/生成/上传等流程

- `models/`
  - ORM 模型、枚举、数据库实体定义

- `schemas/`
  - 请求/响应数据结构
  - 例如 `app/schemas/page.py` 这种集中管理方式
  - 如果某个 API 文件里定义了大量 request/response model，通常应拆到对应领域 schema 文件，例如 `app/schemas/storybook.py`

- `core/`
  - 配置、安全、日志、通用基础设施

- `db/`
  - 数据库基座和 session 管理

### 前端

- `pages/`
  - 页面级编排

- `components/`
  - 可复用 UI 和业务组件

- `services/`
  - API 调用封装

- `hooks/`
  - 状态和副作用复用逻辑

- `contexts/`
  - 全局上下文状态

- `utils/`
  - 纯工具函数

## 工作流程

1. 先确认 review 范围。
2. 逐项检查三件事：
   - 逻辑是否正确
   - 是否复用已有公共模块
   - 分层结构是否合规
3. 如果发现代码没有复用现成公共能力，要指出“已有哪一个模块本可复用”。
4. 如果发现分层问题，要指出“当前写法落在哪一层”和“按项目约定应该落在哪一层”。
5. 特别检查 API 文件里的 schema 定义数量和复杂度：
   - 少量、只在单个超小接口内使用的局部模型，可以暂时留在 API 文件
   - 一旦形成成组 request/response model，或被多个接口共享，就应建议迁移到 `app/schemas/`
6. 特别检查类型是否过宽：
   - TypeScript 中的 `any`、过宽 `unknown`、`Record<string, any>`、无必要的 `as any`
   - Python 中的 `Any`、`Optional[Any]`、过宽 `dict`
   - Python 中用手写 `dict` 代替稳定结构的 schema / dataclass / TypedDict / ORM model，尤其是 API response、service 参数、跨模块返回值
   - 本应按判别字段收窄的联合类型、content 类型、payload 类型
7. 只输出真正成立的问题。

## 输出规则

输出顺序固定为：

1. findings
2. open questions / assumptions
3. 简短 summary

每条 finding 尽量写清楚：

- 问题类别：逻辑 / 复用 / 分层 / 类型
- 严重程度
- 文件路径和行号
- 问题描述
- 为什么不符合当前项目
- 如果适用，指出应该复用的现有模块
- 如果属于分层问题，尽量指出应该迁移到哪个目录或模块，例如 `app/schemas/storybook.py`
- 如果属于类型问题，尽量指出可以收窄成什么，例如 union、TypedDict、Pydantic schema、dataclass、ORM model、领域类、具体 interface

推荐格式：

```markdown
- Medium — 复用 — [frontend/src/pages/EditorView.tsx:120] 这里直接发起请求而没有复用 `frontend/src/services/storybookService.ts`，会让接口契约和错误处理分散，增加后续维护成本。
```

如果没有发现问题，明确写：

```markdown
No findings.
```

## 审查原则

- 优先 correctness，其次复用和结构
- 遇到 `any` / `Any` / 过宽 `unknown` 时，默认检查是否真的不可避免
- 不为了显得严格而硬凑问题
- 不把纯风格问题当成主要 finding
- 不模糊表述，要尽量定位到具体模块和层级
- 指出问题时，尽量对应到项目里已存在的公共能力
