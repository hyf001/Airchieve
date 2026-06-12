import asyncio
import base64
import json
from typing import Any
from urllib import request as urllib_request
from uuid import uuid4

from app.core.config import settings
from app.schema.ai_provider import (
    AudioGenerationRequest,
    CharacterPortraitInput,
    ImageAspectRatio,
    ImageGenerationRequest,
    PageMediaInput,
    PictureBookStoryboardRequest,
    StoryGenerationRequest,
    StoryPromptCharacter,
    VoicePromptRef,
)
from app.service.ai_provider.errors import AiProviderError


async def doubao_generate_text(model: str, prompt: str, *, response_json: bool) -> str:
    if not settings.DOUBAO_API_KEY:
        raise AiProviderError("DOUBAO_API_KEY 未配置", error_code="DOUBAO_API_KEY_MISSING")
    if not model:
        raise AiProviderError("DOUBAO_TEXT_MODEL 未配置", error_code="DOUBAO_MODEL_MISSING")
    try:
        from volcenginesdkarkruntime import Ark
    except ImportError as exc:
        raise AiProviderError("volcenginesdkarkruntime 未安装", error_code="DOUBAO_SDK_MISSING") from exc

    def _call() -> str:
        client = Ark(base_url=settings.DOUBAO_BASE_URL, api_key=settings.DOUBAO_API_KEY)
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if response_json:
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        choices = getattr(response, "choices", None)
        if not choices:
            raise AiProviderError("豆包返回空 choices", error_code="DOUBAO_EMPTY_CHOICES")
        return choices[0].message.content or ""

    text = await asyncio.get_running_loop().run_in_executor(None, _call)
    if not text.strip():
        raise AiProviderError("豆包返回空文本", error_code="DOUBAO_EMPTY_RESPONSE")
    return text.strip()


async def doubao_draft_story_text(model: str, prompt: str) -> str:
    return await doubao_generate_text(model, prompt, response_json=False)


async def doubao_create_story_content(model: str, request: StoryGenerationRequest) -> str:
    return await doubao_generate_text(model, _build_story_prompt(request), response_json=True)


async def doubao_create_picture_book_storyboard(model: str, request: PictureBookStoryboardRequest) -> str:
    return await doubao_generate_text(model, _build_storyboard_prompt(request), response_json=True)


def _build_story_prompt(request: StoryGenerationRequest) -> str:
    supplemental_lines = [f"- 语言：{request.language}"]
    if request.age_ranges:
        supplemental_lines.append(f"- 适龄范围：{', '.join(request.age_ranges)}")
    if request.themes:
        supplemental_lines.append(f"- 主题方向：{', '.join(request.themes)}")
    if request.narrative_style:
        supplemental_lines.append(f"- 叙事风格：{request.narrative_style}")
    character_text = _story_character_text(request.characters)
    if character_text:
        supplemental_lines.append(f"- 角色列表：\n{character_text}")

    return (
        "你是一名专业儿童故事作者，请根据用户提供的灵感和补充信息，创作一篇适合生成儿童绘本的故事。\n\n"
        "输出必须是 JSON 对象，结构如下：\n"
        "{\n"
        '  "title": "故事标题，20字以内",\n'
        '  "summary": "一句话简介，80字以内",\n'
        '  "body": "完整故事正文，600到1200字，分段清晰"\n'
        "}\n\n"
        "要求：故事积极、温暖、适合儿童；情节完整，有开端、发展和结尾；语言适合朗读；"
        "必须使用补充信息里的角色列表，主角需要承担核心行动；"
        "不要包含暴力、惊吓、歧视、成人化或不适宜儿童的内容；不要输出 Markdown；不要解释生成过程。\n\n"
        f"补充信息：\n{chr(10).join(supplemental_lines)}\n\n"
        f"用户灵感：\n{request.idea_prompt.strip()}"
    )


