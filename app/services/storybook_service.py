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


async def _generate_storybook_content_stream(
    storybook_id: int,
    instruction: str,
    system_prompt: Optional[str] = None,
    images: Optional[List[str]] = None,
    is_edit: bool = False,
    original_pages: Optional[List[StorybookPage]] = None
) -> AsyncGenerator[str, None]:
    """
    通用的绘本内容生成流程（支持创建和编辑）

    Args:
        storybook_id: 绘本ID
        instruction: 用户指令
        system_prompt: 系统提示词（可选）
        images: base64编码的图片列表（可选）
        is_edit: 是否为编辑模式
        original_pages: 原始页面（仅编辑模式使用）

    Yields:
        str: JSON格式的进度更新
    """
    # 发送开始生成事件
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

        if is_edit and original_pages:
            # 编辑模式：基于原始页面重新生成
            pages = await llm_client.edit_story(
                instruction=instruction,
                current_pages=original_pages,
                system_prompt=system_prompt
            )
        else:
            # 创建模式：全新生成
            pages = await llm_client.create_story(
                instruction=instruction,
                system_prompt=system_prompt,
                images=images
            )

        # 更新绘本内容
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


async def create_storybook_stream(
    instruction: str,
    template_id: Optional[int] = None,
    images: Optional[List[str]] = None,
    creator: str = "user"
) -> AsyncGenerator[str, None]:
    """
    流式创建绘本

    Args:
        instruction: 用户指令/绘本描述
        template_id: 模版ID（可选）
        images: base64编码的图片列表（可选）
        creator: 创建者名称

    Yields:
        str: JSON格式的进度更新
    """
    # 查询模版（如果提供了 template_id）
    style_prefix = ""
    systemprompt = None

    if template_id:
        from app.models.template import Template
        async with async_session_maker() as session:
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()

            if template and template.is_active:
                # 使用模版的 systemprompt
                systemprompt = template.systemprompt
                # 从模版的 instruction 中提取 style_prefix（如果需要的话）
                # 这里可以根据实际需求调整
                style_prefix = template.instruction if template.instruction else ""

    # 步骤1: 创建绘本记录
    async with async_session_maker() as session:
        new_storybook = Storybook(
            title=instruction[:100] if len(instruction) > 100 else instruction,
            description=f"风格: {style_prefix}\n指令: {instruction}",
            creator=creator,
            instruction=instruction,
            template_id=template_id,
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

    # 使用公共生成流程
    async for event in _generate_storybook_content_stream(
        storybook_id=storybook_id,
        instruction=instruction,
        system_prompt=systemprompt,
        images=images,
        is_edit=False
    ):
        yield event


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


async def edit_storybook_stream(
    storybook_id: int,
    instruction: str,
    images: Optional[List[str]] = None
) -> AsyncGenerator[str, None]:
    """
    流式编辑绘本（创建新版本）

    根据编辑指令对绘本进行修改，创建一个新的绘本保留原版本。

    Args:
        storybook_id: 原绘本ID
        instruction: 编辑指令
        images: base64编码的图片列表（可选）

    Yields:
        str: JSON格式的进度更新
    """
    # 获取原绘本
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        original_storybook = result.scalar_one_or_none()

        if not original_storybook or not original_storybook.pages:
            yield json.dumps({
                "type": "generation_error",
                "data": {
                    "error": "原绘本不存在或没有页面"
                }
            }, ensure_ascii=False)
            return

        current_pages = original_storybook.pages
        template_id = original_storybook.template_id

        # 查询模版（如果原绘本使用了模版）
        systemprompt = None
        if template_id:
            from app.models.template import Template
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                systemprompt = template.systemprompt

        # 创建新绘本记录
        new_storybook = Storybook(
            title=f"{original_storybook.title} (编辑版)",
            description=f"基于绘本#{storybook_id}编辑\n编辑指令: {instruction}",
            creator=original_storybook.creator,
            instruction=instruction,
            template_id=template_id,
            status="init"
        )

        session.add(new_storybook)
        await session.commit()
        await session.refresh(new_storybook)

        new_storybook_id = new_storybook.id

    # 发送新绘本创建成功事件
    yield json.dumps({
        "type": "storybook_created",
        "data": {
            "id": new_storybook_id,
            "title": new_storybook.title,
            "status": "init"
        }
    }, ensure_ascii=False)

    # 使用公共生成流程
    async for event in _generate_storybook_content_stream(
        storybook_id=new_storybook_id,
        instruction=instruction,
        system_prompt=systemprompt,
        images=images,
        is_edit=True,
        original_pages=current_pages
    ):
        yield event


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
        template_id = storybook.template_id

        # 查询模版（如果绘本使用了模版）
        systemprompt = None
        if template_id:
            from app.models.template import Template
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                systemprompt = template.systemprompt

    # 使用 LLM CLI 编辑单页
    llm_client = GeminiCli()
    new_page = await llm_client.edit_page(
        page_index=page_index,
        instruction=instruction,
        current_page=current_page,
        system_prompt=systemprompt
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


async def list_storybooks(
    creator: Optional[str] = None,
    title: Optional[str] = None,
    status: Optional[str] = None,
    is_public: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Storybook]:
    """
    获取绘本列表

    Args:
        creator: 按创建者筛选
        title: 按标题模糊匹配
        status: 按状态筛选
        is_public: 按是否公开筛选
        limit: 返回数量限制
        offset: 偏移量

    Returns:
        List[Storybook]: 绘本列表
    """
    from sqlalchemy import desc

    async with async_session_maker() as session:
        query = select(Storybook).order_by(desc(Storybook.created_at))

        # 筛选条件
        if creator:
            query = query.where(Storybook.creator == creator)
        if title:
            # 模糊匹配标题
            query = query.where(Storybook.title.like(f"%{title}%"))
        if status:
            query = query.where(Storybook.status == status)
        if is_public is not None:
            query = query.where(Storybook.is_public == is_public)

        # 分页
        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        storybooks = result.scalars().all()

        return list(storybooks)


