"""
Gemini CLI Implementation
Gemini 大模型客户端实现
"""
from typing import List, Optional

from app.services.llm_cli import LLMClientBase
from app.services.gemini_service import (
    generate_story_structure,
    generate_image,
    chat_with_storyteller,
)
from app.models.storybook import StorybookPage


class GeminiCli(LLMClientBase):
    """Gemini 大模型客户端实现"""

    async def create_story(
        self,
        instruction: str,
        style_prefix: str,
        images: Optional[List[str]] = None
    ) -> List[StorybookPage]:
        """
        创建故事

        根据用户指令一次性生成完整的绘本内容（包含文本和图片）。

        Args:
            instruction: 用户指令/故事描述
            style_prefix: 绘本风格
            images: base64编码的参考图片列表（可选）

        Returns:
            List[StorybookPage]: 生成的页面列表
        """
        from app.services.gemini_service import _get_client
        from google.genai import types
        import base64
        import re

        client = _get_client()

        # 构建请求内容
        prompt = (
            f"Create a 10-page picture book based on this idea: \"{instruction}\"\n"
            f"Style: {style_prefix}\n\n"
            f"Requirements:\n"
            f"1. For each page, provide:\n"
            f"   - A short text (1-2 sentences)\n"
            f"   - An illustration image\n\n"
            f"2. Ensure visual consistency across all pages:\n"
            f"   - Keep the main character's appearance identical\n"
            f"   - Use consistent art style and color palette\n"
            f"   - Maintain similar background aesthetics\n\n"
            f"3. Format your response as:\n"
            f"   [text content]\n"
            f"   [generate image]\n\n"
            f"   [text content]\n"
            f"   [generate image]\n\n"
            f"   And so on for all 10 pages."
        )

        # 如果没有参考图片，直接使用字符串
        if not images:
            response = await client.aio.models.generate_content(
                model="gemini-3-pro-image-preview",
                contents=prompt,
                config=types.GenerateContentConfig(),
            )
        else:
            # 如果有参考图片，构建 Content 对象
            parts = [types.Part(text=prompt)]

            for img_base64 in images:
                # 解析 base64 图片（格式：data:image/png;base64,xxxxx）
                if "," in img_base64:
                    mime_type, base64_data = img_base64.split(",", 1)
                    mime_type = mime_type.replace("data:", "").replace(";base64", "")
                else:
                    mime_type = "image/png"
                    base64_data = img_base64

                # 将 base64 字符串转换为 bytes
                image_bytes = base64.b64decode(base64_data)

                parts.append(
                    types.Part(
                        inline_data=types.Blob(
                            mime_type=mime_type,
                            data=image_bytes
                        )
                    )
                )

            response = await client.aio.models.generate_content(
                model="gemini-3-pro-image-preview",
                contents=types.Content(parts=parts),
                config=types.GenerateContentConfig(),
            )

        # 解析响应，提取页面内容
        pages: List[StorybookPage] = []
        current_text = ""

        for candidate in response.candidates or []:
            if not candidate.content:
                continue
            for part in candidate.content.parts or []:
                # 处理文本部分
                if part.text:
                    # 检查文本中是否包含图片 URL（markdown 格式：![alt](url)）
                    text = part.text
                    # 查找所有图片标记
                    image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                    matches = list(re.finditer(image_pattern, text))

                    if matches:
                        # 有图片 URL，按图片分割文本
                        last_end = 0
                        for match in matches:
                            # 图片前的文本
                            before_image = text[last_end:match.start()].strip()
                            current_text += before_image

                            # 提取图片 URL
                            image_url = match.group(1)

                            # 创建页面
                            pages.append({
                                "text": current_text.strip(),
                                "image_url": image_url
                            })
                            current_text = ""
                            last_end = match.end()

                        # 处理最后一个图片后的文本
                        after_last_image = text[last_end:].strip()
                        if after_last_image:
                            current_text = after_last_image
                    else:
                        # 没有图片 URL，累积文本
                        current_text += text

                # 处理 inline_data 图片（base64 格式）
                elif part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    # 找到图片，创建页面
                    image_url = f"data:{part.inline_data.mime_type};base64,{part.inline_data.data}"

                    pages.append({
                        "text": current_text.strip(),
                        "image_url": image_url
                    })
                    current_text = ""

        # 如果最后还有剩余文本但没有图片，可以选择是否创建一个无图页面
        # 这里选择忽略，因为每页应该都有图片
        # if current_text:
        #     pages.append({
        #         "text": current_text.strip(),
        #         "image_url": ""
        #     })

        return pages

    async def edit_story(
        self,
        instruction: str,
        current_pages: List[StorybookPage],
        style_prefix: str
    ) -> List[StorybookPage]:
        """
        编辑故事

        根据编辑指令对整个故事进行修改。

        Args:
            instruction: 编辑指令
            current_pages: 当前故事的所有页面
            style_prefix: 绘本风格

        Returns:
            List[StorybookPage]: 编辑后的页面列表
        """
        # 构建当前故事的文本描述
        current_story_text = "\n".join([
            f"第 {i+1} 页:\n文本: {page['text']}\n"
            for i, page in enumerate(current_pages)
        ])

        # 构建编辑提示
        edit_prompt = (
            f"当前故事内容：\n{current_story_text}\n\n"
            f"用户编辑要求：{instruction}\n\n"
            f"请重新生成整个故事结构，保持风格为：{style_prefix}。"
            f"必须包含标题、角色描述和每页的文本及图片提示词。"
        )

        # 生成新的故事结构
        new_story_structure = await generate_story_structure(
            prompt=edit_prompt,
            style_name=style_prefix
        )

        # 为新故事生成图片
        pages: List[StorybookPage] = []
        for page_item in new_story_structure.get("pages", []):
            character_description = new_story_structure.get("characterDescription", "")

            image_url = await generate_image(
                image_prompt=page_item["imagePrompt"],
                style_prefix=style_prefix,
                character_description=character_description
            )

            page: StorybookPage = {
                "text": page_item["text"],
                "image_url": image_url
            }
            pages.append(page)

        return pages

    async def edit_page(
        self,
        page_index: int,
        instruction: str,
        current_page: StorybookPage,
        style_prefix: str
    ) -> StorybookPage:
        """
        编辑故事页

        对指定单页内容进行编辑。

        Args:
            page_index: 页码索引（预留参数供未来版本使用）
            instruction: 编辑指令
            current_page: 当前页的内容
            style_prefix: 绘本风格

        Returns:
            StorybookPage: 编辑后的页面内容
        """
        # page_index 参数预留用于后续版本：可能需要根据页码位置调整内容
        _ = page_index  # 标记为有意未使用

        # 构建编辑提示
        edit_prompt = (
            f"当前页面内容：\n文本: {current_page['text']}\n\n"
            f"用户编辑要求：{instruction}\n\n"
            f"请为这一页生成新的文本描述和图片提示词，"
            f"风格为：{style_prefix}。"
        )

        # 使用对话模式生成新的页面内容
        response = await chat_with_storyteller(
            history=[],
            user_message=edit_prompt
        )

        # 这里简化处理：返回原文本，实际可能需要解析 response
        # 在实际应用中，你可能需要更复杂的逻辑来解析 LLM 的响应
        # 并提取新的文本和图片提示词

        # 生成新图片（使用原图片提示词或从响应中提取）
        # 这里使用简化的方式：直接使用用户指令作为图片提示词
        image_url = await generate_image(
            image_prompt=instruction,
            style_prefix=style_prefix,
            character_description=""
        )

        # 如果响应包含新的文本，使用新文本；否则使用编辑指令作为提示
        new_text = response if response else current_page['text']

        return {
            "text": new_text,
            "image_url": image_url
        }
