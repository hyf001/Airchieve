# text-edit 图层化改造方案（最终实施版）

> 目标：将 `text-edit` 工具从“本地 Canvas 合成文字并覆盖 `image_url`”改造成“基于 Layer API 的文字图层编辑器”，同时保证前后端图层类型逐步收窄，但不新增任何数据模型表。

---

## 一、核心变化

```text
旧：
文字 -> Canvas 合成 -> base64 -> 覆盖 image_url -> savePage

新：
文字 -> Layer API -> 独立图层持久化 -> DOM/Overlay 渲染
```

关键原则：

1. 基图 `image_url` 不再因文字编辑被覆盖
2. `text-edit` 操作的是 `Layer`
3. 页面图层以 `page detail.layers` 为唯一可信数据源
4. 前后端都收窄图层内容类型
5. 不新增表，不新增新的持久化模型

---

## 二、改造范围

本次前端主改造涉及 8 个文件：

| 文件 | 变更 |
|------|------|
| `frontend/src/services/storybookService.ts` | 新增 Layer API、补图层类型、收窄 `content` |
| `frontend/src/components/editor/tools/text-edit/types.ts` | 重写：对齐后端 text layer 结构、补转换函数 |
| `frontend/src/components/editor/tools/text-edit/hooks.ts` | 重写：本地编辑 + 后端持久化 + 防抖自动保存 |
| `frontend/src/components/editor/tools/text-edit/index.tsx` | 删除 Canvas 合成逻辑，改为图层编辑面板 |
| `frontend/src/components/editor/tools/text-edit/Overlay.tsx` | 更新字段名与交互数据源 |
| `frontend/src/components/editor/EditorCanvas.tsx` | 移除 `onTextApply`，从图层数据渲染文字 |
| `frontend/src/components/editor/tools/ToolPanel.tsx` | 给文字工具传 `pageId`、`initialLayers` |
| `frontend/src/pages/EditorView.tsx` | 接管 `detail.layers`，移除本地文字合成逻辑 |

后端本次只做“类型和校验收窄”，不改表结构，主要涉及：

| 文件 | 变更 |
|------|------|
| `app/schemas/page.py` | 新增 `TextLayerContent / DrawLayerContent / ImageLayerContent` 等 schema |
| `app/services/layer_service.py` | 按 `layer_type` 校验 `content` |
| `app/models/layer.py` | 保持现有 JSON 存储，可适度收紧注解与注释 |

---

## 三、当前问题

### 3.1 现有 text-edit 的问题

当前流程仍然是：

```text
initialText / page.text
  -> useTextLayers()
  -> Overlay 编辑
  -> Canvas 合成文字
  -> 生成 base64
  -> 更新当前页面 image_url
  -> savePage
```

问题包括：

1. `TextLayer` 是前端私有结构，和后端 `Layer.content` 不一致
2. `text-edit` 编辑的是图片预览结果，而不是持久化图层
3. 页面切换后虽然有 `getPageDetail(page.id)`，但没有以 `detail.layers` 为唯一数据源
4. `EditorView` 里的 `textLayers` 是孤立状态，不利于后续统一支持 `draw / image / sticker`
5. 文字工具仍然会走回“覆盖基图”的旧链路

### 3.2 现有后端图层类型过宽

当前后端定义中：

- `app/models/layer.py`
  - `content: Mapped[Optional[Any]]`
- `app/schemas/page.py`
  - `LayerCreate.content: Optional[Any]`
  - `LayerUpdate.content: Optional[Any]`
  - `LayerResponse.content: Optional[Any]`

这会导致：

- 前端拿到 `content` 后只能当 `unknown` / `any`
- 后端无法按 `layer_type` 保证结构正确
- text-edit 落地时容易出现字段名漂移

---

## 四、最终设计决策

### 4.1 页面图层是唯一可信数据源

页面打开后，以：

```ts
getPageDetail(pageId).layers
```

作为图层数据来源。

也就是说：

- `text-edit` 不再从 `initialText` 自动创建文字图层
- `text-edit` 只消费 `pageLayers` 中 `layer_type === 'text'` 的子集
- `text-edit` 不再是图层 source of truth

