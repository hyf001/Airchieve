"""
Gemini Service
绘本生成相关的 Gemini API 服务（Python 版本，对应前端 geminiService.ts）
"""
import re
from typing import List, Optional, TypedDict

from google import genai
from google.genai import types

from app.core.config import settings


def _get_client() -> genai.Client:
    """获取 Gemini SDK 客户端，支持自定义 API URL"""
    kwargs: dict = {"api_key": settings.GEMINI_API_KEY}
    if settings.GEMINI_API_URL:
        kwargs["http_options"] = types.HttpOptions(base_url=settings.GEMINI_API_URL)
    return genai.Client(**kwargs)


class PageItem(TypedDict):
    text: str
    imagePrompt: str


class StoryStructure(TypedDict):
    title: str
    characterDescription: str
    pages: List[PageItem]


async def generate_story_structure(prompt: str, style_name: str) -> StoryStructure:
    """根据用户创意生成 5 页儿童绘本结构（标题 + 每页文案和图片提示词）"""
    client = _get_client()

    response = await client.aio.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=(
            f'Create a 5-page children\'s picture book titled based on this idea: "{prompt}". '
            f"The style is {style_name}. "
            f"\n\nCRITICAL: You must also define a detailed \"characterDescription\" for the main character "
            f"to ensure visual consistency across all pages. "
            f"Specify their fixed colors, clothing, and unique physical features."
            f"\n\nFor each page, provide a short text and a descriptive image prompt that references the main character by name."
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "characterDescription": {
                        "type": "STRING",
                        "description": "Detailed visual traits of the protagonist to keep them looking identical in every image.",
                    },
                    "pages": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "text": {"type": "STRING"},
                                "imagePrompt": {"type": "STRING"},
                            },
                            "required": ["text", "imagePrompt"],
                        },
                    },
                },
                "required": ["title", "characterDescription", "pages"],
            },
        ),
    )

    import json
    return json.loads(response.text or "{}")


async def generate_image(image_prompt: str, style_prefix: str, character_description: str = "") -> str:
    """使用 Gemini 生成图片，返回图片 URL 或 base64 data URI"""
    client = _get_client()

    full_prompt = (
        f"STYLE: {style_prefix}.\n"
        f"CHARACTER APPEARANCE: {character_description}.\n"
        f"SCENE: {image_prompt}.\n"
        f"REQUIREMENT: Ensure the main character looks exactly as described. "
        f"Clean background, consistent lighting, professional storybook quality."
    )

    response = await client.aio.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=types.Content(
            parts=[types.Part(text=full_prompt)]
        ),
        config=types.GenerateContentConfig(
            image_config=types.ImageConfig(aspect_ratio="1:1"),
        ),
    )

    for candidate in response.candidates or []:
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            # inline_data: 官方 API 直接返回 base64
            if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                return f"data:{part.inline_data.mime_type};base64,{part.inline_data.data}"
            # text 中的 markdown 图片 URL: 代理返回 ![image](https://...)
            if part.text:
                m = re.search(r'!\[.*?\]\((https?://[^\)]+)\)', part.text)
                if m:
                    return m.group(1)
    return ""


async def chat_with_storyteller(
    history: List[dict],
    user_message: str,
) -> Optional[str]:
    """与绘本创作助手对话"""
    client = _get_client()

    chat = client.aio.chats.create(
        model="gemini-3-pro-image-preview",
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are a professional children's storybook author and editor. "
                "Help the user refine their story, add new pages, or change scenes. "
                "Keep it creative, encouraging, and focused on visual storytelling."
            ),
        ),
    )

    response = await chat.send_message(message=user_message)
    return response.text