def _build_storyboard_prompt(request: PictureBookStoryboardRequest) -> str:
    character_text = _storyboard_character_text(request.character_refs or request.characters)
    return (
        "你是一名专业儿童绘本视觉导演。请把故事严格拆分为绘本分镜页。\n\n"
        "每页完整文本、可播放脚本与画面描述必须 1:1 顺序绑定。"
        "text_zh 是本页完整文本；playback_segments 是按播放顺序排列的旁白和对白；visual_prompt 是可直接用于图片生成的画面描述。\n\n"
        "输出必须是 JSON 对象，结构如下：\n"
        "{\n"
        '  "pages": [\n'
        "    {\n"
        '      "page_no": 1,\n'
        '      "title": "页标题",\n'
        '      "text_zh": "本页中文正文",\n'
        '      "text_en": null,\n'
        '      "narration_text": "朗读文本",\n'
        '      "visual_prompt": "给插画模型的中文画面提示词",\n'
        '      "character_appearances": [{"role_code": "必须来自故事角色列表中的 role_code", "display_name": "角色展示名"}],\n'
        '      "dialogues": [{"speaker_ref": "说话角色 role_code", "text": "对白文本", "sort_order": 1}],\n'
        '      "playback_segments": [\n'
        '        {"segment_type": "narration", "text": "旁白文本", "sort_order": 0},\n'
        '        {"segment_type": "dialogue", "speaker_ref": "说话角色 role_code", "text": "对白文本", "sort_order": 1}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"要求：pages 必须恰好 {request.target_page_count} 页；page_no 从 1 连续递增；"
        "内容适合儿童绘本，积极、温暖，分镜顺序遵循原故事，不添加不适宜内容；"
        "每一页的 text_zh、playback_segments 和 visual_prompt 必须描述同一个分镜，不能错位；"
        "text_zh 是本页完整文本，必须包含本页全部旁白和对白，语言要适合朗读，避免英文引号；"
        "playback_segments 必须把 text_zh 拆成按播放顺序穿插的片段，segment_type 只能是 narration 或 dialogue；"
        "旁白片段使用 segment_type=narration 且不填 speaker_ref；对白片段使用 segment_type=dialogue 且 speaker_ref 必须来自故事角色列表；"
        "narration_text 只汇总本页旁白部分，不包含角色对白；dialogues 只列出本页对白部分，用于兼容旧结构；"
        "visual_prompt 只描述可见画面，必须包含构图、光影、色彩、角色神态、动作和环境细节，达到可直接用于图片生成的标准；"
        "visual_prompt 不要包含图片中文字、标题、标牌、对话框、边框或水印，不要堆叠抽象形容词；"
        "相邻页面必须按故事时间线推进，避免重复同一画面或同一构图；"
        "character_appearances 只列出当前页画面中实际出场的角色，role_code 必须来自故事角色列表，不要创造新 role_code。\n\n"
        f"故事角色列表：\n{character_text}\n\n"
        f"故事标题：{request.title or '专属绘本'}\n\n故事内容：\n{request.story_content}"
    )


def _story_character_text(characters: list[StoryPromptCharacter]) -> str:
    lines = []
    for character in characters:
        name = str(character.name or character.display_name or "").strip()
        if not name:
            continue
        role = "主角" if character.is_protagonist else "角色"
        role_code = f"，role_code={character.role_code}" if character.role_code else ""
        lines.append(f"  - {name}（{role}{role_code}）")
    return "\n".join(lines)


def _storyboard_character_text(characters: list[StoryPromptCharacter]) -> str:
    text = _story_character_text(characters)
    return text or "未指定"


