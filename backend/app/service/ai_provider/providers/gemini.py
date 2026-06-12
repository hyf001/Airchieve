import asyncio
import base64
from io import BytesIO
from typing import Any
from urllib import request as urllib_request
import wave

from pydantic import BaseModel

from app.core.config import settings
from app.schema.ai_provider import (
    AudioGenerationRequest,
    CharacterPortraitInput,
    GeneratedStoryContent,
    ImageAspectRatio,
    ImageGenerationRequest,
    PageCharacterImageRef,
    PageMediaInput,
    PictureBookStoryboard,
    PictureBookStoryboardRequest,
    StoryGenerationRequest,
    StoryPromptCharacter,
    VoicePromptRef,
)
from app.service.ai_provider.errors import AiProviderError


async def gemini_generate_text(
    model: str,
    prompt: str,
    *,
    response_json: bool,
    response_schema: type[BaseModel] | None = None,
) -> str | BaseModel:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    client = _gemini_client(genai, types)
    config = _text_generation_config(types, response_json=response_json, response_schema=response_schema)
    response = await client.aio.models.generate_content(
        model=model,
        contents=types.Content(parts=[types.Part(text=prompt)]),
        config=config,
    )
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, BaseModel):
        return parsed
    if parsed is not None:
        return str(parsed)
    text = getattr(response, "text", None)
    if text:
        return text.strip()
    if response.candidates and response.candidates[0].content:
        parts = response.candidates[0].content.parts or []
        for part in parts:
            if part.text:
                return part.text.strip()
    raise AiProviderError("Gemini 返回空文本", error_code="GEMINI_EMPTY_RESPONSE")


async def gemini_draft_story_text(model: str, prompt: str) -> str:
    response = await gemini_generate_text(model, prompt, response_json=False)
    return str(response).strip()


async def gemini_create_story_content(model: str, request: StoryGenerationRequest) -> GeneratedStoryContent | str:
    response = await gemini_generate_text(
        model,
        _build_story_prompt(request),
        response_json=True,
        response_schema=GeneratedStoryContent,
    )
    if isinstance(response, GeneratedStoryContent) or isinstance(response, str):
        return response
    raise AiProviderError("Gemini 故事响应结构不符合约定", error_code="GEMINI_STORY_SCHEMA_ERROR")


async def gemini_create_picture_book_storyboard(model: str, request: PictureBookStoryboardRequest) -> PictureBookStoryboard | str:
    response = await gemini_generate_text(
        model,
        _build_storyboard_prompt(request),
        response_json=True,
        response_schema=PictureBookStoryboard,
    )
    if isinstance(response, PictureBookStoryboard) or isinstance(response, str):
        return response
    raise AiProviderError("Gemini 分镜响应结构不符合约定", error_code="GEMINI_STORYBOARD_SCHEMA_ERROR")


def _gemini_client(genai: Any, types: Any) -> Any:
    if settings.GEMINI_API_URL:
        return genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(base_url=settings.GEMINI_API_URL),
        )
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _text_generation_config(
    types: Any,
    *,
    response_json: bool,
    response_schema: type[BaseModel] | None,
) -> Any:
    if response_schema is not None:
        return types.GenerateContentConfig(
            response_modalities=["TEXT"],
            response_mime_type="application/json",
            response_schema=response_schema,
        )
    if response_json:
        return types.GenerateContentConfig(
            response_modalities=["TEXT"],
            response_mime_type="application/json",
        )
    return types.GenerateContentConfig(response_modalities=["TEXT"])


def _build_story_prompt(request: StoryGenerationRequest) -> str:
    supplemental_lines = [f"- Language: {request.language}"]
    if request.age_ranges:
        supplemental_lines.append(f"- Age ranges: {', '.join(request.age_ranges)}")
    if request.themes:
        supplemental_lines.append(f"- Themes: {', '.join(request.themes)}")
    if request.narrative_style:
        supplemental_lines.append(f"- Narrative style: {request.narrative_style}")
    character_text = _story_character_text(request.characters)
    if character_text:
        supplemental_lines.append(f"- Characters:\n{character_text}")

    return (
        "You are a professional children's picture book writer. Create a warm, age-appropriate story "
        "from the user's idea and supplemental constraints.\n\n"
        "Return JSON only, matching this shape:\n"
        '{ "title": "short story title", "summary": "one sentence summary", "body": "complete story body" }\n\n'
        "Requirements: positive and child-safe; complete beginning, development, and ending; easy to read aloud; "
        "use the provided characters when present, with the protagonist driving the core action; no Markdown and no explanation.\n\n"
        f"Supplemental constraints:\n{chr(10).join(supplemental_lines)}\n\n"
        f"User idea:\n{request.idea_prompt.strip()}"
    )


