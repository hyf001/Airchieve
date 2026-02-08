#!/usr/bin/env python3
"""调用 Google Gemini SDK，根据故事文本生成配套插画。

用法:
    python generate_illustrations.py \
        --story-file story/my_story.txt \
        --story-dir output/story/ \
        --art-style "温馨的水彩画风格" \
        --input-images ref1.png ref2.png

参数:
    --story-file       : 故事文本文件路径（必需）
    --story-dir        : 输出目录，插画图片保存到此目录（必需）
    --art-style        : 艺术风格描述（可选）
    --story-name       : 故事名称，用于文件命名（可选，默认使用文件名）
    --input-images     : 可选，参考图片路径列表，作为风格/角色参考
    --model            : Gemini 模型名称 (默认: gemini-3-pro-image-preview)

环境变量 (从 .env 读取):
    GEMINI_API_KEY : Gemini API 密钥
    GEMINI_API_URL : Gemini API 地址 (可选，用于自定义代理)

输出:
    在 story_dir 下生成 illustration_001.png ~ illustration_0XX.png
    以及 {story_name}_illustrations.json 结果清单
"""

import argparse
import json
import os
import re
import sys
import pathlib
import hashlib
import urllib.request

# ---------------------------------------------------------------------------
# 加载 .env
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

_script_dir = pathlib.Path(__file__).resolve().parent
for _parent in [_script_dir] + list(_script_dir.parents):
    _env_file = _parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
        break

from google import genai
from google.genai import types
from PIL import Image


# ---------------------------------------------------------------------------
# 构建完整提示词
# ---------------------------------------------------------------------------

def build_full_prompt(story_text: str, num_illustrations: int, art_style: str = "温暖的插画风格") -> str:
    """根据故事文本构建提示词，要求模型为故事生成多幅插画。"""

    # 将故事按段落分解
    paragraphs = [p.strip() for p in story_text.split('\n') if p.strip()]
    num_paragraphs = len(paragraphs)

    # 构建带编号的段落文本
    paragraphs_text = ""
    for i, para in enumerate(paragraphs, 1):
        paragraphs_text += f"\n【段落 {i}】\n{para}\n"

    prompt = (
        f"# 任务说明\n"
        f"请为以下故事生成配套的插画。\n"
        f"艺术风格: {art_style}\n\n"
        f"# 故事内容（共 {num_paragraphs} 个段落）\n"
        f"{paragraphs_text}\n"
        f"# 重要要求\n"
        f"- 这个故事共有 **{num_paragraphs} 个段落**\n"
        f"- 你**必须为每个段落各生成一幅插画**，不能跳过任何段落\n"
        f"- **总计需要生成 {num_paragraphs} 幅插画**（段落数 = 插画数）\n"
        f"- 按段落顺序输出：段落1插画 → 段落2插画 → ... → 段落{num_paragraphs}插画\n\n"
        f"# 输出格式\n"
        f"对于每个段落，请按以下格式输出：\n"
        f"1. 先输出文本：「段落N插画」（N为段落序号）\n"
        f"2. 紧接着生成该段落对应的插画图片\n"
        f"3. 然后继续下一个段落\n\n"
        f"# 插画要求\n"
        f"- 画面**不包含任何文字**\n"
        f"- 每幅插画必须准确表现对应段落的具体内容和情节\n"
        f"- 构图清晰，主体突出\n"
        f"- **所有插画保持统一的美术风格和角色形象**\n"
        f"- 每幅插画独立完整，能够表现对应段落的核心场景\n"
        f"- 画面要有丰富的细节和情感表达\n\n"
        f"请现在开始，依次为以上每个段落各生成插画，共 {num_paragraphs} 幅。"
    )
    return prompt

def load_input_images(image_paths: list[str]) -> list[Image.Image]:
    """加载参考图片，返回 PIL Image 列表。"""
    images = []
    for p in image_paths:
        if not os.path.isfile(p):
            print(f"  [警告] 参考图片不存在，跳过: {p}")
            continue
        try:
            img = Image.open(p)
            img.load()
            images.append(img)
            print(f"  [信息] 已加载参考图片: {p}")
        except Exception as e:
            print(f"  [警告] 无法加载图片 {p}: {e}")
    return images


