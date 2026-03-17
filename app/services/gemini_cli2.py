"""
Gemini CLI Implementation 2
Gemini 大模型客户端实现（版本2：分步生成）
"""
import re
import base64
import json
from typing import List, Optional, AsyncGenerator

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.services.llm_cli import LLMClientBase, LLMError
from app.models.storybook import StorybookPage
from app.models.template import Template

logger = get_logger(__name__)


# ============ 自定���异常 ============

class GeminiContentPolicyError(LLMError):
    """Gemini 内容策略拒绝错误"""


class GeminiTechnicalError(LLMError):
    """Gemini 技术/API 异常"""


# ============ finishReason 映射表 ============

_FINISH_REASON_MAP: dict[types.FinishReason, tuple[str, str]] = {
    types.FinishReason.IMAGE_SAFETY:       ("IMAGE_SAFETY",       "图片内容违反安全策略，请修改描述后重试"),
    types.FinishReason.PROHIBITED_CONTENT: ("PROHIBITED_CONTENT", "内容违反安全策略，已被拒绝处理"),
    types.FinishReason.SAFETY:             ("SAFETY",             "内容触发了安全过滤器，请调整描述后重试"),
    types.FinishReason.RECITATION:         ("RECITATION",         "内容可能涉及版权问题，请换一种表达方式"),
    types.FinishReason.MAX_TOKENS:         ("MAX_TOKENS",         "内容长度超出限制，请精简提示词"),
    types.FinishReason.OTHER:              ("OTHER",              "生成被意外中断，请稍后重试"),
}


# ============ 文本拒绝类型检测 ============

def _detect_rejection_type(text: str) -> str:
    """检测 API 返回的纯文本属于哪类拒绝"""
    lower = text.lower()
    if any(k in lower for k in ["watermark", "水印"]):
        return "watermark"
    if any(k in lower for k in ["faceswap", "face swap", "换脸"]):
        return "faceswap"
    if any(k in lower for k in ["sexually", "explicit", "色情", "不雅", "pornographic"]):
        return "nsfw"
    if any(k in lower for k in ["i can't", "i cannot", "i'm just a language model",
                                  "我不能", "无法生成"]):
        return "general_rejection"
    return "unknown"


def _build_rejection_message(text: str, detected_type: str) -> str:
    """根据拒绝类型构建用户友好提示"""
    if detected_type == "watermark":
        return "去水印功能不被支持，请尝试其他编辑方式"
    if detected_type == "faceswap":
        return "换脸功能不被支持，请尝试其他编辑方式"
    if detected_type == "nsfw":
        return f"检测到不适当内容，请调整提示词后重试。AI说明：{text}"
    # general_rejection / unknown: 直接展示 API 原始文本
    return text


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


