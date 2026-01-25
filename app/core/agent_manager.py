"""Unified CLI Manager implementation.

简化的 Manager，只负责创建 Agent 和 Context，返回消息流供 API 层处理。
"""
from typing import AsyncGenerator, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ChatMessage import ChatMessage
from app.core.chat_context import ChatContext
from app.core.airchieve_agent import AirchieveAgent
from app.schemas.media import FileInfo


class UnifiedSessionManager:
    """Unified manager for all CLI implementations"""

    async def execute_instruction(
        self,
        _user: str,  # 当前用户（预留参数）
        project_id: str,  # project_id 即为 session 标识
        instruction: str,
        db: AsyncSession,  # 保留用于 API 层处理（消息持久化等）
        files: Optional[List[FileInfo]] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[ChatMessage, None]:
        """Execute instruction and return message stream

        创建智能体和 ChatContext，调用 execute_with_streaming 返回消息流。
        SSE 传输逻辑在 API 层处理。

        Args:
            user: 当前用户标识
            project_id: 项目ID（同时作为会话标识）
            instruction: 用户指令
            db: 数据库会话
            files: 文件附件列表
            model: 可选的模型名称

        Yields:
            ChatMessage: 执行过程中产生的消息
        """
        # 创建智能体
        agent = AirchieveAgent()

        # 创建聊天上下文
        chat_context = ChatContext(
            instruction=instruction,
            project_id=project_id,
            files=files,
            model=model,
            is_initial_prompt=True,  # 简化版本，每次都作为初始提示
        )

        # 调用智能体执行，返回消息流
        async for message in agent.execute_with_streaming(chat_context):
            yield message


# 全局单例
session_manager = UnifiedSessionManager()

__all__ = ["session_manager"]