def _build_storyboard_prompt(request: PictureBookStoryboardRequest) -> str:
    character_text = _storyboard_character_text(request.character_refs or request.characters)
    return (
        "You are a professional children's picture book visual director. Split the story into picture book storyboard pages.\n\n"
        "For each page, text_zh is the complete page text, playback_segments is the ordered playable script with narration and dialogue interleaved, and visual_prompt is the image prompt.\n\n"
        "Return JSON only, matching this shape:\n"
        "{\n"
        '  "pages": [\n'
        "    {\n"
        '      "page_no": 1,\n'
        '      "title": "page title",\n'
        '      "text_zh": "Chinese page text",\n'
        '      "text_en": null,\n'
        '      "narration_text": "read-aloud text",\n'
        '      "visual_prompt": "Chinese image prompt for the illustration model",\n'
        '      "character_appearances": [{"role_code": "role code from character list", "display_name": "character display name"}],\n'
        '      "dialogues": [{"speaker_ref": "speaker role_code", "text": "dialogue text", "sort_order": 1}],\n'
        '      "playback_segments": [\n'
        '        {"segment_type": "narration", "text": "narration text", "sort_order": 0},\n'
        '        {"segment_type": "dialogue", "speaker_ref": "speaker role_code", "text": "dialogue text", "sort_order": 1}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Requirements: pages must contain exactly {request.target_page_count} items; page_no starts at 1 and increments continuously; "
        "storyboard order must follow the source story; content must be child-safe, warm, and appropriate; "
        "text_zh must include all narration and dialogue for the page; playback_segments must split that same text into ordered narration/dialogue segments; "
        "narration_text should include only narration, while dialogues should include only character speech for backward compatibility; "
        "visual_prompt should describe concrete visible subjects, actions, setting, style, color, lighting, and composition; "
        "visual_prompt must not include text to render inside the image; "
        "character_appearances should include only characters visible on that page, and role_code must come from the character list.\n\n"
        f"Character list:\n{character_text}\n\n"
        f"Story title: {request.title or '专属绘本'}\n\n"
        f"Story content:\n{request.story_content}"
    )


def _story_character_text(characters: list[StoryPromptCharacter]) -> str:
    lines = []
    for character in characters:
        name = str(character.name or character.display_name or "").strip()
        if not name:
            continue
        role = "protagonist" if character.is_protagonist else "character"
        role_code = f" role_code={character.role_code}" if character.role_code else ""
        lines.append(f"  - {name} ({role}{role_code})")
    return "\n".join(lines)


def _storyboard_character_text(characters: list[StoryPromptCharacter]) -> str:
    text = _story_character_text(characters)
    return text or "Not specified"


def _inline_data_to_data_url(inline_data: Any) -> str:
    data = inline_data.data
    if isinstance(data, bytes):
        base64_data = base64.b64encode(data).decode("ascii")
    else:
        base64_data = str(data)
    return f"data:{inline_data.mime_type};base64,{base64_data}"


def _finish_reason_error(finish_reason: Any) -> AiProviderError | None:
    if finish_reason is None:
        return None
    reason_name = getattr(finish_reason, "name", str(finish_reason))
    if reason_name == "STOP":
        return None
    policy_reasons = {"IMAGE_SAFETY", "PROHIBITED_CONTENT", "SAFETY", "RECITATION"}
    error_code = "PROVIDER_CONTENT_REJECTED" if reason_name in policy_reasons else "PROVIDER_FAILED"
    return AiProviderError(f"Gemini 图片生成非正常结束: {reason_name}", error_code=error_code)


