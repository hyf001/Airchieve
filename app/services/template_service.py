"""
Template Service
模版服务
"""
from typing import Optional, List
from sqlalchemy import select, desc, or_

from app.db.session import async_session_maker
from app.models.template import Template


async def create_template(
    name: str,
    instruction: str,
    creator: str,
    description: Optional[str] = None,
    systemprompt: Optional[str] = None,
    storybook_id: Optional[int] = None,
    is_active: bool = True,
    sort_order: int = 0
) -> Template:
    """
    创建模版

    Args:
        name: 模版名称
        instruction: 用户指令模板
        creator: 创建者名称
        description: 模版描述
        systemprompt: 系统提示词
        storybook_id: 示例绘本ID
        is_active: 是否启用
        sort_order: 排序顺序

    Returns:
        Template: 创建的模版对象
    """
    async with async_session_maker() as session:
        new_template = Template(
            name=name,
            description=description,
            creator=creator,
            instruction=instruction,
            systemprompt=systemprompt,
            storybook_id=storybook_id,
            is_active=is_active,
            sort_order=sort_order
        )

        session.add(new_template)
        await session.commit()
        await session.refresh(new_template)

        return new_template


async def get_template(template_id: int) -> Optional[Template]:
    """
    获取模版详情

    Args:
        template_id: 模版ID

    Returns:
        Template对象，如果不存在则返回None
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Template).where(Template.id == template_id)
        )
        return result.scalar_one_or_none()


async def list_templates(
    creator: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Template]:
    """
    获取模版列表

    Args:
        creator: 按创建者筛选
        is_active: 按启用状态筛选
        keyword: 按名称或描述关键词筛选
        limit: 返回数量限制
        offset: 偏移量

    Returns:
        List[Template]: 模版列表
    """
    async with async_session_maker() as session:
        query = select(Template).order_by(desc(Template.sort_order), desc(Template.created_at))

        # 筛选条件
        if creator:
            query = query.where(Template.creator == creator)
        if is_active is not None:
            query = query.where(Template.is_active == is_active)
        if keyword:
            # 模糊匹配名称或描述
            query = query.where(
                or_(
                    Template.name.like(f"%{keyword}%"),
                    Template.description.like(f"%{keyword}%")
                )
            )

        # 分页
        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        return list(result.scalars().all())


async def update_template(
    template_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    instruction: Optional[str] = None,
    systemprompt: Optional[str] = None,
    storybook_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    sort_order: Optional[int] = None,
    modifier: Optional[str] = None
) -> Optional[Template]:
    """
    更新模版

    Args:
        template_id: 模版ID
        name: 模版名称
        description: 模版描述
        instruction: 用户指令模板
        systemprompt: 系统提示词
        storybook_id: 示例绘本ID
        is_active: 是否启用
        sort_order: 排序顺序
        modifier: 修改者名称

    Returns:
        Template: 更新后的模版对象，如果不存在则返回None
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Template).where(Template.id == template_id)
        )
        template = result.scalar_one_or_none()

        if not template:
            return None

        # 更新字段
        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if instruction is not None:
            template.instruction = instruction
        if systemprompt is not None:
            template.systemprompt = systemprompt
        if storybook_id is not None:
            template.storybook_id = storybook_id
        if is_active is not None:
            template.is_active = is_active
        if sort_order is not None:
            template.sort_order = sort_order
        if modifier is not None:
            template.modifier = modifier

        await session.commit()
        await session.refresh(template)

        return template


async def delete_template(template_id: int) -> bool:
    """
    删除模版

    Args:
        template_id: 模版ID

    Returns:
        bool: 是否删除成功
    """
    from sqlalchemy import delete

    async with async_session_maker() as session:
        # 检查模版是否存在
        result = await session.execute(
            select(Template).where(Template.id == template_id)
        )
        template = result.scalar_one_or_none()

        if not template:
            return False

        # 删除模版
        await session.execute(delete(Template).where(Template.id == template_id))
        await session.commit()

        return True
