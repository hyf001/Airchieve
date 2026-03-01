"""
Gemini CLI Implementation
Gemini 大模型客户端实现
"""
import re
import base64
from typing import List, Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.services.llm_cli import LLMClientBase
from app.models.storybook import StorybookPage


def _get_client() -> genai.Client:
    """获取 Gemini SDK 客户端，支持自定义 API URL"""
    kwargs: dict = {"api_key": settings.GEMINI_API_KEY}
    if settings.GEMINI_API_URL:
        kwargs["http_options"] = types.HttpOptions(base_url=settings.GEMINI_API_URL)
    return genai.Client(**kwargs)


def _decode_base64_image(image_url: str) -> tuple[str, bytes]:
    """
    解码 base64 图片

    Args:
        image_url: base64格式的图片URL（data:image/png;base64,xxxxx）

    Returns:
        (mime_type, image_bytes): MIME类型和图片字节数据
    """
    if "," in image_url:
        mime_type, base64_data = image_url.split(",", 1)
        mime_type = mime_type.replace("data:", "").replace(";base64", "")
    else:
        mime_type = "image/png"
        base64_data = image_url

    image_bytes = base64.b64decode(base64_data)
    return mime_type, image_bytes


def _build_image_parts(images: List[str]) -> List[types.Part]:
    """
    构建图片 Parts 列表

    Args:
        images: base64格式的图片列表

    Returns:
        List[types.Part]: 图片Parts列表
    """
    parts = []
    for img in images:
        if not img:
            continue
        if img.startswith("data:"):
            mime_type, image_bytes = _decode_base64_image(img)
            parts.append(
                types.Part(
                    inline_data=types.Blob(
                        mime_type=mime_type,
                        data=image_bytes
                    )
                )
            )
        elif img.startswith("http://") or img.startswith("https://"):
            parts.append(
                types.Part(
                    file_data=types.FileData(
                        file_uri=img
                    )
                )
            )
    return parts


def _inline_data_to_data_url(inline_data: types.Blob) -> str:
    """将 inline_data 转为 data URL（确保为 base64 字符串）"""
    data = inline_data.data
    if isinstance(data, bytes):
        base64_data = base64.b64encode(data).decode("ascii")
    else:
        base64_data = str(data)
    return f"data:{inline_data.mime_type};base64,{base64_data}"


def _parse_response_to_pages(response) -> List[StorybookPage]:
    """
    解析 Gemini 响应为页面列表

    Args:
        response: Gemini API 响应对象

    Returns:
        List[StorybookPage]: 解析出的页面列表
    """
    pages: List[StorybookPage] = []
    current_text = ""

    for candidate in response.candidates or []:
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            # 处理文本部分
            if part.text:
                text = part.text
                # 查找所有图片标记（markdown格式：![alt](url)）
                image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                matches = list(re.finditer(image_pattern, text))
                if matches:
                    # 有图片 URL，按图片分割文本
                    last_end = 0
                    for match in matches:
                        before_image = text[last_end:match.start()].strip()
                        current_text += before_image
                        image_url = match.group(1)

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
                image_url = _inline_data_to_data_url(part.inline_data)
                pages.append({
                    "text": current_text.strip(),
                    "image_url": image_url
                })
                current_text = ""

    return pages


def _parse_response_to_single_page(response, fallback_page: StorybookPage) -> StorybookPage:
    """
    解析 Gemini 响应为单个页面

    Args:
        response: Gemini API 响应对象
        fallback_page: 如果解析失败时的后备页面

    Returns:
        StorybookPage: 解析出的页面
    """
    new_text = ""
    new_image_url = ""

    for candidate in response.candidates or []:
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            if part.text:
                text = part.text
                # 提取图片URL（如果有）
                image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                match = re.search(image_pattern, text)
                if match:
                    new_image_url = match.group(1)
                    # 移除图片标记，保留文本
                    new_text = re.sub(image_pattern, '', text).strip()
                else:
                    new_text = text.strip()

            elif part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                new_image_url = _inline_data_to_data_url(part.inline_data)

    # 如果没有生成新内容，使用原内容
    if not new_text:
        new_text = fallback_page['text']
    if not new_image_url:
        new_image_url = fallback_page.get('image_url', '')

    return {
        "text": new_text,
        "image_url": new_image_url
    }