async def gemini_generate_images(
    model: str,
    request: ImageGenerationRequest | str,
    *,
    image_urls: list[str] | None = None,
) -> list[str]:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    client = _gemini_client(genai, types)
    aspect_ratio = request.aspect_ratio if isinstance(request, ImageGenerationRequest) else ImageAspectRatio.LANDSCAPE_STANDARD
    if isinstance(request, ImageGenerationRequest) and request.kind == "picture_book_pages":
        return await _generate_picture_book_pages_sequentially(client, types, model, request.pages, aspect_ratio=aspect_ratio)

    prompt = _build_gemini_image_prompt(request)
    resolved_image_urls = image_urls if isinstance(request, str) else _image_urls_from_request(request)
    return await _generate_images_once(client, types, model, prompt, resolved_image_urls or [], aspect_ratio=aspect_ratio)


async def _generate_picture_book_pages_sequentially(
    client: Any,
    types: Any,
    model: str,
    pages: list[PageMediaInput],
    *,
    aspect_ratio: ImageAspectRatio,
) -> list[str]:
    images: list[str] = []
    previous_image_url: str | None = None
    total = len(pages)
    for index, page in enumerate(pages):
        prompt = _build_picture_book_sequential_page_prompt(page, page_index=index, page_count=total, has_previous_image=bool(previous_image_url))
        image_urls = [*_page_character_image_urls(page)]
        if previous_image_url:
            image_urls.append(previous_image_url)
        generated = await _generate_images_once(client, types, model, prompt, image_urls, aspect_ratio=aspect_ratio)
        image_url = generated[0]
        images.append(image_url)
        previous_image_url = image_url
    return images


async def _generate_images_once(
    client: Any,
    types: Any,
    model: str,
    prompt: str,
    image_urls: list[str],
    *,
    aspect_ratio: ImageAspectRatio,
) -> list[str]:
    parts = []
    for image_url in image_urls:
        parts.append(await _image_url_to_part(types, image_url))
    parts.append(types.Part.from_text(text=prompt))
    images: list[str] = []
    response = await client.aio.models.generate_content(
        model=model,
        contents=types.Content(parts=parts),
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio.value),
        ),
    )
    if not response.candidates:
        raise AiProviderError("Gemini 图片生成未返回候选内容", error_code="GEMINI_EMPTY_RESPONSE")
    for candidate in response.candidates:
        finish_error = _finish_reason_error(candidate.finish_reason)
        if finish_error is not None:
            raise finish_error
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                images.append(_inline_data_to_data_url(part.inline_data))
    if images:
        return images
    raise AiProviderError("Gemini 图片生成未返回图片", error_code="GEMINI_NO_IMAGE")


async def gemini_generate_image(model: str, request: ImageGenerationRequest | str, *, image_urls: list[str] | None = None) -> str:
    images = await gemini_generate_images(model, request, image_urls=image_urls)
    return images[0]


def _build_gemini_image_prompt(request: ImageGenerationRequest | str) -> str:
    if isinstance(request, str):
        return request
    if request.kind == "picture_book_pages":
        return _build_picture_book_images_prompt(request.pages)
    if request.kind == "picture_book_single_page" and request.pages:
        return _build_picture_book_single_page_image_prompt(request.pages[0])
    if request.kind == "character_portrait" and request.character:
        return _build_character_image_prompt(request.character)
    raise AiProviderError(f"不支持的 Gemini 图片生成请求类型: {request.kind}", error_code="GEMINI_IMAGE_REQUEST_UNSUPPORTED")


def _image_urls_from_request(request: ImageGenerationRequest) -> list[str]:
    if request.kind == "character_portrait" and request.character and request.character.reference_image_url:
        return [request.character.reference_image_url]
    return [*_all_character_image_urls(request.pages), *_continuity_image_urls(request.pages)]


