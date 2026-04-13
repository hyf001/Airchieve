"""
Doubao CLI Implementation
豆包大模型客户端实现（基于火山方舟 Ark SDK）
"""
import asyncio
import json
import re
from typing import List, Optional, Tuple, TypeVar

from pydantic import BaseModel

from volcenginesdkarkruntime import Ark

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.services.llm_cli import LLMClientBase, LLMError
from app.models.page import Storyboard, Page
from app.models.template import Template
from app.models.enums import PageType, StoryType, Language, AgeGroup

logger = get_logger(__name__)


# ============ 自定义异常 ============

class DoubaoContentPolicyError(LLMError):
    """豆包内容策略拒绝错误"""


class DoubaoTechnicalError(LLMError):
    """豆包技术/API 异常"""


# ============ Ark 客户端 ============

def _get_client() -> Ark:
    """获取 Ark SDK 客户端"""
    return Ark(
        base_url=settings.DOUBAO_BASE_URL,
        api_key=settings.DOUBAO_API_KEY,
    )


# ============ 尺寸映射 ============

# aspect_ratio -> image_size -> 像素尺寸
_IMAGE_SIZE_MAP = {
    "1:1":  {"1k": "2048x2048", "2k": "2048x2048", "4k": "3072x3072"},
    "4:3":  {"1k": "2304x1728", "2k": "2304x1728", "4k": "3456x2592"},
    "16:9": {"1k": "2848x1600", "2k": "2848x1600", "4k": "4096x2304"},
}


def _resolve_image_size(aspect_ratio: str, image_size: str) -> str:
    """根据 aspect_ratio 和 image_size 解析最���像素尺寸"""
    ratio_map = _IMAGE_SIZE_MAP.get(aspect_ratio, _IMAGE_SIZE_MAP["16:9"])
    return ratio_map.get(image_size.lower(), ratio_map["1k"])


# ============ 辅助函数 ============

def _build_image_prompt(
    story_text: str,
    storyboard: Optional[Storyboard],
    story_context: List[str],
    page_index: int,
    template: Optional[Template] = None,
) -> str:
    """构建图片生成的 prompt"""
    full_story_context = "完整故事上下文：\n"
    for idx, text in enumerate(story_context, 1):
        full_story_context += f"第{idx}页：{text}\n"

    if storyboard:
        storyboard_desc = (
            f"故事文本：{story_text}\n"
            f"分镜描述：\n"
            f"- 场景：{storyboard.get('scene', '')}\n"
            f"- 角色：{storyboard.get('characters', '')}\n"
            f"- 构图：{storyboard.get('shot', '')}\n"
            f"- 色调：{storyboard.get('color', '')}\n"
            f"- 光影：{storyboard.get('lighting', '')}"
        )
    else:
        storyboard_desc = f"故事文本：{story_text}"

    style_prefix = ""
    if template and template.name:
        style_prefix = f"艺术风格：{template.name}。"
        if template.description:
            style_prefix += f"{template.description}。"

    prompt = (
        f"{style_prefix}"
        f"{full_story_context}\n"
        f"当前任务：为第{page_index + 1}页生成插图。\n\n"
        f"{storyboard_desc}\n\n"
        f"要求：\n"
        f"- 按要求生成一张绘本插画\n"
        f"- 图片中不要出现任何文字、字母或单词\n"
        f"- 干净的背景，无边框\n"
        f"- 这是共{len(story_context)}页中的第{page_index + 1}页"
    )
    return prompt


async def _async_image_generate(**kwargs) -> str:
    """异步调用 images.generate，返回 base64 data URL"""
    use_b64 = kwargs.pop("_use_b64", False)
    if use_b64:
        kwargs["response_format"] = "b64_json"

    client = _get_client()
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.images.generate(**kwargs),
    )
    if not response.data:
        raise DoubaoTechnicalError(
            "Doubao images.generate 返回空 data",
            "图片生成失败，请稍后重试",
            "NO_IMAGE_DATA",
        )

    item = response.data[0]
    if use_b64 and item.b64_json:
        return f"data:image/png;base64,{item.b64_json}"
    return item.url