### 4.2 `page.text` 和 `text layer` 独立

短期内明确区分：

- `page.text`
  - 故事正文
  - 页面维度字段

- `text layer`
  - 画面上的可编辑文字元素
  - 图层维度字段

不做自动双向同步。

### 4.3 旧数据迁移方式

当页面满足：

- `page.text` 有内容
- 但 `layers` 中没有任何 `text` layer`

处理方式：

- 不静默自动创建
- 打开文字工具时提示用户：
  - “检测到旧版页面文字，是否转换为文字图层？”

### 4.4 前后端类型都收窄，但不新增表

这次“收窄”的含义是：

- 前端 TypeScript 类型从 `unknown` 收窄
- 后端 Pydantic schema 从 `Any` 收窄
- 后端 service 层按 `layer_type` 增加内容校验

不是：

- 新增表
- 新增 ORM 实体
- 重做 Layer 存储结构

数据库层继续使用现有 `layers.content` JSON 列。

### 4.5 `StorybookLayer.content` 不做 text-only 锁死

虽然本次只改 `text-edit`，但前端和后端的图层类型不应直接锁成：

```ts
content: TextLayerContent | null
```

更稳妥的方式是：

- 当前实现优先支持 `text`
- 类型层面保留联合类型，为 `draw / image` 预留空间

---

## 五、类型设计

### 5.1 前端类型设计

建议在 `frontend/src/services/storybookService.ts` 或独立 `types/layer.ts` 中定义：

```ts
export type LayerType = 'text' | 'draw' | 'image' | 'sticker' | 'adjustment';

export interface TextLayerContent {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  textAlign?: string;
  lineHeight?: number;
  backgroundColor?: string;
  borderRadius?: number;
  rotation?: number;
}

export interface DrawLayerContent {
  strokes: Array<{
    points: number[][];
    color: string;
    brushSize: number;
  }>;
}

export interface ImageLayerContent {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  rotation?: number;
  opacity?: number;
}

export type LayerContent =
  | TextLayerContent
  | DrawLayerContent
  | ImageLayerContent
  | Record<string, unknown>;

export interface StorybookLayer {
  id: number;
  page_id: number;
  layer_type: LayerType;
  layer_index: number;
  visible: boolean;
  locked: boolean;
  content: LayerContent | null;
  created_at: string;
  updated_at: string;
}
```

### 5.2 text-edit 视图模型

`Overlay` 和 `Panel` 不直接消费原始后端 layer，而是消费转换后的视图模型：

```ts
export interface TextLayerViewModel {
  id: number;
  pageId: number;
  layerIndex: number;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  textAlign: string;
  lineHeight: number;
  backgroundColor: string;
  borderRadius: number;
  rotation: number;
}
```

建议提供转换函数：

```ts
toTextLayerViewModel(layer: StorybookLayer): TextLayerViewModel
toTextLayerContent(view: TextLayerViewModel): TextLayerContent
```

### 5.3 后端 schema 设计

在 `app/schemas/page.py` 中新增：

```python
class TextLayerContent(BaseModel): ...
class DrawLayerContent(BaseModel): ...
class ImageLayerContent(BaseModel): ...