def _build_picture_book_images_prompt(pages: list[PageMediaInput]) -> str:
    sections = [
        "Create a sequence of children's picture book interior illustrations.",
        f"Return exactly {len(pages)} image(s), in the same order as the page list.",
        "Do not merge pages, create a cover, add extra images, or render page text into the artwork.",
        "Use the input images in this order: character design images first, then prior-page continuity references.",
    ]
    all_characters = _all_character_labels(pages)
    if all_characters:
        sections.append(f"Character design images that define the already-stylized character appearances: {_character_reference_text(all_characters)}")
    continuity_count = len(_continuity_image_urls(pages))
    if continuity_count:
        sections.append(f"Continuity references: the last {continuity_count} input image(s) show prior pages. Use them only to keep scene, palette, style, and composition continuity.")
    for index, page in enumerate(pages):
        sections.append(_build_picture_book_image_prompt(page, page_index=index, page_count=len(pages)))
    return "\n\n".join(sections)


def _build_picture_book_single_page_image_prompt(page: PageMediaInput) -> str:
    sections = [
        "Create exactly one children's picture book interior illustration for the specified page.",
        "Do not redraw other pages or change story pacing.",
        "Use input images in this order when present: character design images first, then prior-page continuity references.",
        _build_picture_book_image_prompt(page, page_index=0, page_count=1),
    ]
    return "\n\n".join(sections)


def _build_picture_book_sequential_page_prompt(
    page: PageMediaInput,
    *,
    page_index: int,
    page_count: int,
    has_previous_image: bool,
) -> str:
    sections = [
        "Create exactly one children's picture book interior illustration for this page.",
        f"This is page image {page_index + 1} of {page_count}.",
        "Input images are ordered as: current-page character design images first.",
    ]
    if has_previous_image:
        sections.append("The final input image is the previously generated page. Use it only as continuity reference for scene flow, palette, style, composition, and character consistency.")
    else:
        sections.append("There is no previous generated page reference for this first page.")
    sections.append(_build_picture_book_image_prompt(page, page_index=page_index, page_count=page_count))
    return "\n\n".join(sections)


def _build_picture_book_image_prompt(page: PageMediaInput, *, page_index: int, page_count: int) -> str:
    page_label = page.page_no or page_index + 1
    sections = [f"Page {page_label}: image {page_index + 1} of {page_count}."]
    if page.title:
        sections.append(f"Page title for context: {page.title}")
    if page.visual_prompt:
        sections.append(f"Visible scene: {page.visual_prompt}")
    if page.art_style_prompt:
        sections.append(f"Target style, palette, and texture: {page.art_style_prompt}")
    characters = [item for item in page.character_appearances if item.image_url]
    if characters:
        sections.append(f"Characters appearing on this page: {_character_list_text(characters)}")
    dialogue_text = "；".join(item.text for item in page.dialogues if item.text)
    if dialogue_text:
        sections.append(f"Dialogue is only for emotion/action context; do not draw these words: {dialogue_text}")
    sections.append(
        "Requirements:\n"
        "- Warm, child-friendly picture book illustration.\n"
        "- Clear subject, action, environment, complete composition, and stable visual continuity.\n"
        "- Character actions, poses, expressions, and camera angles may change to fit this page. Keep each character's established stylized design consistent: illustration style, face and facial features, hairstyle and hair color, clothing and accessories, body proportions, and distinctive visual traits must match the character design images.\n"
        "- No text, letters, titles, labels, borders, or watermarks in the image."
    )
    return "\n".join(sections)


def _build_character_image_prompt(character: CharacterPortraitInput) -> str:
    sections = [
        "Create a single character design image for a children's picture book character library.",
        f"Character name: {character.name}",
    ]
    if character.description:
        sections.append(f"Character description: {character.description}")
    if character.generation_prompt:
        sections.append(f"User generation request: {character.generation_prompt}")
    if character.art_style_prompt:
        sections.append(f"Target illustration style: {character.art_style_prompt}")
    if character.category_code:
        sections.append(f"Category: {character.category_code}")
    if character.reference_image_url:
        if character.art_style_prompt:
            sections.append(
                "The input image is a character reference. Preserve identity, facial traits, hairstyle, clothing, and distinctive marks. Do not preserve the reference background or style; transfer the character into the target illustration style."
            )
        else:
            sections.append(
                "The input image is a character reference. Preserve identity, facial traits, hairstyle, clothing, distinctive marks, and overall illustration style. Do not copy background or watermark."
            )
    sections.append(
        "Requirements:\n"
        "- One character only.\n"
        "- Clear full-body or half-body subject, reusable across multiple pages.\n"
        "- Warm, friendly, child-appropriate expression.\n"
        "- Simple background.\n"
        "- No text, letters, title, label, border, or watermark."
    )
    return "\n".join(sections)


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


