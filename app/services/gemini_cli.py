"""
Gemini CLI Implementation
Gemini 大模型客户端实现（原子化接口版本）
"""
import re
import base64
import json
from typing import List, Optional, Tuple

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.services.llm_cli import LLMClientBase, LLMError
from app.models.page import Storyboard, Page
from app.models.template import Template
from app.models.image_style import ImageStyleVersion
from app.models.enums import PageType, StoryType, Language, AgeGroup

logger = get_logger(__name__)


# ============ 自定义异常 ============

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


def _style_reference_urls(image_style_version: Optional[ImageStyleVersion]) -> List[str]:
    if not image_style_version:
        return []
    return [
        image.url
        for image in image_style_version.reference_images
        if image.url
    ]


def _style_main_reference_url(image_style_version: Optional[ImageStyleVersion]) -> Optional[str]:
    """Return the single style anchor image: cover image first, otherwise first sorted reference."""
    if not image_style_version:
        return None
    images = [
        image
        for image in image_style_version.reference_images
        if image.url
    ]
    if not images:
        return None
    images.sort(key=lambda image: (not image.is_cover, image.sort_order, image.id))
    return images[0].url


def _inline_data_to_data_url(inline_data: types.Blob) -> str:
    """将 inline_data 转为 data URL（确保为 base64 字符串）"""
    data = inline_data.data
    if isinstance(data, bytes):
        base64_data = base64.b64encode(data).decode("ascii")
    else:
        base64_data = str(data)
    return f"data:{inline_data.mime_type};base64,{base64_data}"


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


def _parse_story_json_response(response: types.GenerateContentResponse) -> Tuple[List[str], List[Optional[Storyboard]]]:
    """
    解析故事文本+分镜的 JSON 响应

    Args:
        response: Gemini API 响应

    Returns:
        Tuple[List[str], List[Optional[Storyboard]]]: (故事文本列表, 分镜列表)
    """
    story_texts: List[str] = []
    story_storyboards: List[Optional[Storyboard]] = []

    if response.candidates and response.candidates[0].content:
        for part in response.candidates[0].content.parts or []:
            if part.text:
                try:
                    data = json.loads(part.text)
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                page_text = item.get('text', '')
                                story_texts.append(page_text)
                                sb = item.get('storyboard')
                                story_storyboards.append(_normalize_storyboard(sb, page_text))
                            else:
                                story_texts.append(str(item))
                                story_storyboards.append(None)
                    logger.info("从 JSON 解析到 %d 条故事文本+分镜", len(story_texts))
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("JSON 解析失败: %s，回退到文本提取", e)
                    story_texts = _extract_story_texts(part.text)
                    story_storyboards = [None] * len(story_texts)
                break

    return story_texts, story_storyboards