def _parse_response_to_pages(response: types.GenerateContentResponse) -> List[StorybookPage]:
    """
    解析 Gemini 响应为页面列表

    按优先级顺序检查：
    1. candidatesTokenCount == 0  → 内容审核最早期拒绝
    2. candidates 为空            → API 格式异常
    3. finishReason 非 STOP       → 生成过程拒绝
    4. content.parts 为空         → 内容结构异常
    5. 遍历 parts 收集文本和图片
    6. 有图片                     → 成功返回
    7. 无图片有文本               → 内容策略拒绝（展示 API 文本）
    8. 兜底                       → 技术异常
    """
    # Step 1: candidatesTokenCount == 0（最早期拒绝）
    if (response.usage_metadata is not None
            and response.usage_metadata.candidates_token_count == 0):
        logger.warning("内容审核拒绝 | candidatesTokenCount=0")
        raise GeminiContentPolicyError(
            "candidatesTokenCount=0，谷歌内容审核阶段拒绝",
            "您的请求在内容审核阶段被拒绝，请修改提示词或参考图后重试",
            "ZERO_CANDIDATES_TOKEN",
        )

    # Step 2: candidates 为空
    if not response.candidates:
        logger.error("Gemini 未返回 candidates | prompt_feedback=%s", response.prompt_feedback)
        raise GeminiTechnicalError(
            f"Gemini 未返回任何候选内容，prompt_feedback={response.prompt_feedback}",
            "系统出错，请稍后重试",
            "NO_CANDIDATES",
        )

    logger.info("开始解析 Gemini 响应为页面 | candidates_count=%s", len(response.candidates))

    pages: List[StorybookPage] = []
    current_text = ""
    accumulated_text = ""  # 所有未配对图片的纯文本（供 step 7 使用）

    for candidate in response.candidates:
        finish_reason = candidate.finish_reason
        logger.info("Gemini candidate finish_reason=%s", finish_reason)

        # Step 3: finishReason 非 STOP
        if finish_reason is not None and finish_reason != types.FinishReason.STOP:
            if finish_reason in _FINISH_REASON_MAP:
                error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                logger.warning("Gemini 内容拒绝 | finish_reason=%s error_type=%s",
                               finish_reason, error_type)
                raise GeminiContentPolicyError(
                    f"Gemini finish_reason={finish_reason}",
                    user_msg,
                    error_type,
                )
            # 未知非 STOP 原因
            logger.error("Gemini 未知异常结束 | finish_reason=%s", finish_reason)
            raise GeminiTechnicalError(
                f"Gemini 非正常结束 finish_reason={finish_reason}",
                "生成被意外中断，请稍后重试",
                "UNEXPECTED_FINISH_REASON",
            )

        # Step 4: content 为空
        if not candidate.content:
            logger.error("Gemini candidate.content 为空 | finish_reason=%s", finish_reason)
            raise GeminiTechnicalError(
                f"Gemini 返回内容为空，finish_reason={finish_reason}",
                "生成失败，请稍后重试",
                "NO_CONTENT",
            )

        parts = candidate.content.parts
        logger.info("candidate.content | parts_count=%s", len(parts) if parts else 0)

        if not parts:
            logger.error("Gemini content.parts 为空 | finish_reason=%s", finish_reason)
            raise GeminiTechnicalError(
                f"Gemini content.parts 为空，finish_reason={finish_reason}",
                "生成失败，请稍后重试",
                "NO_PARTS",
            )

        # Step 5: 遍历 parts，分别收集文本和图片
        for part in parts:
            if part.text:
                text = part.text
                logger.info("处理文本 part | text_length=%s", len(text))
                image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                matches = list(re.finditer(image_pattern, text))
                if matches:
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
                    after_last_image = text[last_end:].strip()
                    if after_last_image:
                        current_text = after_last_image
                else:
                    current_text += text
                    accumulated_text += text
                    logger.info("累积文本 | current_text_length=%s", len(current_text))

            elif part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                image_url = _inline_data_to_data_url(part.inline_data)
                logger.info("处理 inline_data 图片 | mime_type=%s data_length=%s",
                            part.inline_data.mime_type,
                            len(part.inline_data.data) if part.inline_data.data else 0)
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

    # Step 6: 有图片 → 成功
    if pages:
        # 修复第一页文本：如果第一页包含第二页内容，截取
        if len(pages) >= 2 and pages[0].get('text') and pages[1].get('text'):
            first_text = pages[0]['text']
            second_text = pages[1]['text']
            # 找到第二页文本在第一页中的位置，截取之前的内容
            pos = first_text.find(second_text[:10])
            if pos > 0:
                pages[0]['text'] = first_text[:pos].strip()
                logger.info("已截取第一页文本 | original_length=%s new_length=%s", len(first_text), len(pages[0]['text']))
        return pages

    # Step 7: 无图片但有文本 → 内容策略拒绝
    if accumulated_text.strip():
        logger.warning("未解析到页面，模型返回纯文本 | text_preview=%s", accumulated_text[:200])
        detected_type = _detect_rejection_type(accumulated_text)
        user_message = _build_rejection_message(accumulated_text, detected_type)
        raise GeminiContentPolicyError(
            f"Gemini 只返回文本无图片 | detected_type={detected_type} | text={accumulated_text[:300]}",
            user_message,
            "TEXT_RESPONSE_NO_IMAGE",
        )

    # Step 8: 兜底
    logger.error("未找到任何图片或有效文本内容")
    raise GeminiTechnicalError(
        "Gemini 响应中未找到图片或文本数据",
        "生成失败，请检查提示词后重试",
        "UNKNOWN",
    )


