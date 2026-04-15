# text-edit 图层化改造方案

> 目标：将前端 `text-edit` 工具从“本地把文字合成到图片”的旧模式，改造成“基于后端 Layer API 的文字图层编辑器”。

---

## 一、改造背景

后端已经完成图层系统改造，页面详情现在具备以下能力：

- `Page` 作为独立实体存在
- `Layer` 作为页面下的独立图层存在
- `text / draw / image` 等编辑结果不再覆盖基图
- 页面详情可返回 `layers`

这意味着前端 `text-edit` 不能再继续沿用“本地合成 base64 覆盖 `image_url`”的方式，而应该直接操作文字图层。

---

## 二、当前前端现状

### 2.1 当前相关文件

文字编辑相关代码主要分布在：

- `frontend/src/components/editor/tools/text-edit/types.ts`
- `frontend/src/components/editor/tools/text-edit/hooks.ts`
- `frontend/src/components/editor/tools/text-edit/index.tsx`
- `frontend/src/components/editor/tools/text-edit/Overlay.tsx`
- `frontend/src/pages/EditorView.tsx`
- `frontend/src/services/storybookService.ts`

### 2.2 当前工作流

当前 `text-edit` 的实际流程仍然是：

```text
page.text / initialText
  -> useTextLayers() 生成前端本地 TextLayer[]
  -> Overlay 中拖拽/编辑
  -> 在 canvas 上把文字绘制到 base image
  -> 生成 base64
  -> 更新当前页面 image_url
  -> savePage 时整体保存页面
```

### 2.3 当前存在的问题

1. `TextLayer` 是前端私有结构，和后端 `Layer.content` 不一致
2. 文字工具操作的是“图片预览结果”，不是“持久化图层”
3. 页面切换后虽然会调用 `getPageDetail(page.id)`，但 `text-edit` 没有真正把 `detail.layers` 当成唯一数据源
4. `EditorView` 中的 `textLayers` 是独立状态，不利于未来统一接入 `draw / image / sticker`
5. “应用文字到图片”逻辑和后端图层化设计冲突，会重新走回覆盖基图的旧模式

---

## 三、改造目标

本次前端 `text-edit` 改造目标：

1. **文字图层持久化**  
   `text-edit` 直接调用 Layer API，新增/修改/删除文字图层。

2. **页面详情驱动**  
   页面打开后，从 `page detail.layers` 初始化文字工具，而不是从 `initialText` 自动创建。

3. **取消文字合成保存**  
   不再通过 canvas 把文字合成到 `image_url`。

4. **统一图层状态入口**  
   为后续 `draw / image / sticker` 工具预留统一的页面图层状态。

5. **兼容旧数据迁移**  
   对还没有 text layer、但 `page.text` 已存在的旧页面提供迁移兜底策略。

---

## 四、建议改造方向

建议按“三阶段”推进，不要一次性重做整个编辑器。

### 阶段一：先让 text-edit 接上后端图层接口

目标：文字图层真正存取后端，但不立即重构所有编辑器状态。

#### 4.1 补齐前端 layer API

在 `frontend/src/services/storybookService.ts` 中补齐这些接口：

```ts
getPageLayers(pageId: number)
createLayer(pageId: number, payload)
updateLayer(pageId: number, layerId: number, payload)
deleteLayer(pageId: number, layerId: number)
reorderLayers(pageId: number, layerIds: number[])
```

同时扩展现有类型：

- `StorybookLayer`
- `StorybookPageWithLayers`

建议将 `StorybookLayer.content` 从 `unknown` 逐步细化为联合类型，至少先支持 `text`。

这里的“收窄”指的是前后端类型与校验收窄：

- 前端 TypeScript 类型收窄
- 后端 Pydantic schema 收窄
- 后端 service 层按 `layer_type` 做内容校验

不涉及新增数据库表，也不涉及新增一套持久化模型。

#### 4.2 定义 text layer 的前端内容类型

建议新增一个与后端 text layer content 对齐的类型，例如：

```ts
export interface TextLayerContent {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  textAlign?: string;
  lineHeight?: number;
  backgroundColor?: string;
  borderRadius?: number;
  rotation?: number;
}
```

再提供两个转换函数：

- `storybookLayerToTextLayerViewModel`
- `textLayerViewModelToLayerPatch`

不要让 `Overlay` 和 `Panel` 直接消费后端原始 `unknown content`。

#### 4.2.1 后端也需要同步收窄

后端当前图层定义仍然比较宽：

- `app/models/layer.py`
  - `content: Mapped[Optional[Any]]`
- `app/schemas/page.py`
  - `LayerCreate.content: Optional[Any]`
  - `LayerUpdate.content: Optional[Any]`
  - `LayerResponse.content: Optional[Any]`

建议改成“按图层类型收窄，但不改表结构”的方式。

推荐方向：