# ============ 结构化输出模型 ============


class _StoryboardDetail(BaseModel):
    """分镜描述结构，与 Storyboard TypedDict 对齐"""
    scene: str
    characters: str
    shot: str
    color: str
    lighting: str


class _StoryResponse(BaseModel):
    """故事响应"""
    title: str
    content: str


class _StoryboardItem(BaseModel):
    """单页分镜"""
    text: str
    storyboard: Optional[_StoryboardDetail] = None


class _StoryboardResponse(BaseModel):
    """分镜响应"""
    pages: list[_StoryboardItem]


T = TypeVar("T", bound="BaseModel")


async def _async_chat_parse(response_format: type[T], **kwargs) -> T:
    """异步调用 beta.chat.completions.parse，返回结构化 Pydantic 模型"""
    client = _get_client()
    loop = asyncio.get_event_loop()
    completion = await loop.run_in_executor(
        None,
        lambda: client.beta.chat.completions.parse(
            response_format=response_format,
            **kwargs,
        ),
    )
    if not completion.choices:
        raise DoubaoTechnicalError(
            "Doubao structured completions 返回空 choices",
            "文本生成失败，请稍后重试",
            "NO_CHOICES",
        )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise DoubaoTechnicalError(
            "Doubao structured completions 解析结果为空",
            "分镜生成失败，请重试",
            "PARSE_ERROR",
        )
    return parsed


async def _async_chat_create(**kwargs) -> str:
    """异步调用 chat.completions.create，返回文本内容"""
    client = _get_client()
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(**kwargs),
    )
    if not response.choices:
        raise DoubaoTechnicalError(
            "Doubao chat.completions 返回空 choices",
            "文本生成失败，请稍后重试",
            "NO_CHOICES",
        )
    return response.choices[0].message.content or ""