def _parse_response_to_single_page(response: types.GenerateContentResponse, fallback_page: StorybookPage) -> StorybookPage:
    """解析 Gemini 响应为单个页面，解析失败时回退到 fallback_page"""
    new_text = ""
    new_image_url = ""

    if not response.candidates:
        raise GeminiTechnicalError(
            f"Gemini 未返回任何候选内容，prompt_feedback={response.prompt_feedback}",
            "系统出错，请稍后重试",
            "NO_CANDIDATES",
        )

    for candidate in response.candidates:
        finish_reason = candidate.finish_reason
        logger.info("Gemini candidate finish_reason=%s", finish_reason)

        if finish_reason is not None and finish_reason != types.FinishReason.STOP:
            if finish_reason in _FINISH_REASON_MAP:
                error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                raise GeminiContentPolicyError(
                    f"Gemini finish_reason={finish_reason}",
                    user_msg,
                    error_type,
                )
            raise GeminiTechnicalError(
                f"Gemini 非正常结束 finish_reason={finish_reason}",
                "生成被意外中断，请稍后重试",
                "UNEXPECTED_FINISH_REASON",
            )

        if not candidate.content:
            raise GeminiTechnicalError(
                f"Gemini 返回内容为空，finish_reason={finish_reason}",
                "生成失败，请稍后重试",
                "NO_CONTENT",
            )

        for part in candidate.content.parts or []:
            if part.text:
                image_pattern = r'!\[.*?\]\((https?://[^\)]+)\)'
                match = re.search(image_pattern, part.text)
                if match:
                    new_image_url = match.group(1)
                    new_text = re.sub(image_pattern, '', part.text).strip()
                else:
                    new_text = part.text.strip()
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


def _extract_story_texts(response_text: str) -> List[str]:
    """
    从模型响应中提取故事文本列表

    Args:
        response_text: 模型返回的文本

    Returns:
        List[str]: 每页的故事文本列表
    """
    # 尝试解析 JSON 格式
    try:
        # 尝试找到 JSON 数组
        json_match = re.search(r'\[\s*\{.*\}\s*\]', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, list):
                texts = []
                for item in data:
                    if isinstance(item, dict) and 'text' in item:
                        texts.append(item['text'])
                    elif isinstance(item, str):
                        texts.append(item)
                if texts:
                    logger.info("从 JSON 中提取到 %d 条故事文本", len(texts))
                    return texts
    except (json.JSONDecodeError, Exception) as e:
        logger.info("JSON 解析失败: %s，尝试其他方法", e)

    # 尝试按行分割
    lines = response_text.strip().split('\n')
    texts = []
    current_text = []

    for line in lines:
        line = line.strip()
        # 跳过空行和标题
        if not line or line.startswith('#') or line.startswith('Page'):
            if current_text:
                texts.append(' '.join(current_text))
                current_text = []
            continue

        # 检查是否是新的页面标记（如 "1.", "Page 1", "第一页" 等）
        if re.match(r'^(\d+\.|Page\s+\d+|第[一二三四五六七八九十\d]+\s*页)', line):
            if current_text:
                texts.append(' '.join(current_text))
                current_text = []
            # 提取实际文本内容（去掉序号）
            text_content = re.sub(r'^(\d+\.|Page\s+\d+|第[一二三四五六七八九十\d]+\s*页)\s*', '', line)
            if text_content:
                current_text.append(text_content)
        else:
            current_text.append(line)

    # 添加最后一个文本
    if current_text:
        texts.append(' '.join(current_text))

    # 如果仍然没有提取到有效文本，尝试按段落分割
    if not texts:
        paragraphs = re.split(r'\n\n+', response_text.strip())
        texts = [p.strip() for p in paragraphs if p.strip()]

    logger.info("提取到 %d 条故事文本", len(texts))
    return texts


def _parse_images_response(response: types.GenerateContentResponse) -> List[str]:
    """
    解析图片生成响应，提取所有图片的 data URL

    Args:
        response: Gemini API 响应

    Returns:
        List[str]: 图片 data URL 列表
    """
    if not response.candidates:
        raise GeminiTechnicalError(
            f"Gemini 未返回任何候选内容，prompt_feedback={response.prompt_feedback}",
            "系统出错，请稍后重试",
            "NO_CANDIDATES",
        )

    images = []

    for candidate in response.candidates:
        finish_reason = candidate.finish_reason
        logger.info("Gemini candidate finish_reason=%s", finish_reason)

        if finish_reason is not None and finish_reason != types.FinishReason.STOP:
            if finish_reason in _FINISH_REASON_MAP:
                error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                raise GeminiContentPolicyError(
                    f"Gemini finish_reason={finish_reason}",
                    user_msg,
                    error_type,
                )
            raise GeminiTechnicalError(
                f"Gemini 非正常结束 finish_reason={finish_reason}",
                "生成被意外中断，请稍后重试",
                "UNEXPECTED_FINISH_REASON",
            )

        if not candidate.content:
            continue

        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                image_url = _inline_data_to_data_url(part.inline_data)
                images.append(image_url)
                logger.info("提取到图片 | mime_type=%s", part.inline_data.mime_type)

    logger.info("总共提取到 %d 张图片", len(images))
    return images