def _page_character_image_urls(page: PageMediaInput) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for appearance in page.character_appearances:
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


def _all_character_labels(pages: list[PageMediaInput]) -> list[PageCharacterImageRef]:
    labels: list[PageCharacterImageRef] = []
    seen: set[str] = set()
    for page in pages:
        for character in page.all_character_refs:
            if character.role_code in seen or not character.image_url:
                continue
            labels.append(character)
            seen.add(character.role_code)
    return labels


def _character_reference_text(characters: list[PageCharacterImageRef]) -> str:
    labels = []
    for index, character in enumerate(characters, start=1):
        role_code = character.role_code.strip()
        display_name = str(character.display_name or "").strip()
        name = display_name or role_code or f"character {index}"
        code_text = f" (role_code: {role_code})" if role_code and role_code != name else ""
        labels.append(f"image {index} is {name}{code_text}")
    return "; ".join(labels) + "."


def _character_list_text(characters: list[PageCharacterImageRef]) -> str:
    labels = []
    for character in characters:
        role_code = character.role_code.strip()
        display_name = str(character.display_name or "").strip()
        name = display_name or role_code
        if not name:
            continue
        code_text = f" (role_code: {role_code})" if role_code and role_code != name else ""
        labels.append(f"{name}{code_text}")
    return "; ".join(labels) + "."


def _image_mime_type(url: str) -> str:
    normalized = url.split("?", 1)[0].lower()
    if normalized.endswith(".jpg") or normalized.endswith(".jpeg"):
        return "image/jpeg"
    if normalized.endswith(".webp"):
        return "image/webp"
    return "image/png"


async def _image_url_to_part(types: Any, url: str) -> Any:
    mime_type, data = await asyncio.get_running_loop().run_in_executor(None, _read_image_url, url)
    return types.Part.from_bytes(data=data, mime_type=mime_type)


def _read_image_url(url: str) -> tuple[str, bytes]:
    if url.startswith("data:"):
        header, encoded = url.split(",", 1)
        mime_type = header.removeprefix("data:").split(";", 1)[0] or "image/png"
        return mime_type, base64.b64decode(encoded)

    req = urllib_request.Request(url, headers={"User-Agent": "AIrchieve/1.0"})
    with urllib_request.urlopen(req, timeout=30) as response:
        data = response.read()
        content_type = response.headers.get_content_type()
    mime_type = content_type if content_type.startswith("image/") else _image_mime_type(url)
    return mime_type, data


def _pcm_to_wav_data_url(pcm: bytes, *, channels: int = 1, rate: int = 24000, sample_width: int = 2) -> str:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    base64_data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:audio/wav;base64,{base64_data}"


async def gemini_generate_audio(model: str, request: AudioGenerationRequest | str, *, voice_name: str | None = None) -> str:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    client = _gemini_client(genai, types)
    text = request.text if isinstance(request, AudioGenerationRequest) else request
    resolved_voice_name = _voice_name_from_ref(request.voice_ref) if isinstance(request, AudioGenerationRequest) else voice_name
    response = await client.aio.models.generate_content(
        model=model,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=resolved_voice_name or settings.GEMINI_TTS_VOICE,
                    )
                )
            ),
        ),
    )
    if not response.candidates:
        raise AiProviderError("Gemini 语音生成未返回候选内容", error_code="GEMINI_EMPTY_RESPONSE")
    for candidate in response.candidates:
        finish_error = _finish_reason_error(candidate.finish_reason)
        if finish_error is not None:
            raise finish_error
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and inline_data.data:
                data = inline_data.data
                pcm = data if isinstance(data, bytes) else base64.b64decode(str(data))
                return _pcm_to_wav_data_url(pcm)
    raise AiProviderError("Gemini 语音生成未返回音频", error_code="GEMINI_NO_AUDIO")


def _voice_name_from_ref(voice_ref: VoicePromptRef | None) -> str | None:
    if not voice_ref:
        return None
    value = voice_ref.voice_name or voice_ref.voice_type or voice_ref.provider_voice_id
    return str(value) if value else None
