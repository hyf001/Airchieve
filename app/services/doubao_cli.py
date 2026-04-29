"""
Doubao CLI Implementation
豆包大模型客户端实现（基于火山方舟 Ark SDK）
"""
import asyncio
import json
import re
from typing import List, Optional, Tuple, TypeVar

from pydantic import BaseModel, Field

from volcenginesdkarkruntime import Ark

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.services.llm_cli import LLMClientBase, LLMError
from app.models.page import Storyboard, Page
from app.models.template import Template
from app.models.image_style import ImageStyleVersion
from app.models.enums import PageType, StoryType, Language, AgeGroup
from app.schemas.visual_anchor import VisualAnchor
from app.services.visual_anchor_service import (
    clean_storyboards_anchor_refs,
    format_anchors_for_prompt,
    normalize_storyboard,
    normalize_visual_anchors,
)

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
    image_style_version: Optional[ImageStyleVersion] = None,
    visual_anchors: Optional[List[VisualAnchor]] = None,
) -> str:
    """构建图片生成的 prompt"""
    visual_summary = story_text
    if storyboard and storyboard.get("summary"):
        visual_summary = storyboard.get("summary") or story_text

    if storyboard:
        must_include = "、".join(storyboard.get("must_include") or [])
        avoid = "、".join(storyboard.get("avoid") or [])
        storyboard_desc = (
            f"【当前页视觉摘要】\n{visual_summary}\n\n"
            f"【当前页分镜】\n"
            f"- 画面目标：{storyboard.get('visual_brief', '')}\n"
            f"- 必须出现：{must_include}\n"
            f"- 构图：{storyboard.get('composition', '')}\n"
            f"- 避免出现：{avoid}"
        )
    else:
        storyboard_desc = f"【当前页视觉摘要】\n{visual_summary}\n\n【当前页分镜】\n- 画面目标：\n- 必须出现：\n- 构图：\n- 避免出现："

    style_prompt = _format_style_prompt(template, image_style_version)
    anchor_prompt = format_anchors_for_prompt(visual_anchors or [], language="zh")

    prompt = (
        "你是一名专业儿童绘本插画师。\n\n"
        "先保证跨页连续性和角色参考图的可辨识度，再自然融入本页分镜、视觉锚点和画风参考。\n"
        "如果提供了上一页图片，请沿用已经建立的角色外观、关键物、画风、色彩和场景气质；只有用户明确要求时才改变。\n\n"
        f"【当前任务】\n为第{page_index + 1}页 / 共{len(story_context)}页生成一张儿童绘本内页插画。\n\n"
        f"{storyboard_desc}\n\n"
        f"【当前页视觉锚点】\n{anchor_prompt}\n\n"
        "【锚点边界规则】\n"
        "- 锚点只是少量重复角色或关键物的轻量连续性提示。\n"
        "- 如果锚点和上一页图片冲突，以上一页图片为准。\n"
        "- 如果锚点和角色参考图冲突，以角色参考图为准。\n"
        "- 颜色锚点只做粗粒度提示，最终颜色以已生成图片连续性为准。\n"
        "- 不要把锚点扩展成额外剧情、额外物品或硬性构图要求。\n\n"
        f"【画风参考】\n{style_prompt}\n\n"
        "【禁止】\n"
        "- 图片中不要出现任何文字、字母、标题、标签、边框。\n"
        "- 只画当前页，不要把其他页面的内容画进来。\n"
        "- 角色参考图片只用于保持角色身份、外观特征和可辨识性，不要从中学习画风、色调、背景复杂度或构图。"
    )
    return prompt


def _format_style_prompt(
    template: Optional[Template] = None,
    image_style_version: Optional[ImageStyleVersion] = None,
) -> str:
    """将画风配置压成更自然的绘画指令，避免字段堆叠。"""
    cues = []
    if template and template.name:
        template_text = template.name
        if template.description:
            template_text += f"：{template.description}"
        cues.append(template_text)
    if image_style_version:
        if image_style_version.generation_prompt:
            cues.append(image_style_version.generation_prompt)

    style_text = "；".join(cue.strip() for cue in cues if cue and cue.strip())
    if not style_text:
        style_text = "使用温暖、有童趣、适合儿童绘本的插画风格。"

    prompt = (
        f"{style_text}\n"
        "把这些画风信息当作整体氛围、媒介质感、线条、色彩和细节密度的参考，自然服务于当前页画面；不要机械照抄参考图的具体人物、构图或场景。"
    )
    if image_style_version and image_style_version.negative_prompt:
        prompt += f"\n尽量避免：{image_style_version.negative_prompt}"
    return prompt


