"""
本系统的消息结构体，用于规范消息格式。

ChatMessage 用于区分 Claude Agent SDK 的 message 类型。
"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

Role = Literal["system", "assistant", "user"]
MessageType = Literal["project_created", "system", "chat", "thinking","tool_use", "tool_result", "chat_complete", "error"]


class ChatMessage(BaseModel):
    """本系统的消息结构体。
    """
    # Message Type & Role
    role: Role
    message_type: MessageType

    # Content
    content: str

    # Metadata - flexible JSON storage for various message types
    metadata_json: dict | None

    conversation_id: str

    # Performance & Cost Tracking
    duration_ms: int
    token_count: int
    cost_usd: float | None

    # Timestamps
    created_at: datetime
