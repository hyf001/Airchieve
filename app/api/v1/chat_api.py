"""
Chat API
聊天相关接口
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.chat_service import chat_stream

router = APIRouter()


class ChatRequest(BaseModel):
    """聊天请求"""
    project_id: str | None = None
    question: str
    model: Optional[str] = None  # 可选的模型名称
    files: Optional[List[str]] = None  # 可选的文件路径列表


@router.post("/stream")
async def chat_stream_api(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """流式聊天接口

    通过 SSE 流式返回智能体输出内容。
    需要 Bearer Token 认证。
    如果不传 project_id，会自动创建项目。
    """

    async def event_generator():
        async for message in chat_stream(
            project_id=req.project_id,
            question=req.question,
            user_id=user.id,
            db=db,
            model=req.model,
            files=req.files,
        ):
            data = json.dumps(message.model_dump(mode="json"), ensure_ascii=False)
            yield f"data: {data}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
