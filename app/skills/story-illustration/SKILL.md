---
name: story-illustration
description: 为绘本故事内容生成配套插画，自动为每个段落生成一幅插画。
---

# 核心能力

根据故事文本文件自动识别段落，为每个段落生成一幅配套插画。

## 工作流程

### 调用generate_illustrations脚本生成插画

```bash
python scripts/generate_illustrations.py \
  --story-file story/my_story.txt \
  --story-dir output/{story_name}/ \
  --art-style "艺术风格描述" \
  --input-images ref_style.png ref_character.png
```

#### 参数说明

- `--story-file`: 故事文本文件路径（必需）
- `--story-dir`: 输出目录（必需）
- `--art-style`: 艺术风格描述（可选，如：温暖的水彩风格、扁平插画风格等）
- `--story-name`: 故事名称，用于文件命名（可选，默认使用文件名）
- `--input-images`: （可选）参考图片，用于风格一致性

#### 插画生成规则

- 脚本会**自动识别故事中的段落数**（以空行分隔）
- **每个段落生成一幅插画**，不会跳过任何段落
- 插画数量 = 段落数量

#### 输出文件

生成到 `output/{story_name}/`：
- `illustration_001.png` ~ `illustration_0XX.png` —— 插画图片（数量等于段落数）
- `{story_name}_text.md` —— 每张插画对应的文本说明
- `{story_name}_illustrations.json` —— 生成结果清单（包含段落信息和图片路径）

## 完整示例

假设有一个10段落的故事文件 `story/小白兔拔萝卜.txt`：

```bash
python scripts/generate_illustrations.py \
  --story-file story/小白兔拔萝卜.txt \
  --story-dir output/小白兔拔萝卜/ \
  --art-style "温馨的水彩画风格"
```

**输出目录**: `output/小白兔拔萝卜/`
**生成的插画**: `illustration_001.png` ~ `illustration_010.png`（共10张，对应10个段落）

## 注意事项

- 插画数量由故事段落数自动决定，无需手动指定
- 段落识别规则：以空行分隔的文本块视为一个段落
- 如果不指定 `--story-name`，会自动使用文件名作为故事名称
- 可通过 `--input-images` 提供参考图片以保持风格一致性
- 建议提供明确的艺术风格描述以获得更好的效果
- 所有插画会保持统一的美术风格和角色形象