LayerContent = TextLayerContent | DrawLayerContent | ImageLayerContent | dict
```

然后将这些用于：

- `LayerCreate.content`
- `LayerUpdate.content`
- `LayerResponse.content`

### 5.4 后端 service 校验

在 `app/services/layer_service.py` 中增加按 `layer_type` 的内容校验：

- `layer_type == "text"` -> 校验 `TextLayerContent`
- `layer_type == "draw"` -> 校验 `DrawLayerContent`
- `layer_type == "image"` -> 校验 `ImageLayerContent`

模型层 `app/models/layer.py` 保持 JSON 列不变。

---

## 六、详细实施步骤

### Step 1: `storybookService.ts` — 补 Layer API 与联合类型

新增 API：

```ts
createLayer(pageId, data)          // POST   /pages/{pageId}/layers
updateLayer(pageId, layerId, data) // PATCH  /pages/{pageId}/layers/{layerId}
deleteLayer(pageId, layerId)       // DELETE /pages/{pageId}/layers/{layerId}
reorderLayers(pageId, layerIds)    // PATCH  /pages/{pageId}/layers/reorder
```

补充：

- `LayerType`
- `TextLayerContent`
- `DrawLayerContent`
- `ImageLayerContent`
- `LayerContent`
- `StorybookLayer`

注意：

- 本次 text-edit 只真正使用 `TextLayerContent`
- 但 `StorybookLayer.content` 仍保留联合类型，不做 text-only

### Step 2: `types.ts` — 对齐后端 text layer 结构

从当前旧结构：

- `id: string`
- `color`
- `bold: boolean`

迁移为：

- `id: number`
- `fontColor`
- `fontWeight`
- `pageId`
- `layerIndex`
- `visible`
- `locked`
- `textAlign`
- `lineHeight`
- `backgroundColor`
- `borderRadius`
- `rotation`

更新 `TextEditToolRef`：

- `id` 改 number
- 新增 `addLayer()`
- 去掉所有 `onApply` 相关能力

### Step 3: `hooks.ts` — 改为“本地编辑 + 后端持久化”

参数改为：

```ts
useTextLayers({
  pageId,
  initialLayers,
})
```

核心逻辑：

- 初始化：`initialLayers.filter(l => l.layer_type === 'text').map(toTextLayerViewModel)`
- 新建：`createLayer` -> 返回后端 layer -> 转成 view model -> 写入本地
- 编辑：本地即时更新 + 防抖 `updateLayer`
- 删除：本地移除 + `deleteLayer`
- 切页：监听 `initialLayers` 变化并重置本地 state
- 拖拽/缩放：mousemove 只更新本地，mouseup 后持久化

同步策略：

| 操作 | 策略 |
|------|------|
| 输入文字 | 300~500ms 防抖 PATCH |
| 拖拽/缩放 | mouseup 后 PATCH |
| 改字体/颜色/粗细 | 立即 PATCH |
| 删除 | 立即 DELETE |
| 新增 | 立即 POST |

### Step 4: `index.tsx` — 删除 Canvas 合成逻辑

移除：

- `baseImageUrl`
- `onApply`
- `handleApply`
- `isApplying`

改为：

- Props 使用 `{ pageId, initialLayers, containerRef, ... }`
- 无图层时显示“添加文字图层”按钮
- Panel 只做文字图层属性编辑

### Step 5: `Overlay.tsx` — 适配新字段

调整：

- `layer.id: string -> number`
- `color -> fontColor`
- `bold -> fontWeight`
- 删除 `onApply`
- 删除点击外部自动应用逻辑

### Step 6: `EditorCanvas.tsx` — 移除 `onTextApply`

移除：

- `onTextApply` prop

更新：

- `selectedLayerId: string | null -> number | null`
- `TextEditOverlay` 只负责渲染与交互

### Step 7: `ToolPanel.tsx` — 给 text 工具传 page 级数据

text 工具新增 props：

- `pageId`
- `initialLayers`

同时：

- 不再向 text 工具传 `onApply`
- 不再向 text 工具传 `baseImageUrl`
- `onPageEdited` 继续保留给 `ai-edit / draw`

### Step 8: `EditorView.tsx` — 接管页面图层状态

新增状态：

```ts
const [pageLayers, setPageLayers] = useState<StorybookLayer[]>([]);
```

在已有 `getPageDetail(page.id)` 中：

- 把 `detail.layers` 存入 `setPageLayers`

删除：

- `onTextApply`
- 文字 Canvas 合成相关代码
- text-edit 驱动 `image_url` 变化的逻辑

注意：

- 当前阶段 `pageLayers` 是页面级统一图层状态
- `text-edit` 从中筛 text layers
- `text-edit` 不是 source of truth

### Step 9: 后端同步收窄

#### `app/schemas/page.py`

新增：

- `TextLayerContent`
- `DrawLayerContent`
- `ImageLayerContent`
- `LayerContent`

更新：

- `LayerCreate`
- `LayerUpdate`
- `LayerResponse`

#### `app/services/layer_service.py`

新增：

- 按 `layer_type` 校验 content
- 避免 text layer 写入 draw 结构，反之亦然

#### `app/models/layer.py`

保持：

- 现有 JSON 列
- 不新增表

可选：

- 注释补充“content 结构由 layer_type 决定，并在 schema/service 层校验”

---

## 七、数据流

```text
页面加载:
  EditorView
  -> getPageDetail(pageId)
  -> detail.layers
  -> setPageLayers
  -> TextEditTool 从 pageLayers 中筛 text layers
  -> Overlay 渲染