def _style_reference_urls(image_style_version: Optional[ImageStyleVersion]) -> List[str]:
    if not image_style_version:
        return []
    return [
        image.url
        for image in image_style_version.reference_images
        if image.url
    ]


def _style_main_reference_url(image_style_version: Optional[ImageStyleVersion]) -> Optional[str]:
    """返回单张风格主图：优先 is_cover，其次排序后的第一张。"""
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
    summary: str
    visual_brief: str = ""
    anchor_refs: list[str] = Field(default_factory=list)
    must_include: list[str] = Field(default_factory=list)
    composition: str = ""
    avoid: list[str] = Field(default_factory=list)


class _VisualAnchorItem(BaseModel):
    id: str
    type: str
    name: str
    description: str = ""
    key_attributes: list[str] = Field(default_factory=list)


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
    anchors: list[_VisualAnchorItem] = Field(default_factory=list)
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


def _build_storyboard_system_prompt(
    page_count: int,
    style_name: Optional[str] = None,
    style_reference_image_count: int = 0,
    has_character_reference_images: bool = False,
) -> str:
    """构建分镜生成的 system prompt"""
    prompt = (
        "## 角色\n"
        "你是一名专业的儿童绘本视觉导演，擅长将故事内容忠实拆分为逐页的视觉分镜。\n\n"
        "## 任务\n"
        f"将提供的故事内容拆分为{page_count}页，并为每一页创建视觉分镜描述。\n"
        "核心约束：分镜必须与原故事保持高度一致，情节、角色、场景严格按原文顺序推进，绝无错位。\n\n"
        "## 输出格式\n"
        "返回以下结构的 JSON 对象：\n"
        "```\n"
        "{\n"
        '  "anchors": [\n'
        '    {"id": "bear_01", "type": "character", "name": "小熊", "description": "短视觉设定", "key_attributes": ["粗粒度颜色或形状"]}\n'
        "  ],\n"
        '  "pages": [\n'
        "    {\n"
        '      "text": "该页的故事文本（从原故事中提取或精炼，保持原文情感和语调）",\n'
        '      "storyboard": {\n'
        '        "summary": "给图片生成使用的一句话视觉摘要",\n'
        '        "visual_brief": "自然语言画面目标",\n'
        '        "anchor_refs": ["bear_01"],\n'
        '        "must_include": ["少量必须出现的元素"],\n'
        '        "composition": "轻量构图要求",\n'
        '        "avoid": ["禁止出现的内容"]\n'
        "      }\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "```\n\n"
        "## 约束条件\n"
        f"- 页数：恰好{page_count}页\n"
        "- 故事一致性：分镜的情节、角色、场景必须严格对应原故事内容，不得偏离或自行发挥\n"
        "- 内容完整性：严禁缩短、精简或删减原故事内容。每页的 text 字段必须完整保留原文中该段落的所有文字，包括对话、描写和细节，只做分页不断章\n"
        "- 叙事弧线：分镜顺序必须体现「开端 → 发展 → 高潮 → 结局」的完整叙事弧线\n"
        "- 情感连贯：各页之间的情绪变化必须与原故事的情感走向一致\n"
        "- 分镜 JSON key 保持英文，但内容（描述文本）必须使用中文\n"
        "- summary 字段：一句话说明当前页要画什么，只保留可视化信息（角色、动作、关键物、场景、情绪），30-60字；不写心理活动、旁白解释、抽象主题或长对话\n"
        "- 各页之间保持视觉连贯性\n"
        "- 不要输出 scene、characters、shot、color、lighting 字段\n"
        "- 锚点只是轻量连续性提示，不是强视觉真相\n"
        "- 锚点类型只允许 character 或 object，禁止 scene 锚点\n"
        f"- has_character_reference_images={str(has_character_reference_images).lower()}；如果为 true，禁止生成 character 锚点\n"
        "- 没有角色参考图时，character 锚点最多 3 个\n"
        "- object 锚点最多 5 个，只保留多页出现或剧情关键物\n"
        "- 每页 anchor_refs 最多 3 个，且必须引用 anchors 中已存在的 id\n"
        "- 颜色只做粗粒度提示，不写精确色值或复杂色彩修饰"
    )
    if style_name or style_reference_image_count:
        prompt += (
            "\n\n## 画风弱参考\n"
            "画风参考图只用于影响分镜的画面密度、媒介质感和场景复杂度，不得改变故事内容、人物关系或事件顺序。\n"
            f"- 画风名称：{style_name or ''}\n"
            f"- 画风参考图数量：{style_reference_image_count}"
        )
    return prompt


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
        '      "summary": "给图片生成使用的一句话视觉摘要",\n'
        '      "visual_brief": "自然语言画面目标",\n'
        '      "anchor_refs": [],\n'
        '      "must_include": ["少量必须出现的元素"],\n'
        '      "composition": "轻量构图要求",\n'
        '      "avoid": ["禁止出现的内容"]\n'
        "    }\n"
        "  }\n"
        "]\n"
        "```\n\n"
        f"- 数量：恰好{count}个画面\n"
        "- 分镜 JSON key 保持英文，但内容（描述文本）必须使用中文\n"
        "- summary 字段：一句话说明当前页要画什么，只保留可视化信息，30-60字，不写心理活动、旁白解释、抽象主题或长对话\n"
        "- 不要输出 scene、characters、shot、color、lighting 字段\n"
        "- 未明确提供整本锚点表时，anchor_refs 保持空数组\n"
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
        style_name: Optional[str] = None,
        style_reference_images: Optional[List[str]] = None,
        has_character_reference_images: bool = False,
    ) -> Tuple[List[str], List[Optional[Storyboard]], List[VisualAnchor]]:
        """基于故事内容创建分镜描述"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("开始生成分镜 | page_count=%d story_length=%d", page_count, len(story_content))

        system_prompt = _build_storyboard_system_prompt(
            page_count,
            style_name=style_name,
            style_reference_image_count=len(style_reference_images or []),
            has_character_reference_images=has_character_reference_images,
        )
        user_prompt = (
            f"故事内容：\n{story_content}\n\n"
            f"任务：将这个故事拆分为{page_count}页，并为每一页创建视觉分镜描述和轻量视觉锚点。\n"
            f"返回包含 anchors 和 pages 的 JSON 对象，其中 pages 恰好 {page_count} 个页面对象。"
        )
        user_content: object = user_prompt
        if style_reference_images:
            user_content = [
                {"type": "text", "text": (
                    f"{user_prompt}\n\n"
                    f"下面提供 {len(style_reference_images)} 张画风参考图。只用它们判断分镜画面密度、媒介质感、色彩气质和背景复杂度；"
                    "不要复制图中的具体人物、场景、构图、文字或物体。"
                )},
                *[
                    {"type": "image_url", "image_url": {"url": image_url}}
                    for image_url in style_reference_images
                ],
            ]

        resp = await _async_chat_parse(
            response_format=_StoryboardResponse,
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
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
                storyboards.append(normalize_storyboard(item.storyboard.model_dump(), item.text))  # type: ignore[arg-type]
            else:
                storyboards.append(None)
        visual_anchors = normalize_visual_anchors(
            [anchor.model_dump() for anchor in resp.anchors],
            has_character_reference_images=has_character_reference_images,
        )
        storyboards = clean_storyboards_anchor_refs(storyboards, visual_anchors)
        logger.info("分镜解析完成 | pages=%d anchors=%d", len(storyboards), len(visual_anchors))
        return story_texts, storyboards, visual_anchors

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
                        storyboards.append(normalize_storyboard(sb, item.get("text", "")))  # type: ignore[arg-type]
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
        character_reference_images: Optional[List[str]] = None,
        previous_page_image: Optional[str] = None,
        template: Optional[Template] = None,
        image_style_version: Optional[ImageStyleVersion] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
        image_instruction: str = "",
        visual_anchors: Optional[List[VisualAnchor]] = None,
    ) -> str:
        """生成单页图片，返回 base64 data URL"""
        logger.info("生成第 %d 页图片 | text=%s ref=%s prev=%s",
                    page_index + 1, story_text[:50],
                    len(character_reference_images) if character_reference_images else 0,
                    bool(previous_page_image))
        visual_summary = (storyboard.get("summary") or story_text) if storyboard else story_text
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
            len(character_reference_images) if character_reference_images else 0,
            bool(previous_page_image),
        )

        prompt = _build_image_prompt(
            story_text,
            storyboard,
            story_context,
            page_index,
            template,
            image_style_version,
            visual_anchors,
        )
        if image_instruction:
            prompt += (
                f"\n\n【用户图片调整指令】{image_instruction}\n"
                "请在保持跨页视觉连续性、锁定画风、当前页视觉摘要和分镜的前提下执行该调整。"
            )
        size = _resolve_image_size(aspect_ratio, image_size)

        # 收集参考图片并按顺序说明用途
        input_images: List[str] = []
        ref_desc_parts: List[str] = []
        if first_page_style_main_reference:
            input_images.append(first_page_style_main_reference)
            ref_desc_parts.append(
                "第1张图片是风格主图片，仅第一页生成时提供。请学习它的媒介质感、笔触、线条、色彩关系、背景细节密度和儿童绘本整体气质；不要复制其中的具体人物、场景、构图、文字或物体。"
            )
            logger.info("第 %d 页添加风格主图片 | count=1", page_index + 1)

        if previous_page_image:
            input_images.append(previous_page_image)
            index = len(input_images)
            ref_desc_parts.append(
                f"第{index}张图片是上一页插画，也是最高优先级连续性参考。请保持已建立的角色外观、服装配饰、比例气质、关键物外观、场景延续、画风、色彩体系、材质和线条一致。除非用户明确要求改变，否则不要改变已经建立的视觉身份。"
            )
            logger.info("第 %d 页添加上一页图片作为最高优先级连续性参考", page_index + 1)

        if character_reference_images:
            input_images.extend(character_reference_images)
            start = len(input_images) - len(character_reference_images) + 1
            end = len(input_images)
            ref_desc_parts.append(
                f"第{start}到第{end}张图片是角色参考图片。"
                "角色不一定是人，也可以是动物、玩偶或拟人化物体。"
                "它们只用于保持角色身份、外观特征、姿态特征和可辨识性；不要从角色参考图片中学习画风、色调、背景复杂度或构图。"
            )
            logger.info("第 %d 页添加用户角色参考图 | count=%d", page_index + 1, len(character_reference_images))

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
        image_instruction: str = "",
        image_style_version: Optional[ImageStyleVersion] = None,
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
        if image_style_version:
            prompt += f"\n\n画风参考：\n{_format_style_prompt(image_style_version=image_style_version)}"
        if image_instruction:
            prompt += (
                f"\n\n【用户封面调整指令】{image_instruction}\n"
                "请在保持封面与内页风格一致的前提下执行该调整。"
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
        input_images: List[str] = []
        if reference_images:
            prompt += (
                f"\n\n【风格参考】已提供{len(reference_images)}张绘本内页插画作为参考图，"
                "请提取并保持相同的艺术风格、色调和角色外观，确保封面与内页风格一致。"
            )
            input_images.extend(reference_images)
            logger.info("封面添加内页参考图 | count=%d", len(reference_images))

        style_reference_images = _style_reference_urls(image_style_version)
        if style_reference_images:
            prompt += (
                f"\n\n【画风参考图】已提供{len(style_reference_images)}张画风参考图，"
                "请参考整体媒介质感、色彩、线条和氛围，不复制具体人物、文字、构图或场景。"
            )
            input_images.extend(style_reference_images)
            logger.info("封面添加画风参考图 | count=%d", len(style_reference_images))

        if input_images:
            generate_kwargs["prompt"] = prompt
            generate_kwargs["image"] = input_images

        data_url = await _async_image_generate(**generate_kwargs)
        logger.info("封面生成成功")
        return data_url

    async def regenerate_page_text(
        self,
        current_text: str,
        story_context: List[str],
        page_index: int,
        instruction: str = "",
    ) -> str:
        """重新生成单页故事文本"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("重新生成第 %d 页文本 | instruction=%s", page_index + 1, instruction[:50])

        full_context = "完整故事上下文：\n"
        for idx, text in enumerate(story_context, 1):
            marker = " <-- 当前页" if idx == page_index + 1 else ""
            full_context += f"第{idx}页：{text}{marker}\n"

        system_prompt = (
            "你是一名专业的儿童绘本作家。你的任务是根据用户指令重新撰写指定页的故事文本。\n"
            "要求：\n"
            "- 保持与前后文的叙事连贯性\n"
            "- 保持相同的语言风格和难度\n"
            "- 如果用户提供了调整指令，按照指令方向修改\n"
            "- 只输出该页的新文本，不要输出其他内容"
        )

        user_prompt = f"{full_context}\n\n当前页（第{page_index + 1}页）原文：{current_text}\n\n请重新撰写这一页的故事文本。\n"
        if instruction:
            user_prompt += f"用户调整指令：{instruction}\n"
        else:
            user_prompt += "请基于上下文重新撰写该页文本，保持叙事连贯。\n"

        result = await _async_chat_create(
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        new_text = result.strip()
        if new_text:
            logger.info("第 %d 页文本重新生成完成 | length=%d", page_index + 1, len(new_text))
            return new_text

        raise DoubaoTechnicalError(
            "重新生成页面文本失败",
            "文本生成失败，请重试",
            "NO_TEXT_RETURNED",
        )

    async def regenerate_page_storyboard(
        self,
        page_text: str,
        story_context: List[str],
        page_index: int,
        instruction: str = "",
    ) -> Optional[Storyboard]:
        """重新生成单页分镜"""
        if not settings.DOUBAO_TEXT_MODEL:
            raise DoubaoTechnicalError(
                "DOUBAO_TEXT_MODEL 未配置",
                "豆包文本模型未配置，请联系管理员",
                "TEXT_MODEL_NOT_CONFIGURED",
            )

        logger.info("重新生成第 %d 页分镜 | instruction=%s", page_index + 1, instruction[:50])

        full_context = "完整故事上下文：\n"
        for idx, text in enumerate(story_context, 1):
            full_context += f"第{idx}页：{text}\n"

        system_prompt = (
            "你是一名专业的儿童绘本视觉导演。你的任务是为指定页创建视觉分镜描述。\n\n"
            "返回以下 JSON 结构：\n"
            "```\n"
            "{\n"
            '  "summary": "给图片生成使用的一句话视觉摘要",\n'
            '  "visual_brief": "自然语言画面目标",\n'
            '  "anchor_refs": [],\n'
            '  "must_include": ["少量必须出现的元素"],\n'
            '  "composition": "轻量构图要求",\n'
            '  "avoid": ["禁止出现的内容"]\n'
            "}\n"
            "```\n\n"
            "约束：\n"
            "- 分镜字段必须使用中文\n"
            "- summary 字段：一句话说明当前页要画什么，只保留可视化信息（角色、动作、关键物、场景、情绪），30-60字；不写心理活动、旁白解释、抽象主题或长对话\n"
            "- 不要输出 scene、characters、shot、color、lighting 字段\n"
            "- 未提供整本锚点表时，anchor_refs 保持空数组\n"
            "- 与前后页保持视觉连贯性"
        )

        user_prompt = f"{full_context}\n\n当前页（第{page_index + 1}页）文本：{page_text}\n\n请为这一页创建视觉分镜描述。\n"
        if instruction:
            user_prompt += f"用户调整指令：{instruction}\n"
        user_prompt += "\n返回 JSON 对象，字段只能包含 summary、visual_brief、anchor_refs、must_include、composition、avoid。"

        raw_text = await _async_chat_create(
            model=settings.DOUBAO_TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        try:
            data = _parse_json_response(raw_text)
            normalized = normalize_storyboard(data, page_text)
            if normalized and normalized.get("summary"):
                logger.info("第 %d 页分镜重新生成完成", page_index + 1)
                return normalized  # type: ignore[return-value]
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning("分镜 JSON 解析失败: %s", e)

        raise DoubaoTechnicalError(
            "重新生成分镜失败",
            "分镜生成失败，请重试",
            "NO_STORYBOARD_RETURNED",
        )
