"""
Gemini API
绘本生成相关接口（故事结构、图片生成、AI 对话）
"""
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.gemini_service import (
    generate_story_structure,
    generate_image,
    chat_with_storyteller,
)

router = APIRouter()


# ── Request / Response Models ──────────────────────────────────────

class StoryStructureRequest(BaseModel):
    prompt: str
    styleName: str


class PageItem(BaseModel):
    text: str
    imagePrompt: str


class StoryStructureResponse(BaseModel):
    title: str
    characterDescription: str = ""
    pages: List[PageItem]


class GenerateImageRequest(BaseModel):
    imagePrompt: str
    stylePrefix: str
    characterDescription: str = ""


class GenerateImageResponse(BaseModel):
    imageDataUrl: str


class ChatMessagePart(BaseModel):
    text: str


class ChatHistoryItem(BaseModel):
    role: str
    parts: List[ChatMessagePart]


class ChatRequest(BaseModel):
    history: Optional[List[ChatHistoryItem]] = None
    userMessage: str


class ChatResponse(BaseModel):
    reply: str


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/story-structure", response_model=StoryStructureResponse)
async def api_generate_story_structure(req: StoryStructureRequest):
    """根据用户创意生成绘本结构"""
    result = await generate_story_structure(req.prompt, req.styleName)
    return result


@router.post("/generate-image", response_model=GenerateImageResponse)
async def api_generate_image(req: GenerateImageRequest):
    """生成绘本插图"""
    data_url = await generate_image(req.imagePrompt, req.stylePrefix, req.characterDescription)
    return GenerateImageResponse(imageDataUrl=data_url)


@router.post("/chat", response_model=ChatResponse)
async def api_chat_with_storyteller(req: ChatRequest):
    """与绘本创作助手对话"""
    history = []
    if req.history:
        history = [
            {"role": item.role, "parts": [p.model_dump() for p in item.parts]}
            for item in req.history
        ]
    reply = await chat_with_storyteller(history, req.userMessage)
    return ChatResponse(reply=reply or "")