1. 在 `app/schemas/page.py` 中新增内容类型定义，例如：
   - `TextLayerContent`
   - `DrawLayerContent`
   - `ImageLayerContent`

2. 定义联合类型，例如：

```python
LayerContent = TextLayerContent | DrawLayerContent | ImageLayerContent | dict
```

3. 将这些 schema 用到：
   - `LayerCreate.content`
   - `LayerUpdate.content`
   - `LayerResponse.content`

4. 在 `app/services/layer_service.py` 中增加基于 `layer_type` 的校验：
   - `layer_type == "text"` 时，要求 `content` 满足文字图层结构
   - `layer_type == "draw"` 时，要求 `content` 满足绘画图层结构
   - `layer_type == "image"` 时，要求 `content` 满足图片图层结构

5. `app/models/layer.py` 可以继续用 JSON 列存储，不需要新增表；
   这里更重要的是把 ORM 注解和业务约束表达清楚，而不是扩展数据库结构。

也就是说，这次后端收窄的重点是：

- schema 层有明确结构
- service 层有明确校验
- model 层仍然沿用现有 `layers.content` JSON 存储

而不是再创建新的数据模型表。

#### 4.3 页面加载时接管 `detail.layers`

当前 `EditorView.tsx` 已经在页面切换时调用：

```ts
getPageDetail(page.id)
```

改造后建议：

- 页面切换时拿到 `detail.layers`
- 把它保存成“当前页面图层状态”
- `text-edit` 只从中筛选 `layer_type === 'text'`

也就是说，`text-edit` 的初始化数据源应从：

```ts
initialText
```

改成：

```ts
pageLayers.filter(layer => layer.layer_type === 'text')
```

#### 4.4 旧数据迁移兜底

对于旧页面，可能存在：

- `page.text` 有内容
- 但 `layers` 中没有任何 `text` layer

建议不要静默自动创建图层，而是采用更可控方式：

- 打开文字工具时检测到该情况
- 提示用户“检测到旧版页面文字，是否转换为文字图层？”

这样更符合用户预期，也能避免 `page.text` 和 text layer 双写混乱。

---

### 阶段二：把 text-edit 从“图片合成工具”改成“图层编辑器”

目标：文字工具只操作 layer，不再操作 `image_url`。

#### 4.5 删除文字合成到 canvas 的 apply 流程

当前需要逐步移除的旧逻辑：

- `frontend/src/components/editor/tools/text-edit/index.tsx`
  - `handleApply`
- `frontend/src/pages/EditorView.tsx`
  - `onTextApply`

这些逻辑本质上是：

```text
文字图层 -> 绘制到 canvas -> 导出 base64 -> 更新 image_url
```

改造后应替换为：

```text
新增 / 修改 / 删除 text layer -> 调用 Layer API -> 重新渲染 Overlay
```

#### 4.6 保留 Overlay 交互，修改持久化方式

当前这些交互可以保留：

- 点击选择图层
- 拖拽移动
- resize
- 输入文字
- 改字体
- 改颜色
- 改粗细
- 删除图层

但这些交互不再输出 `imageUrl`，而是：

- 本地更新图层 view state
- 在适当时机同步到后端

#### 4.7 同步策略建议

为了兼顾体验和接口压力，建议采用：

- 输入文字：`300~500ms` 防抖 `PATCH`
- 拖拽移动：`mouseup` 后 `PATCH`
- 缩放：`mouseup` 后 `PATCH`
- 改字体/颜色/粗细：立即 `PATCH`
- 删除：立即 `DELETE`
- 新增：立即 `POST`

不建议在每次 `mousemove` 时直接发请求。

---

### 阶段三：抽象成统一页面图层状态

目标：给后续 `draw / image / sticker` 共用。

#### 4.8 在 EditorView 引入统一的 `pageLayers`

当前 `EditorView.tsx` 使用的是：

```ts
const [textLayers, setTextLayers] = useState<TextLayer[]>([])
```

建议升级为：

```ts
const [pageLayers, setPageLayers] = useState<StorybookLayer[]>([])
```

然后：

- `text-edit` 只读写其中的 text 子集
- `EditorCanvas` 后续统一从 `pageLayers` 渲染各类图层

#### 4.9 抽一个 `usePageLayers(pageId)` hook

建议新增一个页面图层管理 hook，职责包括：

- 拉取页面详情和图层列表
- 本地维护 `pageLayers`
- 执行 optimistic update
- 调用 `create / update / delete / reorder` 接口
- 暴露 `textLayers` 等选择器

这样可以明显降低 `EditorView` 的复杂度。

#### 4.10 text-edit 只保留工具 UI 职责

当前 `useTextLayers()` 自己管理完整的 source of truth。

后续建议改成：

- `text-edit` 接收外部传入的 `layers`
- `text-edit` 只负责编辑和交互
- 实际数据由 `usePageLayers` 或 `EditorView` 统一管理

即从“工具自己管数据”改成“工具消费页面层数据”。

---

## 五、建议的数据结构