async def doubao_generate_images(
    model: str,
    request: ImageGenerationRequest | str,
    *,
    image_urls: list[str] | None = None,
    image_count: int = 1,
    response_format: str = "b64_json",
) -> list[str]:
    if not settings.DOUBAO_API_KEY:
        raise AiProviderError("DOUBAO_API_KEY 未配置", error_code="DOUBAO_API_KEY_MISSING")
    if not model:
        raise AiProviderError("DOUBAO_IMAGE_MODEL 未配置", error_code="DOUBAO_IMAGE_MODEL_MISSING")
    try:
        from volcenginesdkarkruntime import Ark
    except ImportError as exc:
        raise AiProviderError("volcenginesdkarkruntime 未安装", error_code="DOUBAO_SDK_MISSING") from exc

    prompt = _build_doubao_image_prompt(request)
    resolved_image_urls = image_urls if isinstance(request, str) else _image_urls_from_request(request)
    resolved_image_count = image_count if isinstance(request, str) else request.image_count
    aspect_ratio = request.aspect_ratio if isinstance(request, ImageGenerationRequest) else ImageAspectRatio.LANDSCAPE_STANDARD

    def _call() -> list[str]:
        client = Ark(base_url=settings.DOUBAO_BASE_URL, api_key=settings.DOUBAO_API_KEY)
        kwargs: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "size": _doubao_image_size(aspect_ratio),
            "watermark": False,
        }
        if resolved_image_count > 1:
            kwargs["sequential_image_generation"] = "auto"
            kwargs["sequential_image_generation_options"] = {"max_images": resolved_image_count}
        else:
            kwargs["sequential_image_generation"] = "disabled"
        if resolved_image_urls:
            kwargs["image"] = resolved_image_urls[0] if len(resolved_image_urls) == 1 else resolved_image_urls
        if response_format == "b64_json":
            kwargs["response_format"] = "b64_json"
        response = client.images.generate(**kwargs)
        if not response.data:
            raise AiProviderError("豆包图片生成返回空 data", error_code="DOUBAO_EMPTY_IMAGE")
        results: list[str] = []
        if response_format == "b64_json":
            for item in response.data:
                b64_json = getattr(item, "b64_json", None)
                if b64_json:
                    results.append(f"data:image/png;base64,{b64_json}")
            if not results:
                raise AiProviderError("豆包图片生成未返回 b64_json", error_code="DOUBAO_EMPTY_IMAGE")
            return results
        for item in response.data:
            url = getattr(item, "url", None)
            if url:
                results.append(url)
        if not results:
            raise AiProviderError("豆包图片生成未返回 URL", error_code="DOUBAO_EMPTY_IMAGE")
        return results

    return await asyncio.get_running_loop().run_in_executor(None, _call)


def _doubao_image_size(aspect_ratio: ImageAspectRatio) -> str:
    return {
        ImageAspectRatio.SQUARE: "2048x2048",
        ImageAspectRatio.LANDSCAPE_STANDARD: "2304x1728",
        ImageAspectRatio.PORTRAIT_STANDARD: "1728x2304",
        ImageAspectRatio.LANDSCAPE_WIDE: "2560x1440",
        ImageAspectRatio.PORTRAIT_WIDE: "1440x2560",
    }[aspect_ratio]


async def doubao_generate_image(
    model: str,
    request: ImageGenerationRequest | str,
    *,
    image_urls: list[str] | None = None,
    response_format: str = "b64_json",
) -> str:
    images = await doubao_generate_images(
        model,
        request,
        image_urls=image_urls,
        image_count=1,
        response_format=response_format,
    )
    return images[0]


def _build_doubao_image_prompt(request: ImageGenerationRequest | str) -> str:
    if isinstance(request, str):
        return request
    if request.kind == "picture_book_pages":
        return _build_picture_book_images_prompt(request.pages)
    if request.kind == "picture_book_single_page" and request.pages:
        return _build_picture_book_single_page_image_prompt(request.pages[0])
    if request.kind == "character_portrait" and request.character:
        return _build_character_image_prompt(request.character)
    raise AiProviderError(f"不支持的豆包图片生成请求类型: {request.kind}", error_code="DOUBAO_IMAGE_REQUEST_UNSUPPORTED")


