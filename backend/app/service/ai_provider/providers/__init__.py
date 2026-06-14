from app.service.ai_provider.providers.aliyun import aliyun_generate_audio
from app.service.ai_provider.providers.doubao import (
    doubao_create_picture_book_storyboard,
    doubao_create_story_content,
    doubao_draft_story_text,
    doubao_generate_audio,
    doubao_generate_image,
    doubao_generate_images,
)
from app.service.ai_provider.providers.gemini import (
    gemini_create_picture_book_storyboard,
    gemini_create_story_content,
    gemini_draft_story_text,
    gemini_generate_audio,
    gemini_generate_image,
    gemini_generate_images,
)
from app.service.ai_provider.providers.kling import kling_generate_audio, kling_generate_lip_sync

__all__ = [
    "aliyun_generate_audio",
    "doubao_create_picture_book_storyboard",
    "doubao_create_story_content",
    "doubao_draft_story_text",
    "doubao_generate_audio",
    "doubao_generate_image",
    "doubao_generate_images",
    "gemini_create_picture_book_storyboard",
    "gemini_create_story_content",
    "gemini_draft_story_text",
    "gemini_generate_audio",
    "gemini_generate_image",
    "gemini_generate_images",
    "kling_generate_audio",
    "kling_generate_lip_sync",
]