def _normalize_storyboard(raw: object, fallback_text: str = "") -> Optional[Storyboard]:
    """Normalize LLM storyboard output and keep old color/lighting fields out of the contract."""
    if not isinstance(raw, dict):
        return None
    summary = raw.get("summary") or fallback_text
    return {
        "summary": str(summary or ""),
        "scene": str(raw.get("scene") or ""),
        "characters": str(raw.get("characters") or ""),
        "shot": str(raw.get("shot") or ""),
    }


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
    """Gemini 大模型客户端 - 原子化接口"""


    async def create_story(
        self,
        instruction: str,
        word_count: int = 500,
        story_type: StoryType = StoryType.FAIRY_TALE,
        language: Language = Language.ZH,
        age_group: AgeGroup = AgeGroup.AGE_3_6,
    ) -> Tuple[str, str]:
        """
        创建纯文本故事（不含分镜）

        Args:
            instruction: 用户指令/故事描述
            word_count: 目标字数
            story_type: 故事类型
            language: 语言
            age_group: 年龄组

        Returns:
            Tuple[str, str]: (故事标题, 故事内容)
        """
        client = _get_client()
        logger.info("开始生成故事 | word_count=%d story_type=%s language=%s age_group=%s",
                   word_count, story_type, language, age_group)

        # 年龄组映射到描述
        age_descriptions = {
            AgeGroup.AGE_0_3: "0-3岁幼儿，需要极简单的词汇、重复的句式、温馨的内容",
            AgeGroup.AGE_3_6: "3-6岁儿童，可以使用简单的形容词、短句，内容富想象力",
            AgeGroup.AGE_6_8: "6-8岁儿童，可以使用丰富的词汇，情节可以有趣味性",
            AgeGroup.AGE_8_12: "8-12岁儿童，可以使用复杂的词汇和情节，富有教育意义",
            AgeGroup.AGE_12_PLUS: "12岁以上，可以使用成熟的叙事，内容深刻有意义",
        }

        # 故事类型映射到描述
        type_descriptions = {
            StoryType.FAIRY_TALE: "童话故事，包含魔法、奇幻生物",
            StoryType.ADVENTURE: "冒险故事，包含探索、发现、勇气",
            StoryType.EDUCATION: "教育故事，寓教于乐，传递知识或价值观",
            StoryType.SCIFI: "科幻故事，包含未来科技、太空探索",
            StoryType.FANTASY: "奇幻故事，包含虚构世界、超自然元素",
            StoryType.ANIMAL: "动物故事，以动物为主角",
            StoryType.DAILY_LIFE: "日常生活故事，贴近孩子的生活经验",
            StoryType.BEDTIME_STORY: "睡前故事，温馨、舒缓、有助于入睡",
        }

        # 语言映射
        language_names = {
            Language.ZH: "中文",
            Language.EN: "英文",
            Language.JA: "日文",
            Language.KO: "韩文",
        }

        # System Prompt
        system_instruction = (
            "## Role\n"
            "You are a professional children's storybook writer. "
            "Your goal is to create engaging, age-appropriate stories.\n\n"
            "## Task\n"
            "Write a complete children's story based on the user's requirements.\n\n"
            "## Output Format\n"
            "Return a JSON object with the following structure:\n"
            "```\n"
            "{{\n"
            "  \"title\": \"A concise, evocative story title\",\n"
            "  \"content\": \"The complete story content, divided into natural paragraphs\"\n"
            "}}\n"
            "```\n\n"
            "## Constraints\n"
            "- Target audience: {age_description}\n"
            "- Story type: {type_description}\n"
            "- Language: {language_name}\n"
            "- Length: Approximately {word_count} words\n"
            "- Story structure: Clear beginning, middle, and end\n"
            "- Content: Age-appropriate, engaging, and positive"
        )
        system_instruction = system_instruction.format(
            age_description=age_descriptions.get(age_group, age_descriptions[AgeGroup.AGE_3_6]),
            type_description=type_descriptions.get(story_type, type_descriptions[StoryType.FAIRY_TALE]),
            language_name=language_names.get(language, language_names[Language.ZH]),
            word_count=word_count,
        )

        # User Prompt
        user_prompt = (
            f"Create a {language_names.get(language, 'Chinese')} children's story "
            f"({type_descriptions.get(story_type, 'fairy tale')}) "
            f"for age group {age_group.value} "
            f"based on: \"{instruction}\"\n\n"
            f"Target length: approximately {word_count} words.\n\n"
            f"Return a JSON object with 'title' and 'content' fields. "
            f"The 'content' should be the complete story, naturally divided into paragraphs."
        )

        # 调用 Gemini API
        parts = [types.Part(text=user_prompt)]
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
                response_mime_type="application/json",
            ),
        )

        # 解析响应
        title = ""
        content = ""

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts or []:
                if part.text:
                    raw_text = part.text.strip()
                    logger.info("Gemini 返回原始文本 (前200字符): %s", raw_text[:200])

                    try:
                        # 尝试直接解析 JSON
                        data = json.loads(raw_text)
                        if isinstance(data, dict) and "title" in data and "content" in data:
                            title = str(data.get("title", "")).strip()
                            content = str(data.get("content", "")).strip()
                            logger.info("JSON 解析成功 | title=%s content_length=%d", title, len(content))
                        else:
                            logger.warning("JSON 格式不符合预期，缺少 title 或 content 字段")
                            raise ValueError("Invalid JSON structure")
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.warning("JSON 解析失败: %s, 原始文本: %s", e, raw_text[:500])

                        # 尝试从文本中提取 JSON（可能被包裹在 markdown 代码块中）
                        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
                        if json_match:
                            try:
                                data = json.loads(json_match.group(1))
                                if isinstance(data, dict) and "title" in data and "content" in data:
                                    title = str(data.get("title", "")).strip()
                                    content = str(data.get("content", "")).strip()
                                    logger.info("从代码块中提取 JSON 成功 | title=%s", title)
                                else:
                                    raise ValueError("Invalid JSON structure in code block")
                            except (json.JSONDecodeError, ValueError) as extract_err:
                                logger.warning("从代码块提取 JSON 失败: %s", extract_err)

                        # 如果仍然失败，回退到使用原始文本
                        if not title or not content:
                            logger.warning("使用回退策略：title=instruction[:50], content=raw_text")
                            title = instruction[:50]
                            content = raw_text
                    break

        if not content:
            logger.warning("模型未返回故事内容")
            raise GeminiTechnicalError(
                "Failed to generate story content",
                "故事生成失败，请重试",
                "NO_STORY_CONTENT",
            )

        logger.info("故事生成完成 | title=%s words=%d", title, len(content.split()))
        return title, content

    async def create_storyboard_from_story(
        self,
        story_content: str,
        page_count: int = 10,
        style_name: Optional[str] = None,
        style_summary: Optional[str] = None,
        storyboard_complexity: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """
        基于故事内容创建分镜描述

        Args:
            story_content: 故事内容（纯文本）
            page_count: 需要拆分的页数

        Returns:
            Tuple[List[str], List[Optional[Storyboard]]]: (每页故事文本列表, 分镜列表)
        """
        client = _get_client()
        logger.info("开始生成分镜 | page_count=%d story_length=%d", page_count, len(story_content))

        # System Prompt
        system_instruction = (
            "## Role\n"
            "You are a professional visual director for children's picture books. "
            "Your goal is to break down story content into page-by-page visual storyboards.\n\n"
            "## Task\n"
            "Divide the provided story into {page_count} pages and create a visual storyboard for each page.\n\n"
            "## Output Format\n"
            "Return a JSON array with the following structure:\n"
            "```\n"
            "[\n"
            "  {\n"
            "    \"text\": \"Story text for this page\",\n"
            "    \"storyboard\": {\n"
            "      \"summary\": \"One-sentence visual summary for image generation\",\n"
            "      \"scene\": \"Scene environment description\",\n"
            "      \"characters\": \"Character actions, posture and expressions — describe what they are DOING and FEELING\",\n"
            "      \"shot\": \"Shot type and composition (e.g. medium shot, close-up, wide shot)\"\n"
            "    }\n"
            "  }\n"
            "]\n"
            "```\n\n"
            "## Constraints\n"
            "- Page count: Exactly {page_count} pages\n"
            "- Text per page: Use appropriate text from the original story\n"
            "- Storyboard fields: Must be in English\n"
            "- 'summary' field: One sentence, visual-only, 20-40 words; include only visible characters, action, key objects, setting, and mood\n"
            "- Story flow: Each page should naturally lead to the next\n"
            "- Visual consistency: Maintain character and style consistency across pages\n"
            "- 'characters' field: Describe actions, posture, and expressions ONLY — do not describe physical appearance"
        )
        system_instruction = system_instruction.replace("{page_count}", str(page_count))
        if style_name or style_summary:
            system_instruction += (
                "\n\n## Visual Style Guidance\n"
                "Use the selected art style only as weak visual guidance for storyboard complexity. "
                "Do not change the story content, character relationships, or narrative events.\n"
                f"- Style name: {style_name or ''}\n"
                f"- Style summary: {style_summary or ''}\n"
                f"- Storyboard complexity advice: {storyboard_complexity or ''}\n"
            )

        # User Prompt
        user_prompt = (
            f"STORY CONTENT:\n{story_content}\n\n"
            f"SELECTED ART STYLE SUMMARY:\n{style_summary or 'None'}\n\n"
            f"TASK: Break this story into {page_count} pages and create a visual storyboard for each page.\n\n"
            f"Return a JSON array with {page_count} objects, each containing:\n"
            f"- 'text': The story text for this page\n"
            f"- 'storyboard': Visual description with fields: summary, scene, characters, shot\n\n"
            f"Ensure smooth narrative flow across all pages."
        )

        # 构建请求内容
        parts = [types.Part(text=user_prompt)]

        # 调用 Gemini API
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
                response_mime_type="application/json",
            ),
        )

        # 解析响应
        story_texts: List[str] = []
        storyboards: List[Optional[Storyboard]] = []

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts or []:
                if part.text:
                    try:
                        data = json.loads(part.text)
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict):
                                    page_text = item.get("text", "")
                                    story_texts.append(page_text)
                                    sb = item.get("storyboard")
                                    storyboards.append(_normalize_storyboard(sb, page_text))
                        logger.info("分镜解析完成 | pages=%d", len(storyboards))
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning("JSON 解析失败: %s", e)
                        raise GeminiTechnicalError(
                            f"Failed to parse storyboard: {e}",
                            "分镜解析失败，请重试",
                            "PARSE_ERROR",
                        )
                    break

        if not storyboards:
            logger.warning("模型未返回分镜")
            raise GeminiTechnicalError(
                "Failed to generate storyboard",
                "分镜生成失败，请重试",
                "NO_STORYBOARD",
            )

        logger.info("分镜生成完成 | count=%d", len(storyboards))
        return story_texts, storyboards

    async def create_insertion_story_and_storyboard(
        self,
        pages: List[Page],
        insert_position: int,
        count: int,
        instruction: str,
        template: Optional[Template] = None,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """
        创建插入页面的故事文本和分镜（需要上下文）

        Args:
            pages: 现有页面列表
            insert_position: 插入位置
            count: 插入页面数量
            instruction: 插入指令
            template: 模板对象（可选）

        Returns:
            Tuple[List[str], List[Optional[Storyboard]]]: (故事文本列表, 分镜列表)
        """
        client = _get_client()
        logger.info("开始生成插入页面故事文本和分镜 | insert_position=%d count=%d", insert_position, count)

        # 根据插入位置提取前后页面
        before_page: Optional[Page] = None
        after_page: Optional[Page] = None

        if insert_position > 0 and insert_position <= len(pages):
            before_page = pages[insert_position - 1]
        if insert_position >= 0 and insert_position < len(pages):
            after_page = pages[insert_position]

        logger.info("提取前后页面 | has_before=%s | has_after=%s", bool(before_page), bool(after_page))

        # 构建完整故事上下文（所有页面文本）
        full_story_context = "Complete Story Context:\n"
        for idx, page in enumerate(pages):
            position_marker = ""
            if idx == insert_position - 1:
                position_marker = " <-- BEFORE insertion point"
            elif idx == insert_position:
                position_marker = " <-- AFTER insertion point"
            page_text = page.text or ""
            full_story_context += f"Page {idx + 1}: {page_text}{position_marker}\n"

        # 构建插入点上下文（前后页文本）
        insertion_context_parts = []
        if before_page:
            before_text = before_page.text or ""
            insertion_context_parts.append(f"PAGE BEFORE insertion (Page {insert_position}):\n{before_text}")
        if after_page:
            after_text = after_page.text or ""
            insertion_context_parts.append(f"PAGE AFTER insertion (Page {insert_position + 1}):\n{after_text}")

        if not insertion_context_parts:
            insertion_context_str = "No context pages available"
        else:
            insertion_context_str = "\n\n".join(insertion_context_parts)

        # System Prompt：定义系统角色和基本规则
        if template and template.systemprompt:
            system_instruction = template.systemprompt
        else:
            system_instruction = (
                "## Role\n"
                "You are a professional children's storybook writer and visual director. "
                "Your goal is to create engaging story panels with detailed visual storyboards.\n\n"
                "## Task\n"
                "Generate new story panels that will be inserted between two existing pages. "
                "For each panel, provide both the story text and a storyboard describing the illustration.\n\n"
                "## Output Format\n"
                "Return a JSON array with objects:\n"
                "```\n"
                "[\n"
                "  {\n"
                "    \"text\": \"Story narrative text\",\n"
                "    \"storyboard\": {\n"
                "      \"summary\": \"One-sentence visual summary for image generation\",\n"
                "      \"scene\": \"Scene environment, e.g. sunlit forest clearing with tall oak trees\",\n"
                "      \"characters\": \"Character actions, posture and expression for this panel, e.g. kneeling down with arms outstretched, mouth open in surprise — describe what they are DOING and FEELING, not what they look like\",\n"
                "      \"shot\": \"Shot type and composition, e.g. medium shot, subject centered\"\n"
                "    }\n"
                "  }\n"
                "]\n"
                "```\n\n"
                "## Constraints\n"
                "- Language: Match the language of the context pages for 'text' field; storyboard fields must be in English\n"
                "- Length: Exactly {count} panel(s)\n"
                "- Each text: Simple and engaging\n"
                "- Story flow: The new panels should naturally connect the before and after pages\n"
                "- 'summary' field: One sentence, visual-only, 20-40 words; do not include thoughts, narration, abstract themes, or long dialogue\n"
                "- Storyboard: Be specific and visual, avoid abstract descriptions\n"
                "- 'characters' field: describe actions, posture, and expressions ONLY — do not describe physical appearance or clothing\n"
                "- IMPORTANT: Every panel MUST include both 'text' and 'storyboard' fields; omitting storyboard is not allowed"
            )
            system_instruction = system_instruction.replace("{count}", str(count))

        # User Prompt：用户的具体插入要求
        insert_instruction = instruction if instruction else "Create natural story progression between the context pages"
        user_prompt = (
            f"COMPLETE STORY CONTEXT:\n{full_story_context}\n\n"
            f"INSERTION POINT CONTEXT:\n{insertion_context_str}\n\n"
            f"INSERTION INSTRUCTION: {insert_instruction}\n\n"
            f"TASK: Generate exactly {count} new panel(s) to insert at position {insert_position}. "
            f"Return a JSON array with {count} objects, each containing a 'text' field (story narrative) "
            f"and a 'storyboard' object with fields: summary, scene, characters, shot. "
            f"The new panels should naturally bridge the narrative flow at the insertion point, "
            f"considering the complete story context above."
        )

        # 构建请求内容
        parts = [types.Part(text=user_prompt)]

        # 添加前后参考图片（封面和封底不作为参考）
        reference_images = []
        if before_page and before_page.image_url and before_page.page_type == PageType.CONTENT:
            reference_images.append(before_page.image_url)
        if after_page and after_page.image_url and after_page.page_type == PageType.CONTENT:
            reference_images.append(after_page.image_url)

        if reference_images:
            parts.append(types.Part(
                text=f"The following image(s) are the BEFORE and AFTER pages at position {insert_position} in the story. "
                f"The FIRST image (if provided) is the BEFORE page (Page {insert_position}), "
                f"the SECOND image (if provided) is the AFTER page (Page {insert_position + 1}). "
                f"Use them to understand the visual style, characters, art style, and create smooth narrative and visual continuity."
            ))
            parts.extend(_build_image_parts(reference_images))
            logger.info("添加前后参考图片 | count=%d", len(reference_images))

        # 调用 Gemini API 生成故事文本（JSON 格式）
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
                response_mime_type="application/json",
            ),
        )

        # 解析 JSON 故事文本 + 分镜
        story_texts, story_storyboards = _parse_story_json_response(response)

        if not story_texts:
            logger.warning("模型未返回任何插入页面文本")

        logger.info("插入页面文本生成完成 | count=%d", len(story_texts))
        return story_texts, story_storyboards

    async def generate_page(
        self,
        story_text: str,
        storyboard: Optional[Storyboard],
        story_context: List[str],
        page_index: int,
        character_reference_images: Optional[List[str]] = None,
        previous_page_image: Optional[str] = None,
        template: Optional[Template] = None,
        image_style_version: Optional[ImageStyleVersion] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
        image_instruction: str = "",
    ) -> str:
        """
        生成单页图片，返回图片URL

        Args:
            story_text: 当前页的故事文本
            storyboard: 当前页的分镜描述
            story_context: 完整故事的所有文本（用于上下文理解）
            page_index: 当前页索引（从0开始）
            character_reference_images: 用户提供的角色参考图片
            previous_page_image: 上一页生成的图片URL
            template: 风格模板
            image_style_version: 绘本锁定的画风版本
            aspect_ratio: 图片比例
            image_size: 图片尺寸
            image_instruction: 用户图片调整指令

        Returns:
            str: 生成的图片URL（base64 data URL）
        """
        client = _get_client()
        visual_summary = story_text
        if storyboard and storyboard.get("summary"):
            visual_summary = storyboard.get("summary") or story_text
        total_pages = len(story_context)
        has_previous_page_image = bool(previous_page_image)
        character_reference_count = len(character_reference_images) if character_reference_images else 0
        first_page_style_main_reference = (
            _style_main_reference_url(image_style_version)
            if page_index == 0
            else None
        )
        logger.info(
            "图片生成 prompt 使用上下文收敛模式 | page_index=%d summary=%s has_storyboard=%s "
            "has_style_version=%s has_first_page_style_main_reference=%s character_reference_count=%d "
            "has_previous_page_image=%s context_mode=current_page_only",
            page_index,
            visual_summary[:50],
            bool(storyboard),
            bool(image_style_version),
            bool(first_page_style_main_reference),
            character_reference_count,
            has_previous_page_image,
        )

        image_system_instruction = (
            "You are a professional children's picture book illustrator.\n\n"
            "Priority order:\n"
            "1. Preserve cross-page visual continuity.\n"
            "2. Follow the LOCKED ART STYLE.\n"
            "3. Follow the CURRENT PAGE visual summary and storyboard.\n"
            "4. Apply explicit user image adjustment instructions.\n\n"
            "If a previous page image is provided, treat it as the strongest continuity reference for established "
            "character appearance, object appearance, art style, palette, and scene continuity. "
            "Do not change established visual identity unless the user explicitly asks for a change.\n\n"
            "Create one full-bleed children's book illustration. "
            "No text, letters, captions, labels, borders, or frames."
        )

        if storyboard:
            storyboard_desc = (
                f"CURRENT PAGE STORYBOARD:\n"
                f"- Scene: {storyboard.get('scene', '')}\n"
                f"- Characters: {storyboard.get('characters', '')}\n"
                f"- Shot: {storyboard.get('shot', '')}"
            )
        else:
            storyboard_desc = "CURRENT PAGE STORYBOARD:\n- Scene: \n- Characters: \n- Shot: "

        locked_style_parts = []
        if template and template.name:
            locked_style_parts.append(f"Template style: {template.name}")
            if template.description:
                locked_style_parts.append(f"Template description: {template.description}")
        if image_style_version:
            if image_style_version.style_description:
                locked_style_parts.append(f"Locked style description: {image_style_version.style_description}")
            if image_style_version.generation_prompt:
                locked_style_parts.append(f"Locked style generation prompt: {image_style_version.generation_prompt}")
            if image_style_version.negative_prompt:
                locked_style_parts.append(f"Negative prompt: {image_style_version.negative_prompt}")
        locked_style = "\n".join(locked_style_parts) if locked_style_parts else "Use the selected children's book style."

        single_image_prompt = (
            f"CURRENT TASK:\n"
            f"Generate illustration for Page {page_index + 1} of {total_pages}.\n\n"
            f"CURRENT PAGE VISUAL SUMMARY:\n"
            f"{visual_summary}\n\n"
            f"{storyboard_desc}\n\n"
            f"LOCKED ART STYLE:\n"
            f"{locked_style}\n\n"
            f"RULES:\n"
            f"- Draw only the current page.\n"
            f"- Do not add text, letters, captions, labels, borders, or frames.\n"
            f"- If a previous page image is provided, preserve established visual continuity from it.\n"
            f"- Character reference images are only for maintaining character identity and recognizability; "
            f"do not learn art style, palette, background complexity, or composition from them."
        )
        if first_page_style_main_reference:
            single_image_prompt += (
                "\n\nSTYLE MAIN REFERENCE IMAGE:\n"
                "Only when generating page 1, use the provided style main image as the primary locked art style reference. "
                "Learn its medium, brushwork, line quality, palette, texture, background detail level, and overall children's book feeling. "
                "Do not copy its specific subject, character, scene, text, or composition."
            )
        if image_instruction:
            single_image_prompt += (
                f"\n\nUser image adjustment instruction:\n{image_instruction}\n"
                "Apply this instruction while preserving cross-page visual continuity, locked art style, and the current page summary/storyboard."
            )

        # 调用 Gemini API 生成单张图片
        parts = [types.Part(text=single_image_prompt)]

        if first_page_style_main_reference:
            parts.append(types.Part(
                text=(
                    "The following image is the STYLE MAIN REFERENCE IMAGE for page 1. "
                    "Use it only to establish the locked art style: medium, brushwork, line quality, palette, texture, "
                    "background detail level, and children's book feeling. Do not copy its subject, characters, scene, text, or composition."
                )
            ))
            parts.extend(_build_image_parts([first_page_style_main_reference]))
            logger.info("第 %d 页添加风格主图片 | count=1", page_index + 1)

        if previous_page_image:
            parts.append(types.Part(
                text=(
                    "The following image is the PREVIOUS PAGE illustration and the HIGHEST-PRIORITY CONTINUITY REFERENCE. "
                    "Preserve established character appearance, clothing, accessories, proportions, object details, scene continuity, "
                    "art style, palette, texture, and line quality. Do not change established visual identity unless explicitly requested."
                )
            ))
            parts.extend(_build_image_parts([previous_page_image]))
            logger.info("第 %d 页添加上一页图片作为最高优先级连续性参考 | previous_page=%d", page_index + 1, page_index)

        if character_reference_images:
            parts.append(types.Part(
                text=f"The following {len(character_reference_images)} image(s) are CHARACTER REFERENCE IMAGES. "
                f"The character may be a person, animal, toy, or anthropomorphic object. "
                f"Use them only to preserve character identity, appearance cues, posture features, and recognizability. "
                f"Do not learn art style, color grading, background detail level, or composition from these images."
            ))
            parts.extend(_build_image_parts(character_reference_images))
            logger.info("第 %d 页添加用户角色参考图 | count=%d", page_index + 1, len(character_reference_images))

        image_response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=image_system_instruction,
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
            ),
        )

        # 解析单张图片响应
        response_images = _parse_images_response(image_response)
        if response_images:
            image_url = response_images[0]
            logger.info("第 %d 页图片生成成功", page_index + 1)
            return image_url
        else:
            raise GeminiTechnicalError(
                f"第 {page_index + 1} 页图片生成失败",
                "图片生成失败，请稍后重试",
                "NO_IMAGE_RETURNED",
            )

    async def edit_image(
        self,
        instruction: str,
        current_image_url: str,
        referenced_image: Optional[str] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """
        编辑图片

        Args:
            instruction: 编辑指令
            current_image_url: 当前图片URL
            referenced_image: 参考图片URL（可选）
            aspect_ratio: 图片比例
            image_size: 图片尺寸

        Returns:
            str: 编辑后的图片URL（base64 data URL）
        """
        logger.info("edit_image start | model=%s | instruction=%s", settings.GEMINI_EDIT_MODEL, instruction)
        client = _get_client()

        system_instruction = (
            "You are a professional illustrator specializing in image editing. "
            "You will receive an existing illustration and an editing instruction. "
            "Your task is to EDIT and MODIFY the provided image according to the instruction — "
            "do NOT generate a completely new image from scratch. "
            "Preserve the original composition, characters, art style, color palette, and visual consistency as much as possible, "
            "only applying the specific changes requested. "
            "Output a full-bleed cinematic illustration. "
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
        if referenced_image:
            parts.append(types.Part(text="The following image is a REFERENCE IMAGE. Use it for style or character reference."))
            parts.extend(_build_image_parts([referenced_image]))
        logger.info("edit_image calling API | has_image=%s has_referenced=%s", bool(current_image_url), bool(referenced_image))

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_EDIT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
            ),
        )

        # 检查 candidatesTokenCount == 0
        if (response.usage_metadata is not None
                and response.usage_metadata.candidates_token_count == 0):
            logger.warning("edit_image 内容审核拒绝 | candidatesTokenCount=0")
            raise GeminiContentPolicyError(
                "candidatesTokenCount=0，谷歌内容审核阶段拒绝",
                "您的请求在内容审核阶段被拒绝，请修改描述后重试",
                "ZERO_CANDIDATES_TOKEN",
            )

        for candidate in response.candidates or []:
            finish_reason = candidate.finish_reason
            logger.info("edit_image candidate finish_reason=%s", finish_reason)

            if finish_reason is not None and finish_reason != types.FinishReason.STOP:
                if finish_reason in _FINISH_REASON_MAP:
                    error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                    raise GeminiContentPolicyError(
                        f"Gemini finish_reason={finish_reason}",
                        user_msg,
                        error_type,
                    )
                raise GeminiTechnicalError(
                    f"edit_image 非正常结束 finish_reason={finish_reason}",
                    "生成被意外中断，请稍后重试",
                    "UNEXPECTED_FINISH_REASON",
                )

            if not candidate.content:
                continue
            for part in candidate.content.parts or []:
                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    logger.info("edit_image success | mime_type=%s", part.inline_data.mime_type)
                    return _inline_data_to_data_url(part.inline_data)

        raise GeminiTechnicalError(
            "edit_image 未获取到图片内容",
            "图片生成失败，请稍后重试",
            "NO_IMAGE_RETURNED",
        )

    async def generate_cover(
        self,
        title: str,
        cover_text: str,
        reference_images: List[str],
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
        image_instruction: str = "",
        image_style_version: Optional[ImageStyleVersion] = None,
    ) -> str:
        """生成绘本封面图片，使用内页图作为风格参考"""
        client = _get_client()
        logger.info("生成封面 | title=%s ref_count=%d", title, len(reference_images))

        system_instruction = (
            "You are a professional children's book cover designer. "
            "Your task is to create a single eye-catching cover illustration for a picture book. "
            "The cover must be visually striking, compositionally complete, and reflect the story's art style. "
            "Extract the art style, color palette, and character appearance from the reference page illustrations provided. "
            "Apply these consistently to create a cohesive cover that feels part of the same book. "
            "The cover should feature the main character(s) prominently with an inviting, warm composition. "
            "IMPORTANT: The book title MUST appear on the cover as beautifully hand-lettered or illustrated artistic text — "
            "styled to match the book's art style (e.g. brush script, fairy-tale calligraphy, playful bubble letters). "
            "The title text should be integrated naturally into the illustration, not pasted on top. "
            "Output a full-bleed illustration."
        )
        if image_style_version:
            if image_style_version.style_description:
                system_instruction += f"\n\nLOCKED STYLE DESCRIPTION:\n{image_style_version.style_description}"
            if image_style_version.negative_prompt:
                system_instruction += f"\n\nNEGATIVE PROMPT:\n{image_style_version.negative_prompt}"

        prompt = (
            f"Create a cover illustration for the children's picture book.\n\n"
            f"Book title (MUST appear as artistic hand-lettered text on the cover): 《{title}》\n"
            f"Cover description: {cover_text}\n\n"
            f"Requirements:\n"
            f"- Full-bleed cinematic cover composition\n"
            f"- Match the art style, color palette, and character design from the reference page illustrations below\n"
            f"- The main character(s) should be clearly visible and engaging\n"
            f"- Warm, inviting mood appropriate for a children's book cover\n"
            f"- The title 「{title}」 MUST be rendered as decorative artistic lettering integrated into the illustration\n"
            f"- Title text style: hand-lettered, calligraphic, or illustrated — consistent with the book's art style"
        )
        if image_style_version and image_style_version.generation_prompt:
            prompt += (
                "\n\nLocked style generation prompt:\n"
                f"{image_style_version.generation_prompt}"
            )
        if image_instruction:
            prompt += (
                f"\n\nUser cover adjustment instruction:\n{image_instruction}\n"
                "Apply this instruction while keeping the cover cohesive with the reference page illustrations."
            )

        parts = [types.Part(text=prompt)]
        if reference_images:
            parts.append(types.Part(
                text=(
                    f"The following {len(reference_images)} image(s) are REFERENCE PAGE ILLUSTRATIONS from this book. "
                    "Extract and maintain the exact character appearance and visual continuity."
                )
            ))
            parts.extend(_build_image_parts(reference_images))

        style_reference_images = _style_reference_urls(image_style_version)
        if style_reference_images:
            parts.append(types.Part(
                text=(
                    f"The following {len(style_reference_images)} image(s) are LOCKED ART STYLE REFERENCES. "
                    "Learn only the overall visual style, medium, palette, texture, line quality, and mood. "
                    "Do not copy specific characters, text, composition, scene, or objects from these images."
                )
            ))
            parts.extend(_build_image_parts(style_reference_images))

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
            ),
        )

        if (response.usage_metadata is not None
                and response.usage_metadata.candidates_token_count == 0):
            raise GeminiContentPolicyError(
                "封面生成 candidatesTokenCount=0",
                "封面生成被内容审核拒绝，请修改描述后重试",
                "ZERO_CANDIDATES_TOKEN",
            )

        for candidate in response.candidates or []:
            finish_reason = candidate.finish_reason
            if finish_reason is not None and finish_reason != types.FinishReason.STOP:
                if finish_reason in _FINISH_REASON_MAP:
                    error_type, user_msg = _FINISH_REASON_MAP[finish_reason]
                    raise GeminiContentPolicyError(
                        f"封面生成 finish_reason={finish_reason}",
                        user_msg,
                        error_type,
                    )
                raise GeminiTechnicalError(
                    f"封面生成非正常结束 finish_reason={finish_reason}",
                    "生成被意外中断，请稍后重试",
                    "UNEXPECTED_FINISH_REASON",
                )
            if not candidate.content:
                continue
            for part in candidate.content.parts or []:
                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                    logger.info("封面生成成功 | mime_type=%s", part.inline_data.mime_type)
                    return _inline_data_to_data_url(part.inline_data)

        raise GeminiTechnicalError(
            "封面生成未获取到图片内容",
            "封面生成失败，请稍后重试",
            "NO_IMAGE_RETURNED",
        )

    async def regenerate_page_text(
        self,
        current_text: str,
        story_context: List[str],
        page_index: int,
        instruction: str = "",
    ) -> str:
        """Regenerate text for a single page"""
        client = _get_client()
        logger.info("Regenerating page %d text | instruction=%s", page_index + 1, instruction[:50])

        full_context = "Complete Story Context:\n"
        for idx, text in enumerate(story_context, 1):
            marker = " <-- CURRENT PAGE" if idx == page_index + 1 else ""
            full_context += f"Page {idx}: {text}{marker}\n"

        system_instruction = (
            "You are a professional children's picture book writer. "
            "Your task is to rewrite the story text for a specific page based on user instructions.\n\n"
            "Requirements:\n"
            "- Maintain narrative continuity with the surrounding pages\n"
            "- Keep the same language style and reading difficulty\n"
            "- Follow the user's adjustment direction if provided\n"
            "- Output ONLY the new page text, no explanations or formatting"
        )

        user_prompt = (
            f"{full_context}\n\n"
            f"Please rewrite the story text for Page {page_index + 1}.\n"
        )
        if instruction:
            user_prompt += f"User adjustment instruction: {instruction}\n"
        else:
            user_prompt += "Rewrite this page's text while maintaining narrative continuity.\n"
        user_prompt += "\nOutput only the new page text."

        parts = [types.Part(text=user_prompt)]
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
            ),
        )

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts or []:
                if part.text:
                    new_text = part.text.strip()
                    if new_text:
                        logger.info("Page %d text regenerated | length=%d", page_index + 1, len(new_text))
                        return new_text

        raise GeminiTechnicalError(
            "Failed to regenerate page text",
            "Text generation failed, please retry",
            "NO_TEXT_RETURNED",
        )

    async def regenerate_page_storyboard(
        self,
        page_text: str,
        story_context: List[str],
        page_index: int,
        instruction: str = "",
    ) -> Optional[Storyboard]:
        """Regenerate storyboard for a single page"""
        client = _get_client()
        logger.info("Regenerating page %d storyboard | instruction=%s", page_index + 1, instruction[:50])

        full_context = "Complete Story Context:\n"
        for idx, text in enumerate(story_context, 1):
            full_context += f"Page {idx}: {text}\n"

        system_instruction = (
            "You are a professional visual director for children's picture books. "
            "Your task is to create a visual storyboard for a specific page.\n\n"
            "Return a JSON object with the following structure:\n"
            "```\n"
            "{\n"
            '  "summary": "One-sentence visual summary for image generation",\n'
            '  "scene": "Scene environment description",\n'
            '  "characters": "Character actions, posture and expressions",\n'
            '  "shot": "Shot type and composition"\n'
            "}\n"
            "```\n\n"
            "Constraints:\n"
            "- All storyboard fields must be in English\n"
            "- 'summary' field: One sentence, visual-only, 20-40 words; include only visible characters, action, key objects, setting, and mood\n"
            "- 'characters' field: describe actions, posture, and expressions ONLY\n"
            "- Maintain visual consistency with surrounding pages"
        )

        user_prompt = (
            f"{full_context}\n\n"
            f"Current page (Page {page_index + 1}) text: {page_text}\n\n"
            f"Create a visual storyboard for this page.\n"
        )
        if instruction:
            user_prompt += f"User adjustment instruction: {instruction}\n"
        user_prompt += "\nReturn a JSON object with summary, scene, characters, shot."

        parts = [types.Part(text=user_prompt)]
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_TEXT_MODEL,
            contents=types.Content(parts=parts),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_modalities=["TEXT"],
                response_mime_type="application/json",
            ),
        )

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts or []:
                if part.text:
                    try:
                        data = json.loads(part.text)
                        normalized = _normalize_storyboard(data, page_text)
                        if normalized and normalized.get("scene"):
                            logger.info("Page %d storyboard regenerated", page_index + 1)
                            return normalized
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning("Storyboard JSON parse failed: %s", e)

        raise GeminiTechnicalError(
            "Failed to regenerate storyboard",
            "Storyboard generation failed, please retry",
            "NO_STORYBOARD_RETURNED",
        )