def _image_urls_from_request(request: ImageGenerationRequest) -> list[str]:
    if request.kind == "character_portrait" and request.character and request.character.reference_image_url:
        return [request.character.reference_image_url]
    return [*_all_character_image_urls(request.pages), *_continuity_image_urls(request.pages)]


def _build_picture_book_images_prompt(pages: list[PageMediaInput]) -> str:
    sections = [
        "你是一名专业儿童绘本插画师。",
        f"请生成一组共 {len(pages)} 张儿童绘本内页插画，按下面页面顺序输出。",
        "每张输出图片必须一一对应一个页面，不要合并页面，不要生成封面或额外图片。",
        "每页都用简洁连贯的自然语言理解画面：主体、动作、环境要清晰，风格、色彩、光影和构图保持统一。",
    ]
    art_style_text = _art_style_text_for_pages(pages)
    if art_style_text:
        sections.append(f"全书统一画风、色彩与质感：{art_style_text}")
    sections.append(_picture_book_global_requirements())
    all_characters = _all_character_labels(pages)
    if all_characters:
        sections.append(f"全书角色设定图：{_character_reference_text(all_characters)}")
    continuity_count = len(_continuity_image_urls(pages))
    if continuity_count:
        sections.append(
            f"输入图片顺序：先是全书角色设定图，顺序对应上面的角色列表；再是 {continuity_count} 张前序页面图片，按上一页到上两页的顺序。角色设定图用于锁定该角色已经转换成指定画风后的形象；前序页面图片只用于保持故事、场景、色彩、画风和构图连贯。"
        )
    elif all_characters:
        sections.append("输入图片顺序：全书角色设定图，顺序对应上面的角色列表。角色设定图用于锁定该角色已经转换成指定画风后的形象。")
    for index, page in enumerate(pages):
        sections.append(_build_picture_book_image_prompt(page, page_index=index, page_count=len(pages)))
    return "\n\n".join(sections)


def _build_picture_book_single_page_image_prompt(page: PageMediaInput) -> str:
    sections = [
        "你是一名专业儿童绘本插画师。",
        "请只生成 1 张儿童绘本内页插画，对应下面指定页面。",
        "主体、动作、环境要清晰，风格、色彩、光影和构图与绘本整体一致。",
    ]
    if page.art_style_prompt:
        sections.append(f"画风、色彩与质感：{page.art_style_prompt}")
    sections.append(_picture_book_global_requirements())
    all_characters = _all_character_labels([page])
    if all_characters:
        sections.append(f"全书角色设定图：{_character_reference_text(all_characters)}")
    continuity_count = len(_continuity_image_urls([page]))
    if continuity_count:
        sections.append(
            f"输入图片顺序：先是全书角色设定图，顺序对应上面的角色列表；再是 {continuity_count} 张前序页面图片，按上一页到上两页的顺序。角色设定图用于锁定该角色已经转换成指定画风后的形象；前序页面图片只用于保持故事、场景、色彩、画风和构图连贯。"
        )
    elif all_characters:
        sections.append("输入图片顺序：全书角色设定图，顺序对应上面的角色列表。角色设定图用于锁定该角色已经转换成指定画风后的形象。")
    sections.append(_build_picture_book_image_prompt(page, page_index=0, page_count=1))
    sections.append("单页重生成要求：只重画当前页面，不改变故事节奏，不补画其它页面。")
    return "\n\n".join(sections)


def _build_picture_book_image_prompt(page: PageMediaInput, *, page_index: int, page_count: int) -> str:
    page_label = page.page_no or page_index + 1
    sections = [f"页面 {page_label}：生成第 {page_index + 1} 张 / 本次共 {page_count} 张的绘本内页插画。"]
    if page.title:
        sections.append(f"页面标题：{page.title}")
    if page.visual_prompt:
        sections.append(f"画面：{page.visual_prompt}")
    characters = [
        item.model_dump(mode="json", exclude_none=True, exclude={"image_url"})
        for item in page.character_appearances
        if item.image_url
    ]
    if characters:
        sections.append(f"本页出场角色：{_character_list_text(characters)}")
    dialogue_text = "；".join(item.text for item in page.dialogues if item.text)
    if dialogue_text:
        sections.append(f"角色对白仅用于理解动作和情绪，不要把这些文字画进图片：{dialogue_text}")
    return "\n\n".join(sections)


