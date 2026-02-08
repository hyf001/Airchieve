"""
Storybook Service
绘本服务
"""
from typing import Optional, List, AsyncGenerator
import json
from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.storybook import Storybook, StorybookPage, StorybookStatus
from app.services.gemini_cli import GeminiCli


async def create_storybook_stream(
    instruction: str,
    style_prefix: str,
    images: Optional[List[str]] = None,
    creator: str = "user"
) -> AsyncGenerator[str, None]:
    """
    流式创建绘本

    Args:
        instruction: 用户指令/绘本描述
        style_prefix: 绘本风格
        images: base64编码的图片列表（可选）
        creator: 创建者名称

    Yields:
        str: JSON格式的进度更新
    """
    # 步骤1: 创建绘本记录
    async with async_session_maker() as session:
        new_storybook = Storybook(
            title=instruction[:100] if len(instruction) > 100 else instruction,
            description=f"风格: {style_prefix}\n指令: {instruction}",
            creator=creator,
            status="init"
        )

        session.add(new_storybook)
        await session.commit()
        await session.refresh(new_storybook)

        storybook_id = new_storybook.id

    # 发送绘本创建成功事件
    yield json.dumps({
        "type": "storybook_created",
        "data": {
            "id": storybook_id,
            "title": new_storybook.title,
            "status": "init"
        }
    }, ensure_ascii=False)

    # 步骤2: 开始生成内容
    yield json.dumps({
        "type": "generation_started",
        "data": {
            "message": "开始生成绘本内容..."
        }
    }, ensure_ascii=False)

    # 更新状态为 creating
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if storybook:
            storybook.status = "creating"
            await session.commit()

    try:
        # 使用 LLM CLI 生成绘本内容
        llm_client = GeminiCli()
        pages = await llm_client.create_story(
            instruction=instruction,
            style_prefix=style_prefix,
            images=images
        )

        # 步骤3: 更新绘本内容
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()

            if storybook:
                storybook.pages = pages
                storybook.status = "finished"
                await session.commit()

        # 发送完成事件
        yield json.dumps({
            "type": "generation_completed",
            "data": {
                "id": storybook_id,
                "status": "finished",
                "pages_count": len(pages) if pages else 0
            }
        }, ensure_ascii=False)

    except Exception as e:
        # 发送错误事件
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()

            if storybook:
                storybook.status = "error"
                await session.commit()

        yield json.dumps({
            "type": "generation_error",
            "data": {
                "error": str(e)
            }
        }, ensure_ascii=False)
        raise


async def get_storybook(storybook_id: int) -> Optional[Storybook]:
    """
    获取绘本信息

    Args:
        storybook_id: 绘本ID

    Returns:
        Storybook对象，如果不存在则返回None
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        return result.scalar_one_or_none()


async def update_storybook_pages(
    storybook_id: int,
    pages: List[StorybookPage]
) -> bool:
    """
    更新绘本页面内容

    Args:
        storybook_id: 绘本ID
        pages: 页面列表

    Returns:
        bool: 更新是否成功
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()

        if not storybook:
            return False

        storybook.pages = pages
        storybook.status = "finished"
        await session.commit()

        return True


async def edit_storybook(
    storybook_id: int,
    instruction: str
) -> bool:
    """
    编辑绘本

    Args:
        storybook_id: 绘本ID
        instruction: 编辑指令

    Returns:
        bool: 编辑是否成功
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()

        if not storybook or not storybook.pages:
            return False

        # 更新状态为 updating
        storybook.status = "updating"
        await session.commit()

        current_pages = storybook.pages
        # 从描述中提取风格前缀
        style_prefix = ""
        if storybook.description and "风格: " in storybook.description:
            style_prefix = storybook.description.split("风格: ")[1].split("\n")[0]

    # 使用 LLM CLI 编辑绘本
    llm_client = GeminiCli()
    new_pages = await llm_client.edit_story(
        instruction=instruction,
        current_pages=current_pages,
        style_prefix=style_prefix
    )

    # 更新绘本内容
    return await update_storybook_pages(storybook_id, new_pages)


async def edit_storybook_page(
    storybook_id: int,
    page_index: int,
    instruction: str
) -> bool:
    """
    编辑绘本单页

    Args:
        storybook_id: 绘本ID
        page_index: 页码索引
        instruction: 编辑指令

    Returns:
        bool: 编辑是否成功
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()

        if not storybook or not storybook.pages:
            return False

        if page_index < 0 or page_index >= len(storybook.pages):
            return False

        current_page = storybook.pages[page_index]
        # 从描述中提取风格前缀
        style_prefix = ""
        if storybook.description and "风格: " in storybook.description:
            style_prefix = storybook.description.split("风格: ")[1].split("\n")[0]

    # 使用 LLM CLI 编辑单页
    llm_client = GeminiCli()
    new_page = await llm_client.edit_page(
        page_index=page_index,
        instruction=instruction,
        current_page=current_page,
        style_prefix=style_prefix
    )

    # 更新绘本的该页内容
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()

        if storybook and storybook.pages:
            storybook.pages[page_index] = new_page
            await session.commit()

        return True
    
    
    