# ---------------------------------------------------------------------------
# Gemini 客户端
# ---------------------------------------------------------------------------

def create_client(api_key: str, api_url: str | None = None) -> genai.Client:
    """创建 Gemini SDK 客户端。"""
    kwargs: dict = {"api_key": api_key}
    if api_url:
        kwargs["http_options"] = types.HttpOptions(
            base_url=api_url,
            api_version="v1beta",
        )
    return genai.Client(**kwargs)




# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def generate_illustrations(
    story_text: str,
    story_dir: str,
    num_illustrations: int,
    art_style: str,
    story_name: str,
    input_images: list[str],
    model: str,
    api_key: str,
    api_url: str | None,
):
    """根据故事文本，一次调用 Gemini 生成所有插画。"""

    os.makedirs(story_dir, exist_ok=True)

    # 计算段落数
    paragraphs = [p.strip() for p in story_text.split('\n') if p.strip()]
    num_paragraphs = len(paragraphs)

    print(f"[信息] 故事名称: {story_name}")
    print(f"[信息] 艺术风格: {art_style}")
    print(f"[信息] 输出目录: {story_dir}")
    print(f"[信息] 参考图片: {len(input_images)} 张")
    print(f"[信息] 模型: {model}")
    print(f"[信息] 故事段落数: {num_paragraphs}")
    print(f"[信息] 将为每个段落生成一幅插画，共 {num_paragraphs} 幅")

    # 加载参考图片
    ref_images = load_input_images(input_images) if input_images else []

    # 构建 contents
    contents: list = []
    if ref_images:
        contents.append("以下是参考图片，请参考其风格和角色形象来绘制所有插画：")
        contents.extend(ref_images)
    contents.append(build_full_prompt(story_text, num_illustrations, art_style))

    # 创建客户端并调用
    client = create_client(api_key, api_url)

    print(f"\n[信息] 正在调用 Gemini 流式生成插画...\n")

    image_count = 0
    text_parts = []
    results = []

    try:
        # 使用流式调用
        stream = client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
                temperature=1.0,
            ),
        )

        # 追踪已保存的图片数据，避免流式响应中的重复
        saved_image_hashes = set()

        # 遍历流式响应
        for chunk in stream:
            if not chunk.candidates:
                continue

            # 获取当前 chunk 的 parts
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue

            parts = candidate.content.parts

            for part in parts:
                # 跳过思考过程中的图片（Gemini 3 Pro 的 thought 图片）
                is_thought = getattr(part, "thought", False)

                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    if is_thought:
                        continue

                    # 使用图片数据的哈希值去重
                    image_data = part.inline_data.data
                    if isinstance(image_data, bytes):
                        image_hash = hashlib.md5(image_data).hexdigest()
                        if image_hash in saved_image_hashes:
                            continue
                        saved_image_hashes.add(image_hash)

                    # 立即保存图片
                    image_count += 1
                    filename = f"illustration_{image_count:03d}.png"
                    output_path = os.path.join(story_dir, filename)
                    image = part.as_image()
                    if image:
                        image.save(output_path)
                        print(f"  ✓ [图片 {image_count}] 已保存: {output_path}")
                        results.append({
                            "index": image_count,
                            "file": output_path,
                            "status": "success",
                        })

                elif hasattr(part, "text") and part.text:
                    if not is_thought:
                        # 检查文本中是否包含图片 URL（markdown 格式）
                        text = part.text.strip()
                        image_url_match = re.match(r'!\[image\]\((https?://[^\)]+)\)', text)

                        if image_url_match:
                            # 提取图片 URL
                            image_url = image_url_match.group(1)

                            # 检查是否已经下载过这个 URL
                            url_hash = hashlib.md5(image_url.encode()).hexdigest()
                            if url_hash in saved_image_hashes:
                                continue
                            saved_image_hashes.add(url_hash)

                            # 下载并保存图片
                            image_count += 1
                            filename = f"illustration_{image_count:03d}.png"
                            output_path = os.path.join(story_dir, filename)

                            try:
                                print(f"  ⬇️  [下载 {image_count}] {image_url[:60]}...")
                                urllib.request.urlretrieve(image_url, output_path)
                                print(f"  ✓ [图片 {image_count}] 已保存: {output_path}")

                                results.append({
                                    "index": image_count,
                                    "file": output_path,
                                    "url": image_url,
                                    "status": "success",
                                })
                            except Exception as e:
                                print(f"  ✗ [错误] 下载图片失败: {e}")
                                results.append({
                                    "index": image_count,
                                    "file": output_path,
                                    "url": image_url,
                                    "status": "failed",
                                    "error": str(e),
                                })
                        else:
                            # 普通文本
                            # 避免重复添加相同的文本
                            if text not in text_parts:
                                text_parts.append(text)
                            # 打印模型返回的文本（段落标注等）
                            if text:
                                print(f"  [文本] {text[:120]}{'...' if len(text) > 120 else ''}")

    except Exception as e:
        print(f"[错误] API 调用失败: {e}")
        sys.exit(1)

    # 计算段落数（用于汇总信息）
    paragraphs = [p.strip() for p in story_text.split('\n') if p.strip()]
    num_paragraphs = len(paragraphs)

    # 汇总
    print(f"\n[完成] 共生成 {image_count} 幅插画（故事段落数: {num_paragraphs}）")

    if image_count < num_paragraphs:
        print(f"[提示] 生成的插画数量少于段落数，这是模型的正常行为，"
              f"可尝试调整提示词或使用 gemini-3-pro-image-preview 模型")

    # 保存模型输出的文本
    if text_parts:
        text_path = os.path.join(story_dir, f"{story_name}_text.md")
        with open(text_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(text_parts))
        print(f"[信息] 模型文本输出: {text_path}")

    # 写入结果清单
    manifest_path = os.path.join(story_dir, f"{story_name}_illustrations.json")
    manifest = {
        "story_name": story_name,
        "art_style": art_style,
        "model": model,
        "num_paragraphs": num_paragraphs,
        "total_images": image_count,
        "story_text": story_text[:500] + "..." if len(story_text) > 500 else story_text,
        "illustrations": results,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"[信息] 结果清单: {manifest_path}")

    return results


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="根据故事文本文件生成配套插画（每个段落生成一幅插画）")
    parser.add_argument(
        "--story-file", required=True,
        help="故事文本文件路径",
    )
    parser.add_argument(
        "--story-dir", required=True,
        help="输出目录，插画保存到此目录",
    )
    parser.add_argument(
        "--art-style", default="温暖的插画风格",
        help="艺术风格描述（默认: 温暖的插画风格）",
    )
    parser.add_argument(
        "--story-name", default=None,
        help="故事名称，用于文件命名（默认使用文件名）",
    )
    parser.add_argument(
        "--input-images", nargs="*", default=[],
        help="参考图片路径列表，作为风格/角色参考",
    )
    parser.add_argument(
        "--model", default="gemini-3-pro-image-preview-1K",
        help="Gemini 模型名称 (默认: gemini-3-pro-image-preview-1K)",
    )
    args = parser.parse_args()

    # 读取故事文件
    if not os.path.isfile(args.story_file):
        print(f"[错误] 故事文件不存在: {args.story_file}")
        sys.exit(1)

    try:
        with open(args.story_file, "r", encoding="utf-8") as f:
            story_text = f.read()
    except Exception as e:
        print(f"[错误] 读取故事文件失败: {e}")
        sys.exit(1)

    # 如果没有指定故事名称，使用文件名（去掉扩展名）
    if args.story_name is None:
        args.story_name = os.path.splitext(os.path.basename(args.story_file))[0]

    api_key = os.environ.get("GEMINI_API_KEY", "")
    api_url = os.environ.get("GEMINI_API_URL", "") or None

    if not api_key:
        print("[错误] 未设置 GEMINI_API_KEY，请在 .env 文件中配置")
        sys.exit(1)

    # 计算段落数（插画数量由段落数决定）
    paragraphs = [p.strip() for p in story_text.split('\n') if p.strip()]
    num_paragraphs = len(paragraphs)

    generate_illustrations(
        story_text=story_text,
        story_dir=args.story_dir,
        num_illustrations=num_paragraphs,  # 使用段落数
        art_style=args.art_style,
        story_name=args.story_name,
        input_images=args.input_images,
        model=args.model,
        api_key=api_key,
        api_url=api_url,
    )


if __name__ == "__main__":
    main()
