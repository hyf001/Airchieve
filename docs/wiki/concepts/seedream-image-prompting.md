---
title: Seedream Image Prompting
created: 2026-06-10
updated: 2026-06-10
type: concept
tags: [ai-provider, creation, art-style]
sources: [raw/articles/external/volcengine-seedream-image-prompting.md]
---

# Seedream Image Prompting

## 定义

Seedream image prompting 是 AIrchieve 在调用火山方舟/豆包图片生成能力时使用的提示词组织规则。它主要影响 [[creation-generation]] 中的绘本页插图、角色形象图、参考图生图和整本多图顺序生成。

完整外部来源保存在 `raw/articles/external/volcengine-seedream-image-prompting.md`。本页只记录对 AIrchieve 有用的结构化规则和实现映射。

## 核心规则

- 文生图提示词优先使用简洁连贯的自然语言，结构是主体、动作、环境，再按需补充风格、色彩、光影和构图。
- Seedream 5.0 lite、4.5、4.0 对自然语言理解较强；在常规图像生成里，精确描述通常优于重复堆叠华丽形容词。
- 有明确用途时要写明图像类型或应用场景，例如绘本内页、角色设定图、分镜序列或成套设计。
- 对参考图生图，提示词必须说清参考对象和保留内容，再描述新的画面。
- 多图输入必须说明每张输入图的职责；多图输出必须说明组图/系列和具体数量。

## AIrchieve Prompt Shape

绘本页插图 prompt 应包含：

- 本次输出图片数量和页面顺序。
- 每一页的可视化画面，不把正文或对白当作要渲染的文字。
- 画风、色彩、光影、线条和构图连续性。
- 角色参考图的输入顺序，以及需要保持的角色身份和主要视觉特征。
- 前序页面参考图的用途：保持故事、场景、色彩、画风和构图连贯。
- 明确禁止图片中出现文字、字母、标题、标签、边框或水印。

角色形象图 prompt 应包含：

- 角色主体、姿态、服装/外观、表情和画面环境。
- 是否存在参考图，以及从参考图中提取并保持的身份、五官、发型、服装特征和整体画风。
- 角色主体清晰、儿童友好、适合多页复用，避免复杂背景和多个不同角色。

## Reference Images

对 AIrchieve 来说，参考图分为两类：

- 角色参考图：来自 [[asset-storage]] 的角色形象，用于保持人物身份、视觉特征和画风一致。
- 连续性参考图：来自已生成的前序页面，用于保持故事、场景、色彩、画风和构图连贯。

当两类参考图同时存在时，provider 请求顺序和 prompt 描述必须一致。推荐顺序是先角色参考图，再前序页面参考图；prompt 中按这个顺序解释每组图片的用途。

## Multi-Image Output

整本绘本页生成是 Seedream 多图输出能力的典型场景。提示词应使用“一组共 N 张”或类似 wording，并说明每张输出图片按页面顺序一一对应，不能合并页面、补画封面或生成额外图片。

单页重生成则相反：提示词应强调只生成 1 张当前页内页插画，不改变故事节奏，不补画其它页面。

## Implementation Mapping

- `backend/app/service/ai_provider/prompts.py`：生成 storyboard 时，`visual_prompt` 应被约束为可视化自然语言，不应包含图片中文字。
- `backend/app/service/ai_provider/service.py`：负责把页面、角色参考、画风和连续性信息组装为 provider-neutral image prompt。
- `backend/app/service/ai_provider/providers/doubao.py`：负责把 prompt 和 `image_urls` 转成豆包/Seedream SDK 调用参数，不拥有业务状态。
- [[generation-task-execution]]：负责异步任务生命周期、重试、失败可见性和任务结果回写调度。
- [[asset-storage]]：负责角色图、生成页图和后续稳定 URL 的资产归属。

## Related Pages

- [[creation-generation]]
- [[asset-storage]]
- [[generation-task-execution]]
- [[book-player-reading]]
