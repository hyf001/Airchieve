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
from app.core.utils.logger import get_logger
from app.services.llm_cli import LLMClientBase
from app.models.storybook import StorybookPage
from app.models.template import Template

logger = get_logger(__name__)


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
    for i, img in enumerate(images):
        if not img:
            logger.info("跳过空图片 | index=%s", i)
            continue
        if img.startswith("data:"):
            mime_type, image_bytes = _decode_base64_image(img)
            logger.info("处理 base64 图片 | index=%s mime_type=%s size_bytes=%s",
                        i, mime_type, len(image_bytes))
            parts.append(
                types.Part(
                    inline_data=types.Blob(
                        mime_type=mime_type,
                        data=image_bytes
                    )
                )
            )
        elif img.startswith("http://") or img.startswith("https://"):
            logger.info("处理 URL 图片 | index=%s url=%s", i, img[:100])
            parts.append(
                types.Part(
                    file_data=types.FileData(
                        file_uri=img
                    )
                )
            )
    logger.info("构建图片 parts 完成 | total_count=%s", len(parts))
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

    if not response.candidates:
        prompt_feedback = getattr(response, 'prompt_feedback', None)
        raise ValueError(f"Gemini 未返回任何候选内容，prompt_feedback={prompt_feedback}")

    logger.info("开始解析 Gemini 响应为页面 | candidates_count=%s", len(response.candidates))

    for candidate in response.candidates:
        finish_reason = getattr(candidate, 'finish_reason', None)
        finish_reason_str = str(finish_reason) if finish_reason is not None else "None"
        logger.info("Gemini candidate finish_reason=%s", finish_reason_str)

        if "IMAGE_SAFETY" in finish_reason_str:
            raise ValueError("图片内容因安全策略被拒绝，请修改描述后重试")

        if not candidate.content:
            raise ValueError(f"Gemini 返回内容为空，finish_reason={finish_reason_str}，可能被安全过滤或触发内容限制")

        parts = candidate.content.parts
        logger.info("candidate.content | parts_count=%s", len(parts) if parts else 0)

        for part in parts or []:
            # 处理文本部分
            if part.text:
                text = part.text
                logger.info("处理文本 part | text_length=%s", len(text))
                # 查找所有图片标记（markdown格式：![alt](url)）
                image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                matches = list(re.finditer(image_pattern, text))
                if matches:
                    # 有图片 URL，按图片分割文本
                    logger.info("发现图片URL标记 | count=%s", len(matches))
                    last_end = 0
                    for match in matches:
                        before_image = text[last_end:match.start()].strip()
                        current_text += before_image
                        image_url = match.group(1)

                        pages.append({
                            "text": current_text.strip(),
                            "image_url": image_url
                        })
                        logger.info("添加页面（URL方式）| text_length=%s image_url_prefix=%s",
                                    len(current_text.strip()), image_url[:50])
                        current_text = ""
                        last_end = match.end()

                    # 处理最后一个图片后的文本
                    after_last_image = text[last_end:].strip()
                    if after_last_image:
                        current_text = after_last_image
                else:
                    # 没有图片 URL，累积文本
                    current_text += text
                    logger.info("累积文本 | current_text_length=%s", len(current_text))

            # 处理 inline_data 图片（base64 格式）
            elif part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                image_url = _inline_data_to_data_url(part.inline_data)
                logger.info("处理 inline_data 图片 | mime_type=%s data_length=%s",
                            part.inline_data.mime_type, len(part.inline_data.data) if part.inline_data.data else 0)
                pages.append({
                    "text": current_text.strip(),
                    "image_url": image_url
                })
                logger.info("添加页面（inline_data方式）| text_length=%s", len(current_text.strip()))
                current_text = ""
            else:
                logger.info("跳过 part | has_text=%s has_inline_data=%s",
                            bool(part.text), bool(part.inline_data))

    logger.info("解析完成 | total_pages=%s", len(pages))

    if len(pages) == 0:
        logger.warning("警告：未解析到任何页面 | candidates=%s", [
            {
                "finish_reason": str(c.finish_reason) if c.finish_reason else None,
                "has_content": c.content is not None,
                "parts_count": len(c.content.parts) if c.content and c.content.parts else 0,
            }
            for c in response.candidates
        ])

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

    if not response.candidates:
        prompt_feedback = getattr(response, 'prompt_feedback', None)
        raise ValueError(f"Gemini 未返回任何候选内容，prompt_feedback={prompt_feedback}")

    for candidate in response.candidates:
        finish_reason = getattr(candidate, 'finish_reason', None)
        finish_reason_str = str(finish_reason) if finish_reason is not None else "None"
        logger.info("Gemini candidate finish_reason=%s", finish_reason_str)

        if "IMAGE_SAFETY" in finish_reason_str:
            raise ValueError("图片内容因安全策略被拒绝，请修改描述后重试")

        if not candidate.content:
            raise ValueError(f"Gemini 返回内容为空，finish_reason={finish_reason_str}，可能被安全过滤或触发内容限制")

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
        template: Optional[Template] = None,
        images: Optional[List[str]] = None
    ) -> List[StorybookPage]:
        """
        创建故事

        根据用户指令一次性生成完整的绘本内容（包含文本和图片）。

        Args:
            instruction: 用户指令/故事描述
            template: 模板对象（可选），包含风格名称、描述和系统提示词
            images: base64编码的参考图片列表（可选）

        Returns:
            List[StorybookPage]: 生成的页面列表
        """
        client = _get_client()

        # System Prompt：定义系统角色和基本规则
        # 如果提供了 template，从中提取 systemprompt、name 和 description
        if template and template.systemprompt:
            # 如果模板有 systemprompt，使用它作为基础
            system_instruction = template.systemprompt
        else:
            # 否则使用默认的 system prompt
            system_instruction = (
                "You are a professional visual storyteller and illustrator. "
                "Your task is to generate a complete series of 10 sequential illustration panels with accompanying text. "
                "For each panel, you must provide:\n"
                "1. A short, engaging narrative text (1-2 sentences suitable for children)\n"
                "2. An illustration image that matches the text\n\n"
                "CRITICAL REQUIREMENTS:\n"
                "- LANGUAGE: Generate the narrative text in the SAME language as the user's input instruction. "
                "If the user writes in Chinese, respond in Chinese. If in English, respond in English, etc.\n"
                "- TEXT RULES: Begin IMMEDIATELY with panel 1 text — no preamble, no story outline, no panel labels. "
                "Each panel's text must be pure story narrative only (1-2 sentences), followed at once by its image. "
                "Never batch multiple panels' text before generating images.\n"
                "- Maintain visual consistency: Keep the main character's appearance identical across all panels\n"
                "- Use a consistent art style and color palette throughout the series\n"
                "- Each image should look like a standalone scene illustration, NOT a book page — no page borders, no book decorations, no margins\n"
                "- Ensure cinematic, full-bleed illustrations with clean backgrounds and consistent lighting\n"
                "- Images must contain NO text, letters, or words whatsoever; text and images are completely separate"
            )

        # 如果模板有风格名称和描述，添加到系统指令中
        if template and template.name:
            system_instruction += f"\n\nART STYLE: {template.name}"
            if template.description:
                system_instruction += f"\n{template.description}"

        # User Prompt：用户的具体创意要求
        user_prompt = (
            f"MUST generate exactly 10 illustrations regardless of uploaded images. "
            f"Create a 10-panel illustrated story based on: \"{instruction}\". "
            f"Each panel must have text + image (full-bleed, no framing, no text in image)."
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
                response_modalities=["TEXT", "IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        # 解析响应
        return _parse_response_to_pages(response)

    async def edit_image_only(
        self,
        instruction: str,
        current_image_url: str,
    ) -> str:
        """仅生成新图片（不修改文字），返回 base64 data URL。"""
        logger.info("edit_image_only start | model=%s | instruction=%s", settings.GEMINI_EDIT_MODEL, instruction)
        client = _get_client()

        system_instruction = (
            "You are a professional illustrator specializing in image editing. "
            "You will receive an existing illustration and an editing instruction. "
            "Your task is to EDIT and MODIFY the provided image according to the instruction — "
            "do NOT generate a completely new image from scratch. "
            "Preserve the original composition, characters, art style, color palette, and visual consistency as much as possible, "
            "only applying the specific changes requested. "
            "Output a full-bleed cinematic illustration. "
            "Images must contain NO text, letters, or words whatsoever."
        )
        user_prompt = (
            f"Here is the existing illustration (attached). "
            f"Edit it according to this instruction: {instruction}\n\n"
            f"Modify only what is asked, preserve everything else. "
            f"Output: full-bleed cinematic illustration, NO text or letters in image."
        )

        parts = [types.Part(text=user_prompt)]
        if current_image_url:
            parts.extend(_build_image_parts([current_image_url]))
        logger.info("edit_image_only calling API | has_image=%s", bool(current_image_url))

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_EDIT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        for candidate in response.candidates or []:
            finish_reason = getattr(candidate, 'finish_reason', None)
            finish_reason_str = str(finish_reason) if finish_reason is not None else "None"
            logger.info("edit_image_only candidate finish_reason=%s", finish_reason_str)
            if "IMAGE_SAFETY" in finish_reason_str:
                raise ValueError("图片内容因安全策略被拒绝，请修改描述后重试")
            if not candidate.content:
                continue
            for part in candidate.content.parts or []:
                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    logger.info("edit_image_only success | mime_type=%s", part.inline_data.mime_type)
                    return _inline_data_to_data_url(part.inline_data)

        raise ValueError("图片生成失败，未获取到图片内容")

    async def regenerate_pages(
        self,
        pages: List[StorybookPage],
        count: int = 1,
        instruction: str = "",
    ) -> List[StorybookPage]:
        """基于选中的参考页面再生成 count 张新页面。"""
        logger.info("regenerate_pages start | model=%s | ref_count=%d | count=%d | instruction=%s",
                    settings.GEMINI_MODEL, len(pages), count, instruction)
        client = _get_client()
        ref_count = len(pages)

        system_instruction = (
            "You are a professional visual storyteller and illustrator. "
            f"You will receive {ref_count} existing story panel(s) (text + illustrations) as reference. "
            f"Your task is to generate exactly {count} NEW panel(s) inspired by and visually consistent with the provided panels — "
            "do NOT simply copy or describe the originals. "
            "Base the new illustrations on the visual style, characters, and composition of the provided images. "
            f"Each panel must have a short narrative text (1-2 sentences suitable for children) "
            "and a full-bleed cinematic illustration. "
            "LANGUAGE: Use the SAME language as the original panels. "
            "STORY TEXT ONLY: Each panel's text must contain ONLY the story plot narrative — pure story prose that advances the plot. "
            "Absolutely NO summaries, overviews, introductions, conclusions, panel labels, or any non-narrative content. "
            "Images must contain NO text, letters, or words whatsoever."
        )

        panels_desc = "\n".join(
            f"Panel {i + 1} text: {p['text']}" for i, p in enumerate(pages)
        )
        regen_instruction = instruction if instruction else "请基于这些页面再生成新的内容"
        user_prompt = (
            f"Reference panels:\n{panels_desc}\n\n"
            f"Regeneration instruction: {regen_instruction}\n\n"
            f"The reference images are attached. Generate exactly {count} new panel(s). "
            f"Each image must be: full-bleed cinematic scene, no borders/frames, NO text or letters in image, visually consistent with reference."
        )

        parts = [types.Part(text=user_prompt)]
        image_urls = [p.get("image_url", "") for p in pages if p.get("image_url")]
        if image_urls:
            parts.extend(_build_image_parts(image_urls))
        logger.info("regenerate_pages calling API | image_count=%d", len(image_urls))

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT", "IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="16:9"),
            ),
        )

        result = _parse_response_to_pages(response)
        logger.info("regenerate_pages success | parsed_count=%d | expected=%d", len(result), count)
        while len(result) < count:
            result.append(dict(pages[len(result) % ref_count]))  # type: ignore
        return result[:count]