class GeminiCli(LLMClientBase):
    """Gemini 大模型客户端实现（版本2：分步生成）"""

    async def create_story(
        self,
        instruction: str,
        template: Optional[Template] = None,
        images: Optional[List[str]] = None
    ) -> AsyncGenerator[StorybookPage, None]:
        """
        创建故事（流式分步生成版本）

        第一步：先生成每页的故事文本
        第二步：逐页生成图片，每生成一页就返回一页

        Args:
            instruction: 用户指令/故事描述
            template: 模板对象（可选），包含风格名称、描述和系统提示词
            images: base64编码的参考图片列表（可选）

        Yields:
            StorybookPage: 每次yield生成的一页，包含文本内容和图片URL
        """
        client = _get_client()

        # ============ 第一步：生成故事文本 ============

        logger.info("开始第一步：生成故事文本")

        # System Prompt：定义系统角色和基本规则
        if template and template.systemprompt:
            system_instruction = template.systemprompt
        else:
            system_instruction = (
                "## Role\n"
                "You are a professional children's storybook writer. "
                "Your goal is to create engaging 10-panel stories for children.\n\n"
                "## Task\n"
                "Write exactly 10 short narrative texts (1-2 sentences each) for a children's storybook. "
                "Each text should be simple, engaging, and suitable for children.\n\n"
                "## Output Format\n"
                "Return a JSON array with 10 objects, each containing a 'text' field:\n"
                "```\n"
                "[\n"
                "  {\"text\": \"First panel story text...\"},\n"
                "  {\"text\": \"Second panel story text...\"},\n"
                "  ...\n"
                "]\n"
                "```\n\n"
                "## Constraints\n"
                "- Language: Match user's input language\n"
                "- Length: Exactly 10 panels\n"
                "- Each text: 1-2 sentences, simple and engaging\n"
                "- Story flow: Each panel should naturally lead to the next\n"
                "- Content: Pure story narrative only, no descriptions or labels"
            )

        # User Prompt：用户的具体创意要求
        user_prompt = (
            f"Create a 10-panel children's story based on: \"{instruction}\". "
            f"Return the result as a JSON array with 10 objects, each containing a 'text' field with the story text for that panel."
        )

        # 构建请求内容
        parts = [types.Part(text=user_prompt)]

        # 如果有参考图片，添加到请求中
        if images:
            parts.extend(_build_image_parts(images))

        # 调用 Gemini API 生成故事文本（JSON 格式）
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,  # 使用文本模型
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
                response_mime_type="application/json",  # 指定返回 JSON 格式
            ),
        )

        # 解析 JSON 故事文本
        story_texts = []
        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts or []:
                if part.text:
                    try:
                        data = json.loads(part.text)
                        if isinstance(data, list):
                            story_texts = [item['text'] if isinstance(item, dict) else item for item in data]
                        logger.info("从 JSON 解析到 %d 条故事文本", len(story_texts))
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning("JSON 解析失败: %s，回退到文本提取", e)
                        story_texts = _extract_story_texts(part.text)
                    break

        if not story_texts or len(story_texts) < 10:
            logger.warning("生成的故事文本不足10条，实际: %d", len(story_texts))
            # 补充到10条
            while len(story_texts) < 10:
                story_texts.append(f"Story panel {len(story_texts) + 1}")

        logger.info("故事文本生成完成 | count=%d", len(story_texts))

        # ============ 第二步：逐页生成图片并返回 ============

        logger.info("开始第二步：逐页生成图片并流式返回")

        # 图片生成的系统指令（专注于视觉风格）
        image_system_instruction = (
            "You are a professional children's book illustrator. "
            "Your task is to create a single illustration based on the provided story text. "
            "Create a full-bleed cinematic scene with clean backgrounds. "
            "CRITICAL: If reference images are provided (especially the previous page), "
            "you MUST maintain visual consistency - same characters, art style, color palette, and overall aesthetic. "
            "Use the reference images as a style guide to ensure consistency across the storybook."
        )

        # 添加模板风格到系统指令
        if template and template.name:
            image_system_instruction += f"\n\nART STYLE: {template.name}"
            if template.description:
                image_system_instruction += f"\n{template.description}"

        image_urls = []

        # 逐页生成图片并 yield
        for i, story_text in enumerate(story_texts):
            try:
                logger.info("生成第 %d 页图片 | text=%s", i + 1, story_text[:50])

                # 构建单张图片生成提示词
                # 首先提供完整的故事情节上下文
                full_story_context = "Complete Story Context:\n"
                for idx, text in enumerate(story_texts, 1):
                    full_story_context += f"Page {idx}: {text}\n"

                single_image_prompt = (
                    f"{full_story_context}\n\n"
                    f"CURRENT TASK: Generate illustration for PAGE {i + 1} ONLY\n\n"
                    f"Current page text: {story_text}\n\n"
                    f"Requirements:\n"
                    f"- Create a single full-bleed cinematic illustration for PAGE {i + 1}\n"
                    f"- The illustration should match the current page text\n"
                    f"- Consider the complete story context above to understand the narrative flow\n"
                    f"- No text, letters, or words in the image\n"
                    f"- Clean background, no borders or frames\n"
                    f"- Aspect ratio: 16:9\n"
                    f"- This is page {i + 1} of {len(story_texts)} total pages"
                )

                # 调用 Gemini API 生成单张图片
                parts = [types.Part(text=single_image_prompt)]

                # 收集参考图片
                reference_images = []

                # 第一页：使用用户提供的参考图片
                if i == 0 and images:
                    reference_images.extend(images)
                    logger.info("第 %d 页使用用户上传的图片作为参考 | user_images=%d", i + 1, len(images))
                # 第二页及以后：只使用上一页生成的图片
                elif i > 0 and len(image_urls) > 0:
                    reference_images.append(image_urls[-1])
                    logger.info("第 %d 页使用上一页图片作为参考 | previous_page=%d", i + 1, i)

                # 将所有参考图片添加到请求中
                if reference_images:
                    parts.extend(_build_image_parts(reference_images))

                image_response = await client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=types.Content(parts=parts),
                    config=types.GenerateContentConfig(
                        system_instruction=image_system_instruction,
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(aspect_ratio="16:9",image_size="1k"),
                    ),
                )

                # 解析单张图片响应
                response_images = _parse_images_response(image_response)
                if response_images:
                    image_url = response_images[0]
                    image_urls.append(image_url)
                    logger.info("第 %d 页图片生成成功 | total=%d", i + 1, len(image_urls))

                    # 立即 yield 这一页
                    yield {
                        "text": story_text,
                        "image_url": image_url
                    }
                    logger.info("已返回第 %d 页", i + 1)
                else:
                    logger.warning("第 %d 页图片生成失败，跳过", i + 1)

            except Exception as e:
                logger.exception("第 %d 页图片生成异常 | error=%s", i + 1, e)
                # 继续生成下一页，不中断整个流程
                continue

        logger.info("故事创建完成 | total_pages=%d", len(image_urls))

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

        # Step 1: candidatesTokenCount == 0
        if (response.usage_metadata is not None
                and response.usage_metadata.candidates_token_count == 0):
            logger.warning("edit_image_only 内容审核拒绝 | candidatesTokenCount=0")
            raise GeminiContentPolicyError(
                "candidatesTokenCount=0，谷歌内容审核阶段拒绝",
                "您的请求在内容审核阶段被拒绝，请修改描述后重试",
                "ZERO_CANDIDATES_TOKEN",
            )

        for candidate in response.candidates or []:
            finish_reason = candidate.finish_reason
            logger.info("edit_image_only candidate finish_reason=%s", finish_reason)

            # Step 3: finishReason 非 STOP
            if finish_reason is not None and finish_reason != types.FinishReason.STOP:
                if finish_reason in _FINISH_REASON_MAP:
                    error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                    logger.warning("edit_image_only 内容拒绝 | finish_reason=%s error_type=%s",
                                   finish_reason, error_type)
                    raise GeminiContentPolicyError(
                        f"Gemini finish_reason={finish_reason}",
                        user_msg,
                        error_type,
                    )
                raise GeminiTechnicalError(
                    f"edit_image_only 非正常结束 finish_reason={finish_reason}",
                    "生成被意外中断，请稍后重试",
                    "UNEXPECTED_FINISH_REASON",
                )

            if not candidate.content:
                continue
            for part in candidate.content.parts or []:
                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    logger.info("edit_image_only success | mime_type=%s", part.inline_data.mime_type)
                    return _inline_data_to_data_url(part.inline_data)

        raise GeminiTechnicalError(
            "edit_image_only 未获取到图片内容",
            "图片生成失败，请稍后重试",
            "NO_IMAGE_RETURNED",
        )

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