用户新增:
  点击“添加文字图层”
  -> createLayer API
  -> 后端返回 layer
  -> 转换为 TextLayerViewModel
  -> 更新 pageLayers / text view state

用户编辑:
  Overlay / Panel 更新
  -> 本地 view state 即时更新
  -> 防抖或 mouseup 后 PATCH layer

用户删除:
  deleteLayer
  -> 本地移除
  -> DELETE API

切换页面:
  flush 防抖队列
  -> getPageDetail(nextPageId)
  -> setPageLayers
  -> text-edit 重置
```

---

## 八、关键设计决策

- **新建方式**：手动点击“添加文字图层”，不自动创建
- **切页策略**：flush 防抖队列，静默保存当前页已编辑内容
- **`page.text` 与 text layer**：两者独立，不自动双向同步
- **旧数据迁移**：检测到 `page.text` 但无 text layer 时，提示用户转换
- **统一状态方向**：页面级 `pageLayers` 是唯一可信图层状态
- **类型策略**：前后端都收窄，但 `content` 保持联合类型，不锁死 text-only
- **数据库策略**：沿用现有 JSON 列，不新增表
- **Undo/Redo**：本次不实现

---

## 九、不在本次范围

- Undo/Redo
- 图层面板 UI
- 导出合成
- draw/image/sticker 工具改造
- `usePageLayers` 的最终统一抽象

说明：

虽然最终建议抽 `usePageLayers(pageId)`，但本次可以先不做，避免范围过大。

---

## 十、风险点

1. **页面切换污染**
   - 旧页面的选中图层、拖拽状态、防抖请求不能带到新页面

2. **防抖请求错写**
   - 用户快速切页时，旧页未提交的 PATCH 不能写到新页

3. **optimistic update 回滚**
   - 本地先改、接口失败后需要回滚或明确提示

4. **字段映射漂移**
   - 前端旧字段 `color / bold` 与后端 `fontColor / fontWeight` 要统一

5. **旧数据迁移歧义**
   - `page.text` 是否转换为 text layer，要明确交互提示

6. **保存按钮语义变化**
   - 一旦文字图层实时持久化，“保存页面”按钮的职责需要重新定义

7. **text-only 假设污染**
   - 本次只改 text-edit，但不要把通用图层结构错误地简化为 text-only

---

## 十一、验证方式

1. 启动后端和前端
2. 打开已完成绘本，进入编辑器
3. 选择文字工具，应显示“添加文字图层”按钮
4. 新增文字图层，输入文字，拖拽、缩放、改字体、改颜色
5. 检查 Network，确认 Layer API 请求按预期触发
6. 切页再切回，确认图层从后端恢复
7. 刷新页面，确认图层仍存在
8. AI 改图后，文字图层不受影响
9. 对旧页面验证：
   - 若只有 `page.text` 无 text layer，应看到迁移提示

---

## 十二、结论

这次 `text-edit` 改造的核心，不是继续优化“本地文字合成”，而是：

- 把文字工具接入 Layer API
- 把页面图层作为唯一可信数据源
- 把 `text-edit` 从图片处理工具改造成图层编辑工具
- 同时让前后端图层类型逐步收窄，但不引入新的表结构

按这个方案落地后，后续 `draw / image / sticker / 导出合成 / 图层排序 / 二次编辑` 才能在同一套模型下继续演进。
