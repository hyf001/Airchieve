"""
Chat Service
聊天业务逻辑服务
"""
from datetime import datetime
from typing import AsyncGenerator, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ChatMessage import ChatMessage
from app.core.agent_manager import session_manager
from app.schemas.media import FileInfo
from app.services.project_service import get_project_by_id, create_project


async def chat_stream(
    project_id: str | None,
    question: str,
    user_id: int,
    db: AsyncSession,
    model: Optional[str] = None,
    files: Optional[List[str]] = None,
) -> AsyncGenerator[ChatMessage, None]:
    """调用智能体执行用户问句，流式返回消息

    Args:
        project_id: 项目ID（可为空，空时自动创建项目）
        question: 用户问句
        user_id: 用户ID
        db: 数据库会话
        model: 可选的模型名称
        files: 可选的文件路径列表

    Yields:
        ChatMessage: 智能体返回的消息流
    """
    # 检查项目是否存在，不存在则创建
    if project_id:
        project = await get_project_by_id(project_id, db)
    else:
        project = None

    if not project:
        # 项目名称：问句前10个字
        project_name = question[:10] if len(question) > 10 else question
        # 描述：完整问句
        project_description = question

        project = await create_project(
            name=project_name,
            user_id=user_id,
            description=project_description,
            db=db,
        )
        await db.commit()

        # 通过流式返回项目创建信息
        yield ChatMessage(
            role="system",
            message_type="project_created",
            content=f"已创建新项目: {project.name}",
            metadata_json={
                "project_id": project.id,
                "project_name": project.name,
                "project_description": project.description,
            },
            conversation_id=project.id,
            duration_ms=0,
            token_count=0,
            cost_usd=None,
            created_at=datetime.now(),
        )

    # 将文件路径转换为 FileInfo 对象
    files_info: Optional[List[FileInfo]] = None
    if files:
        files_info = [FileInfo.from_path(f) for f in files]

    async for message in session_manager.execute_instruction(
        _user=str(user_id),
        project_id=project.id,
        instruction=question,
        db=db,
        model=model,
        files=files_info,
    ):
        yield message