class GeminiCli(LLMClientBase):
    """Gemini 大模型客户端实现"""

    async def create_story(
        self,
        instruction: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None
    ) -> List[StorybookPage]:
        """
        创建故事

        根据用户指令一次性生成完整的绘本内容（包含文本和图片）。

        Args:
            instruction: 用户指令/故事描述
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等
            images: base64编码的参考图片列表（可选）

        Returns:
            List[StorybookPage]: 生成的页面列表
        """
        client = _get_client()

        # System Prompt：定义系统角色和基本规则
        # 如果提供了自定义 system_prompt，使用它；否则使用默认的
        if system_prompt:
            system_instruction = system_prompt
        else:
            system_instruction = (
                "You are a professional children's picture book creator. "
                "Your task is to generate a complete 10-page picture book with both text and illustrations. "
                "For each page, you must provide:\n"
                "1. A short, engaging text (1-2 sentences suitable for children)\n"
                "2. An illustration image that matches the text\n\n"
                "CRITICAL REQUIREMENTS:\n"
                "- LANGUAGE: Generate the picture book text in the SAME language as the user's input instruction. "
                "If the user writes in Chinese, respond in Chinese. If in English, respond in English, etc.\n"
                "- Maintain visual consistency: Keep the main character's appearance identical across all pages\n"
                "- Use a consistent art style and color palette throughout the book\n"
                "- Ensure professional storybook quality with clean backgrounds and consistent lighting\n"
                "- Generate images inline with the text, alternating between text and image for each page\n"
                "- Images must contain NO text, letters, or words whatsoever; text and images are completely separate"
            )

        # User Prompt：用户的具体创意要求
        user_prompt = (
            f"Create a 10-page picture book based on this idea: \"{instruction}\"\n\n"
            f"Please generate all 10 pages now, with text and images alternating."
        )

        # 构建请求内容
        parts = [types.Part(text=user_prompt)]

        # 如果有参考图片，添加到请求中
        if images:
            parts.extend(_build_image_parts(images))

        # 调用 Gemini API
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        # 解析响应
        return _parse_response_to_pages(response)

    async def edit_story(
        self,
        instruction: str,
        current_pages: List[StorybookPage],
        system_prompt: Optional[str] = None
    ) -> List[StorybookPage]:
        """
        编辑故事

        根据编辑指令对整个故事进行修改。将原故事的图文信息+用户prompt一起传给gemini重新生成。

        Args:
            instruction: 编辑指令
            current_pages: 当前故事的所有页面
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等

        Returns:
            List[StorybookPage]: 编辑后的页面列表
        """
        client = _get_client()

        # System Prompt：定义系统角色和基本规则
        # 如果提供了自定义 system_prompt，使用它；否则使用默认的
        if system_prompt:
            system_instruction = system_prompt
        else:
            system_instruction = (
                "You are a professional children's picture book editor. "
                "Your task is to regenerate a complete 10-page picture book based on the existing story and user's editing request. "
                "For each page, you must provide:\n"
                "1. A short, engaging text (1-2 sentences suitable for children)\n"
                "2. An illustration image that matches the text\n\n"
                "CRITICAL REQUIREMENTS:\n"
                "- LANGUAGE: Generate the picture book text in the SAME language as the user's editing instruction. "
                "If the user writes in Chinese, respond in Chinese. If in English, respond in English, etc.\n"
                "- Maintain visual consistency: Keep the main character's appearance identical across all pages\n"
                "- Use a consistent art style and color palette throughout the book\n"
                "- Ensure professional storybook quality with clean backgrounds and consistent lighting\n"
                "- Consider the original story context and images provided\n"
                "- Generate images inline with the text, alternating between text and image for each page\n"
                "- Images must contain NO text, letters, or words whatsoever; text and images are completely separate"
            )

        # User Prompt：当前故事内容 + 编辑要求
        user_prompt = f"Current story (10 pages):\n\n"
        for i, page in enumerate(current_pages):
            user_prompt += f"Page {i+1}:\nText: {page['text']}\n\n"

        user_prompt += (
            f"\n\nUser editing request: {instruction}\n\n"
            f"Please regenerate the entire 10-page picture book based on the editing request. "
            f"Generate all 10 pages now, with text and images alternating."
        )

        # 构建请求内容：文本 + 原故事图片作为上下文
        parts = [types.Part(text=user_prompt)]

        # 将原故事的图片作为上下文
        image_urls = [page.get('image_url', '') for page in current_pages if page.get('image_url')]
        parts.extend(_build_image_parts(image_urls))

        # 调用 Gemini API
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        # 解析响应
        return _parse_response_to_pages(response)

    async def edit_page(
        self,
        page_index: int,
        instruction: str,
        current_page: StorybookPage,
        system_prompt: Optional[str] = None
    ) -> StorybookPage:
        """
        编辑故事页

        对指定单页内容进行编辑。将当前页的图文信息+用户prompt一起传给gemini重新生成。

        Args:
            page_index: 页码索引
            instruction: 编辑指令
            current_page: 当前页的内容
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等

        Returns:
            StorybookPage: 编辑后的页面内容
        """
        client = _get_client()

        # System Prompt：定义系统角色和基本规则
        # 如果提供了自定义 system_prompt，使用它；否则使用默认的
        if system_prompt:
            system_instruction = system_prompt
        else:
            system_instruction = (
                "You are a professional children's picture book editor. "
                "Your task is to regenerate a single page of a picture book based on the existing content and user's editing request. "
                "You must provide:\n"
                "1. A short, engaging text (1-2 sentences suitable for children)\n"
                "2. An illustration image that matches the text\n\n"
                "CRITICAL REQUIREMENTS:\n"
                "- LANGUAGE: Generate the page text in the SAME language as the user's editing instruction. "
                "If the user writes in Chinese, respond in Chinese. If in English, respond in English, etc.\n"
                "- Keep visual consistency with the original style\n"
                "- Maintain the character's appearance if applicable\n"
                "- Ensure professional storybook quality with clean background and good lighting\n"
                "- Generate the image inline with the text\n"
                "- Images must contain NO text, letters, or words whatsoever; text and images are completely separate"
            )

        # User Prompt：当前页内容 + 编辑要求
        user_prompt = (
            f"Current page {page_index + 1}:\n"
            f"Text: {current_page['text']}\n\n"
            f"User editing request: {instruction}\n\n"
            f"Please regenerate this page with new text and image."
        )

        # 构建请求内容：文本 + 当前页图片作为上下文
        parts = [types.Part(text=user_prompt)]

        # 如果当前页有图片，将其作为上下文
        image_url = current_page.get('image_url', '')
        if image_url:
            parts.extend(_build_image_parts([image_url]))

        # 调用 Gemini API
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        # 解析响应
        return _parse_response_to_single_page(response, current_page)