def _art_style_text_for_pages(pages: list[PageMediaInput]) -> str:
    styles = []
    seen: set[str] = set()
    for page in pages:
        style = str(page.art_style_prompt or "").strip()
        if style and style not in seen:
            styles.append(style)
            seen.add(style)
    return "；".join(styles)


def _picture_book_global_requirements() -> str:
    return (
        "全局要求：\n"
        "- 画面温暖、有童趣、适合儿童阅读。\n"
        "- 主体、动作、环境明确，构图完整，主体清晰，避免空泛或过度装饰。\n"
        "- 保持绘本插画质感，同一本书内色彩、光影、线条和镜头语言统一。\n"
        "- 角色动作、姿态、表情和视角可以根据当前页面剧情变化；但角色的画风、长相五官、发型发色、服装配饰、体型比例和标志性特征必须与角色设定图保持一致。\n"
        "- 图片中不要出现任何文字、字母、标题、标签、边框或水印。\n"
        "- 每张图只画对应页面，不要把其它页内容画进来。"
    )


def _build_character_image_prompt(character: CharacterPortraitInput) -> str:
    reference_section = ""
    if character.reference_image_url:
        if character.art_style_prompt:
            reference_section = (
                "随请求输入的图片是角色参考图。只保留参考图中的角色身份、主要五官、发型、服装和标志性特征；"
                "不要沿用参考图背景或参考图画风，整体画风必须迁移到下面的画风要求。\n"
            )
        else:
            reference_section = (
                "随请求输入的图片是角色参考图。请保持角色身份、主要五官、发型、服装特征和整体画风；不要复制背景或水印。\n"
            )
    parts = [
        f"角色名称：{character.name}",
        f"角色描述：{character.description}" if character.description else None,
        f"生成要求：{character.generation_prompt}" if character.generation_prompt else None,
        f"目标画风：{character.art_style_prompt}" if character.art_style_prompt else None,
        f"分类：{character.category_code}" if character.category_code else None,
    ]
    return (
        "你是一名专业儿童绘本角色设计师。\n\n"
        "请生成一张单个角色形象图，用于儿童绘本角色库。\n\n"
        f"角色需求：\n{chr(10).join(part for part in parts if part)}\n\n"
        f"{reference_section}"
        "要求：\n"
        "- 用简洁连贯的自然语言理解角色需求，明确角色主体、姿态、服装/外观、表情和画面环境。\n"
        "- 角色主体清晰，适合在多页绘本中复用。\n"
        "- 儿童友好、温暖、有亲和力。\n"
        "- 保持完整身体或半身形象，避免复杂背景。\n"
        "- 图片中不要出现任何文字、字母、标题、标签、边框或水印。\n"
        "- 不要生成多个不同角色。"
    )