def _parse_json_response(text: str) -> dict | list:
    """从模型响应中提取 JSON，支持 markdown 代码块包裹"""
    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试从 markdown 代码块中提取（贪婪匹配以支持嵌套 JSON 结构）
    json_match = re.search(r'```(?:json)?\s*(\[.*\]|\{.*\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试找到 JSON 数组/对象（贪婪匹配）
    for pattern in [r'\[\s*\{.*\}\s*\]', r'\{.*\}']:
        json_match = re.search(pattern, text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                continue

    raise ValueError(f"无法从响应中提取 JSON: {text[:200]}")


# ============ 文本生成的 system prompt 构建 ============

def _build_story_system_prompt(
    word_count: int = 500,
    story_type: StoryType = StoryType.FAIRY_TALE,
    language: Language = Language.ZH,
    age_group: AgeGroup = AgeGroup.AGE_3_6,
) -> str:
    """构建故事生成的 system prompt"""
    age_descriptions = {
        AgeGroup.AGE_0_3: "0-3岁幼儿，需要极简单的词汇、重复的句式、温馨的内容",
        AgeGroup.AGE_3_6: "3-6岁儿童，可以使用简单的形容词、短句，内容富想象力",
        AgeGroup.AGE_6_8: "6-8岁儿童，可以使用丰富的词汇，情节可以有趣味性",
        AgeGroup.AGE_8_12: "8-12岁儿童，可以使用复杂的词汇和情节，富有教育意义",
        AgeGroup.AGE_12_PLUS: "12岁以上，可以使用成熟的叙事，内容深刻有意义",
    }
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
    language_names = {
        Language.ZH: "中文",
        Language.EN: "英文",
        Language.JA: "日文",
        Language.KO: "韩文",
    }

    return (
        "## 角色\n"
        "你是一位绘本创作大师，擅长创作充满情绪价值和温度、能引发情感共鸣的绘本故事。\n\n"
        "## 任务\n"
        "贴合指定的读者群，创作情节线性连贯、生动有趣、充满情绪价值和温度、有情感共鸣的绘本故事。\n\n"
        "## 输出格式\n"
        "返回以下结构的 JSON 对象：\n"
        "```\n"
        "{{\n"
        '  "title": "简洁有力的故事标题",\n'
        '  "summary": "不超过30个汉字的故事总结，高度凝练核心思想与情感价值",\n'
        '  "content": "完整的故事内容，按自然段落划分"\n'
        "}}\n"
        "```\n\n"
        "## 创作要求\n"
        f"- 目标读者：{age_descriptions.get(age_group, age_descriptions[AgeGroup.AGE_3_6])}\n"
        f"- 故事类型：{type_descriptions.get(story_type, type_descriptions[StoryType.FAIRY_TALE])}\n"
        f"- 语言：{language_names.get(language, '中文')}\n"
        f"- 篇幅：约{word_count}字\n"
        "- 叙事弧线：必须遵循清晰的「开端 → 发展 → 高潮 → 结局」结构\n"
        "- 情感导向：整个故事围绕「共情」和「情绪价值」展开，让读者产生情感共鸣\n"
        "- 内容：积极向上、引人入胜、适合目标年龄段\n\n"
        "## 安全限制\n"
        "1. 禁止暴力与血腥：不得包含任何暴力、伤害、血腥或令人不适的内容\n"
        "2. 禁止色情内容：不得包含任何色情、性暗示或不适宜的裸露内容\n"
        "3. 禁止仇恨与歧视：不得包含针对任何群体的仇恨、歧视或攻击性言论\n"
        "4. 禁止违法与危险行为：不得描绘或鼓励任何非法活动、自残或危险行为\n"
        "5. 确保普遍适宜性：内容应保持在社会普遍接受的艺术创作范围内"
    )


def _build_storyboard_system_prompt(page_count: int) -> str:
    """构建分镜生成的 system prompt"""
    return (
        "## 角色\n"
        "你是一名专业的儿童绘本视觉导演，擅长将故事内容忠实拆分为逐页的视觉分镜。\n\n"
        "## 任务\n"
        f"将提供的故事内容拆分为{page_count}页，并为每一页创建视觉分镜描述。\n"
        "核心约束：分镜必须与原故事保持高度一致，情节、角色、场景严格按原文顺序推进，绝无错位。\n\n"
        "## 输出格式\n"
        "返回以下结构的 JSON 数组：\n"
        "```\n"
        "[\n"
        "  {\n"
        '    "text": "该页的故事文本（从原故事中提取或精炼，保持原文情感和语调）",\n'
        '    "storyboard": {\n'
        '      "scene": "场景环境描述，必���与原文描述的场景一致",\n'
        '      "characters": "角色动作、姿态和表情描述，必须与原文中该页的角色状态一致",\n'
        '      "shot": "镜头类型和构图",\n'
        '      "color": "色调和氛围，必须贴合原文的情感基调",\n'
        '      "lighting": "光影方向和质感"\n'
        "    }\n"
        "  }\n"
        "]\n"
        "```\n\n"
        "## 约束条件\n"
        f"- 页数：恰好{page_count}页\n"
        "- 故事一致性：分镜的情节、角色、场景必须严格对应原故事内容，不得偏离或自行发挥\n"
        "- 内容完整性：严禁缩短、精简或删减原故事内容。每页的 text 字段必须完整保留原文中该段落的所有文字，包括对话、描写和细节，只做分页不断章\n"
        "- 叙事弧线：分镜顺序必须体现「开端 → 发展 → 高潮 → 结局」的完整叙事弧线\n"
        "- 情感连贯：各页之间的情绪变化必须与原故事的情感走向一致\n"
        "- 分镜 JSON key 保持英文，但内容（描述文本）必须使用中文\n"
        "- 各页之间保持视觉连贯性\n"
        "- 'characters'字段：仅描述角色的动作、姿态和表情"
    )


def _build_insertion_system_prompt(count: int, template: Optional[Template] = None) -> str:
    """构建插入页面的 system prompt"""
    if template and template.systemprompt:
        return template.systemprompt

    return (
        "## 角色\n"
        "你是一名专业的儿童绘本作家兼视觉导演，擅长创作富有吸引力的故事画面和详细的视觉分镜。\n\n"
        "## 任务\n"
        "生成新的故事画面，这些画面将被插入到两个现有页面之间。"
        "为每个画面同时提供故事文本和分镜描述。\n\n"
        "## 输出格式\n"
        "返回以下结构的 JSON 数组：\n"
        "```\n"
        "[\n"
        "  {\n"
        '    "text": "故事叙述文本",\n'
        '    "storyboard": {\n'
        '      "scene": "场景环境描述",\n'
        '      "characters": "角色动作、姿态和表情",\n'
        '      "shot": "镜头类型和构图",\n'
        '      "color": "色调和氛围",\n'
        '      "lighting": "光影方向和质感"\n'
        "    }\n"
        "  }\n"
        "]\n"
        "```\n\n"
        f"- 数量：恰好{count}个画面\n"
        "- 分镜 JSON key 保持英文，但内容（描述文本）必须使用中文\n"
        "- 叙事流畅：新画面应自然衔接前后页面\n"
        "- 每个画面必须同时包含'text'和'storyboard'字段"
    )


# ============ DoubaoCli 主类 ============

class DoubaoCli(LLMClientBase):
    """豆包大模型客户端（基于火山方舟 Ark SDK）"""

    async def create_story(
        self,
        instruction: str,
        word_count: int = 500,
        story_type: StoryType = StoryType.FAIRY_TALE,
        language: Language = Language.ZH,
        age_group: AgeGroup = AgeGroup.AGE_3_6,
    ) -> Tuple[str, str]:
        """创建纯文本故事"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("开始生成故事 | word_count=%d story_type=%s", word_count, story_type)

        language_names = {
            Language.ZH: "中文", Language.EN: "英文",
            Language.JA: "日文", Language.KO: "韩文",
        }

        system_prompt = _build_story_system_prompt(word_count, story_type, language, age_group)
        user_prompt = (
            f"请创作一篇{language_names.get(language, '中文')}儿童故事，"
            f"基于以下要求：\"{instruction}\"\n\n"
            f"目标篇幅：约{word_count}字。\n\n"
            f"返回包含'title'和'content'字段的 JSON 对象。"
        )

        resp = await _async_chat_parse(
            response_format=_StoryResponse,
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        title = resp.title.strip()
        content = resp.content.strip()
        logger.info("故事解析成功 | title=%s content_length=%d", title, len(content))
        return title, content

    async def create_storyboard_from_story(
        self,
        story_content: str,
        page_count: int = 10,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """基于故事内容创建分镜描述"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("开始生成分镜 | page_count=%d story_length=%d", page_count, len(story_content))

        system_prompt = _build_storyboard_system_prompt(page_count)
        user_prompt = (
            f"故事内容：\n{story_content}\n\n"
            f"任务：将这个故事拆分为{page_count}页，并为每一页创建视觉分镜描述。\n"
            f"返回包含{page_count}个页面对象的 JSON，外层用 pages 字段包裹。"
        )

        resp = await _async_chat_parse(
            response_format=_StoryboardResponse,
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=20480,
            # extra_body={
            #     "thinking": {
            #         "type": "enabled"
            #     }
            # },
        )

        story_texts: List[str] = []
        storyboards: List[Optional[Storyboard]] = []
        for item in resp.pages:
            story_texts.append(item.text)
            if item.storyboard:
                storyboards.append(item.storyboard.model_dump())  # type: ignore[arg-type]
            else:
                storyboards.append(None)
        logger.info("分镜解析完成 | pages=%d", len(storyboards))
        return story_texts, storyboards

    async def create_insertion_story_and_storyboard(
        self,
        pages: List[Page],
        insert_position: int,
        count: int,
        instruction: str,
        template: Optional[Template] = None,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """创建插入页面的故事文本和分镜"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("开始生成插入页面 | insert_position=%d count=%d", insert_position, count)

        # 构建故事上下文
        full_story_context = "完整故事上下文：\n"
        for idx, page in enumerate(pages):
            marker = ""
            if idx == insert_position - 1:
                marker = " <-- 插入点之前"
            elif idx == insert_position:
                marker = " <-- 插入点之后"
            full_story_context += f"第{idx + 1}页：{page.text or ''}{marker}\n"

        before_page = pages[insert_position - 1] if insert_position > 0 and insert_position <= len(pages) else None
        after_page = pages[insert_position] if insert_position >= 0 and insert_position < len(pages) else None

        insertion_context_parts = []
        if before_page:
            insertion_context_parts.append(f"插入点前一页（第{insert_position}页）：\n{before_page.text or ''}")
        if after_page:
            insertion_context_parts.append(f"插入点后一页（第{insert_position + 1}页）：\n{after_page.text or ''}")
        insertion_context_str = "\n\n".join(insertion_context_parts) if insertion_context_parts else "无上下文页面"

        insert_instruction = instruction if instruction else "在上下文页面之间创建自然的故事衔接"

        system_prompt = _build_insertion_system_prompt(count, template)
        user_prompt = (
            f"{full_story_context}\n\n"
            f"插入点上下文：\n{insertion_context_str}\n\n"
            f"插入指令：{insert_instruction}\n\n"
            f"请生成恰好{count}个新画面，插入到位置{insert_position}。"
            f"返回包含{count}个对象的 JSON 数组，每个对象包含'text'和'storyboard'字段。"
        )

        raw_text = await _async_chat_create(
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        try:
            data = _parse_json_response(raw_text)
            if isinstance(data, list):
                story_texts = []
                storyboards: List[Optional[Storyboard]] = []
                for item in data:
                    if isinstance(item, dict):
                        story_texts.append(item.get("text", ""))
                        sb = item.get("storyboard")
                        storyboards.append(sb if isinstance(sb, dict) else None)  # type: ignore[arg-type]
                logger.info("插入页面解析完成 | count=%d", len(story_texts))
                return story_texts, storyboards
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning("JSON 解析失败: %s", e)

        raise DoubaoTechnicalError(
            "插入页面解析失败",
            "插入页面生成失败，请重试",
            "PARSE_ERROR",
        )

    async def generate_page(
        self,
        story_text: str,
        storyboard: Optional[Storyboard],
        story_context: List[str],
        page_index: int,
        reference_images: Optional[List[str]] = None,
        previous_page_image: Optional[str] = None,
        template: Optional[Template] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """生成单页图片，返回 base64 data URL"""
        logger.info("生成第 %d 页图片 | text=%s ref=%s prev=%s",
                    page_index + 1, story_text[:50],
                    len(reference_images) if reference_images else 0,
                    bool(previous_page_image))

        prompt = _build_image_prompt(story_text, storyboard, story_context, page_index, template)
        size = _resolve_image_size(aspect_ratio, image_size)

        # 收集参考图片并按顺序说明用途
        input_images: List[str] = []
        ref_desc_parts: List[str] = []
        if previous_page_image:
            input_images.append(previous_page_image)
            ref_desc_parts.append(
                "第1张图片是上一页的插画，请保持角色形象、艺术风格、色调和环境的连贯性，确保前后页视觉风格一致。"
            )
            logger.info("第 %d 页添加上一页图片作为连续性参考", page_index + 1)

        if reference_images:
            input_images.extend(reference_images)
            start = len(input_images) - len(reference_images) + 1
            end = len(input_images)
            ref_desc_parts.append(
                f"第{start}到第{end}张图片是角色参考照片，"
                "请提取人物的身份特征（面部轮廓、发型、distinguishing marks），"
                "在绘本插画的风格中还原这些角色，保持人物可辨识性。"
            )
            logger.info("第 %d 页添加用户角色参考图 | count=%d", page_index + 1, len(reference_images))

        if ref_desc_parts:
            prompt += "\n\n【参考图片说明】" + " ".join(ref_desc_parts)

        # 构建请求参数
        generate_kwargs: dict = {
            "model": settings.DOUBAO_IMAGE_MODEL,
            "prompt": prompt,
            "sequential_image_generation": "disabled",
            "size": size,
            "watermark": False,
            "_use_b64": True,
        }

        # 豆包 API 的 image 参数支持传入参考图片
        if input_images:
            generate_kwargs["image"] = input_images

        data_url = await _async_image_generate(**generate_kwargs)
        logger.info("第 %d 页图片生成成功", page_index + 1)
        return data_url

    async def edit_image(
        self,
        instruction: str,
        current_image_url: str,
        referenced_image: Optional[str] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """
        编辑图片（通过 prompt 描述原图 + 编辑指令重新生成）
        注：豆包图片生成 API 不支持直接图片编辑，通过描述实现近似效果
        """
        logger.info("edit_image | instruction=%s has_image=%s has_ref=%s",
                    instruction, bool(current_image_url), bool(referenced_image))

        prompt = (
            f"根据以下编辑指令，生成修改后的插画：{instruction}\n\n"
        )
        size = _resolve_image_size(aspect_ratio, image_size)

        # 收集参考图片并按顺序说明用途
        input_images: List[str] = []
        ref_desc_parts: List[str] = []
        if current_image_url:
            input_images.append(current_image_url)
            ref_desc_parts.append("第1张图片是原始插画，请在此基础上进行编辑修改。")
        if referenced_image:
            input_images.append(referenced_image)
            ref_desc_parts.append(f"第{len(input_images)}张图片是用户上传的参考图片。")

        if ref_desc_parts:
            prompt += "\n\n【参考图片说明】" + " ".join(ref_desc_parts)

        generate_kwargs: dict = {
            "model": settings.DOUBAO_IMAGE_MODEL,
            "prompt": prompt,
            "sequential_image_generation": "disabled",
            "size": size,
            "watermark": False,
            "_use_b64": True,
        }
        if input_images:
            generate_kwargs["image"] = input_images

        image_url = await _async_image_generate(**generate_kwargs)

        logger.info("edit_image success")
        return image_url

    async def generate_cover(
        self,
        title: str,
        cover_text: str,
        reference_images: List[str],
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """生成绘本封面图片，使用内页图作为风格参考"""
        logger.info("生成封面 | title=%s ref_count=%d", title, len(reference_images))

        prompt = (
            f"为儿童绘本创建封面插画。\n\n"
            f"书名：{title}\n"
            f"封面描述：{cover_text}\n\n"
            f"要求：\n"
            f"- 书名应以装饰性艺术字体的形式呈现\n"
            f"- 温暖、吸引人的氛围，适合儿童绘本封面\n"
            f"- 图片中除书名外不要出现其他文字或字母"
        )
        size = _resolve_image_size(aspect_ratio, image_size)

        # 构建请求参数
        generate_kwargs: dict = {
            "model": settings.DOUBAO_IMAGE_MODEL,
            "prompt": prompt,
            "sequential_image_generation": "disabled",
            "size": size,
            "watermark": False,
            "_use_b64": True,
        }

        # 使用内页图作为风格参考
        if reference_images:
            prompt += (
                f"\n\n【风格参考】已提供{len(reference_images)}张绘本内页插画作为参考图，"
                "请提取并保持相同的艺术风格、色调和角色外观，确保封面与内页风格一致。"
            )
            generate_kwargs["image"] = reference_images
            logger.info("封面添加内页参考图 | count=%d", len(reference_images))

        data_url = await _async_image_generate(**generate_kwargs)
        logger.info("封面生成成功")
        return data_url