### 5.1 前端统一 layer 类型

建议在 `storybookService.ts` 或独立 `types/layer.ts` 中定义：

```ts
export interface StorybookLayer {
  id: number;
  page_id: number;
  layer_type: 'text' | 'draw' | 'image' | 'sticker' | 'adjustment';
  layer_index: number;
  visible: boolean;
  locked: boolean;
  content: TextLayerContent | DrawLayerContent | ImageLayerContent | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

### 5.2 text-edit 的视图模型

`Overlay` 和 `Panel` 可以继续使用贴近交互层的类型，但建议通过转换函数统一映射：

```ts
export interface TextLayerViewModel {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
}
```

这里的：

- `color` 对应后端 `fontColor`
- `bold` 对应后端 `fontWeight === 'bold'`

---

## 六、和 `page.text` 的关系

这是本次改造中最容易混乱的一点。

### 6.1 建议规则

短期内建议明确区分：

- `page.text`
  - 表示故事正文
  - 属于页面文本内容

- `text layer`
  - 表示画面上的可编辑文字元素
  - 属于图层系统

### 6.2 不建议长期双向同步

不建议保持：

```text
page.text <-> text layer
```

的自动双向同步，否则会带来：

- 用户不知道自己编辑的是故事正文还是画面文字
- 一个字段改动影响另一个字段
- 保存和回滚语义变得混乱

### 6.3 推荐策略

- 旧数据迁移时，允许“把 page.text 转成一个默认文字图层”
- 迁移完成后，`text-edit` 只管 text layer
- 页面正文的编辑继续走 page 维度更新逻辑

---

## 七、具体文件改造建议

### 7.1 `frontend/src/services/storybookService.ts`

需要改造：

- 新增 Layer API
- 扩展 layer 类型
- 明确 `StorybookPageWithLayers`

建议优先完成，这是其他前端改造的基础。

### 7.2 `frontend/src/pages/EditorView.tsx`

需要改造：

- 引入 `pageLayers`
- 页面切换后接管 `detail.layers`
- 去掉文字合成后写 `image_url` 的逻辑
- 逐步移除 `textLayers` 作为独立 source of truth

### 7.3 `frontend/src/components/editor/tools/text-edit/types.ts`

需要改造：

- 当前 `TextLayer` 改为贴近后端 text layer content
- 或新增 `TextLayerViewModel`
- `id` 建议从字符串迁移为数字主键

### 7.4 `frontend/src/components/editor/tools/text-edit/hooks.ts`

需要改造：

- 去掉基于 `initialText` 自动创建文字图层
- 改成编辑外部传入 layer
- 只保留交互状态和局部编辑逻辑

### 7.5 `frontend/src/components/editor/tools/text-edit/index.tsx`

需要改造：

- 删除 `handleApply`
- 删除 canvas 合成文字逻辑
- 改成调用 `create / update / delete layer`
- 面板只做文字图层属性编辑

### 7.6 `frontend/src/components/editor/EditorCanvas.tsx`

需要改造：

- text overlay 的数据来源从 `textLayers` 改成 `pageLayers` 的 text 子集
- 后续为 draw/image 统一预留图层渲染入口

---

## 八、推荐实施顺序

建议按下面顺序推进：

1. 补 `storybookService.ts` 的 Layer API 与类型
2. 在 `EditorView` 页面切换逻辑中接入 `detail.layers`
3. 改 `text-edit/types.ts` 与 view model
4. 改 `text-edit/hooks.ts`，去掉自动造默认图层
5. 改 `text-edit/index.tsx`，去掉 canvas apply，改走 layer API
6. 改 `EditorCanvas.tsx`，统一从页面图层渲染
7. 最后再抽 `usePageLayers(pageId)`

---

## 九、风险点

实施时需要特别注意：

1. **页面切换污染**
   - 旧页面的 selected layer、拖拽状态、防抖请求不能污染新页面

2. **防抖请求错写**
   - 当用户快速切页时，旧页未完成的 `PATCH` 不能写到当前页

3. **optimistic update 回滚**
   - 本地先更新后，如果接口失败，要么回滚，要么明确提示用户刷新

4. **字段映射不一致**
   - 前端现有 `color / bold` 与后端 `fontColor / fontWeight` 需要统一映射

5. **旧数据迁移歧义**
   - `page.text` 是否自动转成 text layer，需要产品和交互提前定清楚

6. **保存按钮语义变化**
   - 一旦文字图层改成实时持久化，“保存页面”按钮的职责需要重新定义

---

## 十、结论

这次前端 `text-edit` 改造的核心，不是“继续优化本地文字合成”，而是：

- 把文字工具接入 Layer API
- 把页面图层作为唯一可信数据源
- 把 `text-edit` 从图片处理工具改造成图层编辑工具

只有这样，后续 `draw / image / sticker / 导出合成 / 图层排序 / 二次编辑` 才能在同一套前后端模型下稳定演进。