def _all_character_image_urls(pages: list[PageMediaInput]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for page in pages:
        for appearance in page.all_character_refs:
            url = _optional_public_image_url(appearance.image_url)
            if url and url not in seen:
                urls.append(url)
                seen.add(url)
    return urls


def _continuity_image_urls(pages: list[PageMediaInput]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for page in pages:
        for raw_url in page.continuity_image_urls:
            url = _optional_public_image_url(raw_url)
            if url and url not in seen:
                urls.append(url)
                seen.add(url)
    return urls


def _optional_public_image_url(value: object) -> str | None:
    url = str(value or "").strip()
    if url.startswith(("http://", "https://", "data:image/")):
        return url
    return None


def _all_character_labels(pages: list[PageMediaInput]) -> list[dict]:
    labels: list[dict] = []
    seen: set[str] = set()
    for page in pages:
        for character in page.all_character_refs:
            if character.role_code in seen or not character.image_url:
                continue
            labels.append(character.model_dump(mode="json", exclude_none=True, exclude={"image_url"}))
            seen.add(character.role_code)
    return labels


def _character_reference_text(characters: list[dict]) -> str:
    labels = []
    for index, character in enumerate(characters, start=1):
        role_code = str(character.get("role_code") or "").strip()
        display_name = str(character.get("display_name") or "").strip()
        name = display_name or role_code or f"角色{index}"
        code_text = f"（role_code: {role_code}）" if role_code and role_code != name else ""
        labels.append(f"图{index}是{name}{code_text}")
    return "；".join(labels) + "。"


def _character_list_text(characters: list[dict]) -> str:
    labels = []
    for character in characters:
        role_code = str(character.get("role_code") or "").strip()
        display_name = str(character.get("display_name") or "").strip()
        name = display_name or role_code
        if not name:
            continue
        code_text = f"（role_code: {role_code}）" if role_code and role_code != name else ""
        labels.append(f"{name}{code_text}")
    return "；".join(labels) + "。"


async def doubao_generate_audio(request: AudioGenerationRequest | str, *, voice_type: str | None = None) -> str:
    missing = [
        key
        for key, value in {
            "DOUBAO_TTS_APP_ID": settings.DOUBAO_TTS_APP_ID,
            "DOUBAO_TTS_ACCESS_TOKEN": settings.DOUBAO_TTS_ACCESS_TOKEN,
            "DOUBAO_TTS_CLUSTER": settings.DOUBAO_TTS_CLUSTER,
        }.items()
        if not value
    ]
    if missing:
        raise AiProviderError(f"豆包 TTS 配置缺失：{', '.join(missing)}", error_code="DOUBAO_TTS_CONFIG_MISSING")
    text = request.text if isinstance(request, AudioGenerationRequest) else request
    resolved_voice_type = _voice_name_from_ref(request.voice_ref) if isinstance(request, AudioGenerationRequest) else voice_type
    resolved_voice_type = resolved_voice_type or settings.DOUBAO_TTS_VOICE_TYPE
    if not resolved_voice_type:
        raise AiProviderError("DOUBAO_TTS_VOICE_TYPE 未配置", error_code="DOUBAO_TTS_VOICE_MISSING")

    body = {
        "app": {
            "appid": settings.DOUBAO_TTS_APP_ID,
            "token": settings.DOUBAO_TTS_ACCESS_TOKEN,
            "cluster": settings.DOUBAO_TTS_CLUSTER,
        },
        "user": {"uid": "airchieve"},
        "audio": {
            "voice_type": resolved_voice_type,
            "encoding": "wav",
        },
        "request": {
            "reqid": uuid4().hex,
            "text": text,
            "operation": "query",
        },
    }

    def _call() -> str:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib_request.Request(
            settings.DOUBAO_TTS_API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer;{settings.DOUBAO_TTS_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib_request.urlopen(request, timeout=60) as response:
            response_body = response.read()
        data = json.loads(response_body.decode("utf-8"))
        if data.get("code") not in {0, "0", None}:
            raise AiProviderError(
                str(data.get("message") or data.get("Message") or "豆包 TTS 生成失败"),
                error_code=f"DOUBAO_TTS_{data.get('code')}",
            )
        audio_base64 = data.get("data")
        if not audio_base64:
            raise AiProviderError("豆包 TTS 返回空音频", error_code="DOUBAO_TTS_EMPTY_AUDIO")
        # Validate that the service returned decodable base64 before exposing the data URL.
        base64.b64decode(audio_base64)
        return f"data:audio/wav;base64,{audio_base64}"

    return await asyncio.get_running_loop().run_in_executor(None, _call)


def _voice_name_from_ref(voice_ref: VoicePromptRef | None) -> str | None:
    if not voice_ref:
        return None
    value = voice_ref.voice_type or voice_ref.provider_voice_id or voice_ref.voice_name
    return str(value) if value else None
