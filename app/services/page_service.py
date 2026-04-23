"""
Page Service
页面业务逻辑
"""
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.models.enums import PageStatus, PageType
from app.models.page import Page, Storyboard
from app.models.storybook import Storybook
from app.models.template import Template
from app.schemas.page import BaseImageUpdate, PageCreate, TextUpdate
from app.services.llm_cli import LLMClientBase, LLMError
from app.services.points_service import (
    check_creation_points,
    consume_for_page_edit,
)

logger = get_logger(__name__)


async def get_page_by_id(session: AsyncSession, page_id: int) -> Optional[Page]:
    """根据 ID 获取页面"""
    result = await session.execute(
        select(Page).where(Page.id == page_id)
    )
    return result.scalar_one_or_none()


async def get_page_detail(session: AsyncSession, page_id: int) -> Optional[dict]:
    """获取页面详情（含图层列表）"""
    from app.services.layer_service import get_layers_by_page_id

    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    layers = await get_layers_by_page_id(session, page_id)

    return {
        "id": page.id,
        "storybook_id": page.storybook_id,
        "page_index": page.page_index,
        "image_url": page.image_url,
        "text": page.text,
        "page_type": page.page_type.value if isinstance(page.page_type, PageType) else page.page_type,
        "status": page.status.value if isinstance(page.status, PageStatus) else page.status,
        "error_message": page.error_message,
        "storyboard": page.storyboard,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "layers": layers,
    }


async def list_pages_by_storybook(session: AsyncSession, storybook_id: int) -> list[Page]:
    """获取绘本的所有页面（按 page_index 排序）"""
    result = await session.execute(
        select(Page)
        .where(Page.storybook_id == storybook_id)
        .order_by(Page.page_index)
    )
    return list(result.scalars().all())


def get_back_cover_image_url(aspect_ratio: str) -> str:
    """根据图片比例获取封底 OSS 图片 URL"""
    mapping = {
        "1:1": settings.BACK_COVER_IMAGE_1_1,
        "4:3": settings.BACK_COVER_IMAGE_4_3,
        "16:9": settings.BACK_COVER_IMAGE_16_9,
    }
    url = mapping.get(aspect_ratio) or settings.BACK_COVER_IMAGE_16_9
    if not url:
        raise ValueError(f"未配置封底图片: {aspect_ratio}")
    return url


def pick_cover_reference_pages(pages: List[Page]) -> List[Page]:
    """
    从正文页中选取封面参考页：
    - 只选 page_type=CONTENT 且 image_url 非空的页面
    - 超过3页：取第一页、中间页、最后一页
    - 3页及以下：全选
    """
    content_pages = [
        p for p in pages
        if _page_type_value(p.page_type) == PageType.CONTENT.value and p.image_url
    ]
    if len(content_pages) <= 3:
        return content_pages
    mid = len(content_pages) // 2
    return [content_pages[0], content_pages[mid], content_pages[-1]]


def format_storyboard_for_prompt(storyboard: Optional[Storyboard]) -> str:
    """将页面分镜整理为图片生成 prompt 片段。"""
    if not storyboard:
        return ""
    return (
        f"Scene: {storyboard.get('scene', '')}\n"
        f"Characters: {storyboard.get('characters', '')}\n"
        f"Shot: {storyboard.get('shot', '')}\n"
        f"Color: {storyboard.get('color', '')}\n"
        f"Lighting: {storyboard.get('lighting', '')}"
    )


def build_cover_description(title: str, page: Page) -> str:
    """封面生成描述：优先使用封面文本，并纳入封面分镜。"""
    parts = [page.text or title]
    storyboard_desc = format_storyboard_for_prompt(page.storyboard)
    if storyboard_desc:
        parts.append(f"Cover storyboard:\n{storyboard_desc}")
    return "\n\n".join(part for part in parts if part)


async def upload_page_image_to_oss(
    storybook_id: int,
    page: Page,
) -> Page:
    """
    将单个页面的 image_url 上传到 OSS，并原地替换为 OSS 公开访问 URL
    """
    from app.services import oss_service

    url = page.image_url
    if not url:
        return page

    ext = ".png" if url.startswith("data:image/png") else ".jpg"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
    object_key = f"storybooks/{storybook_id}/page_{timestamp}{ext}"
    try:
        oss_url = await oss_service.upload_from_url(url, object_key)
        logger.info("图片上传OSS成功 | storybook_id=%s object_key=%s", storybook_id, object_key)
        page.image_url = oss_url
    except Exception as e:
        logger.warning("图片上传OSS失败，保留原URL | storybook_id=%s error=%s", storybook_id, e)
    return page


async def upload_pages_images_to_oss(
    storybook_id: int,
    pages: List[Page],
) -> List[Page]:
    """批量将页面 image_url 上传到 OSS。"""
    for page in pages:
        await upload_page_image_to_oss(storybook_id, page)
    return pages


async def create_page(session: AsyncSession, data: PageCreate) -> Page:
    """创建页面"""
    page = Page(
        storybook_id=data.storybook_id,
        page_index=data.page_index,
        image_url=data.image_url,
        text=data.text,
        page_type=PageType(data.page_type),
        status=PageStatus(data.status),
        error_message=data.error_message,
        storyboard=data.storyboard,
    )
    session.add(page)
    await session.flush()
    await session.refresh(page)
    return page


async def update_text(session: AsyncSession, page_id: int, data: TextUpdate) -> Optional[Page]:
    """更新页面文字"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    if data.text is not None:
        page.text = data.text

    await session.flush()
    await session.refresh(page)
    return page


async def update_base_image(session: AsyncSession, page_id: int, data: BaseImageUpdate) -> Optional[Page]:
    """替换基图（只更新 image_url，不触碰图层）"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    page.image_url = data.image_url
    page.status = PageStatus.FINISHED if data.image_url else PageStatus.PENDING
    page.error_message = None
    await session.flush()
    await session.refresh(page)
    return page


async def delete_page(session: AsyncSession, page_id: int) -> bool:
    """删除页面"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return False

    await session.delete(page)
    await session.flush()
    return True


def _page_type_value(page_type: PageType | str) -> str:
    return page_type.value if isinstance(page_type, PageType) else page_type


def _page_status_value(status: PageStatus | str) -> str:
    return status.value if isinstance(status, PageStatus) else status


def _find_content_page_index(content_pages: List[Page], page_id: int) -> int:
    for idx, content_page in enumerate(content_pages):
        if content_page.id == page_id:
            return idx
    raise ValueError("页面不属于正文页")


def _selected_reference_image_urls(
    pages: List[Page],
    reference_page_ids: Optional[List[int]],
) -> List[str]:
    if not reference_page_ids:
        return []
    selected_ids = set(reference_page_ids)
    return [
        page.image_url
        for page in pages
        if page.id in selected_ids
        and _page_type_value(page.page_type) == PageType.CONTENT.value
        and page.image_url
    ]


async def regenerate_page_async(
    page_id: int,
    user_id: int,
    regenerate_text: bool = False,
    text_instruction: str = "",
    regenerate_storyboard: bool = False,
    storyboard_instruction: str = "",
    regenerate_image: bool = True,
    image_instruction: str = "",
    reference_page_ids: Optional[List[int]] = None,
) -> Tuple[int, int]:
    """
    页面重新生成同步阶段：校验参数，设置绘本状态为 updating。
    返回 (storybook_id, page_id)。
    """
    if not (regenerate_text or regenerate_storyboard or regenerate_image):
        raise ValueError("请至少选择一项重新生成内容")

    async with async_session_maker() as session:
        page = await get_page_by_id(session, page_id)
        if not page:
            raise ValueError("页面不存在")

        if _page_type_value(page.page_type) == PageType.BACK_COVER.value:
            raise ValueError("封底页不支持 AI 重新生成，请使用图层工具编辑")

        result = await session.execute(
            select(Storybook).where(Storybook.id == page.storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook:
            raise ValueError("绘本不存在")

        if str(storybook.creator) != str(user_id):
            raise PermissionError("无权操作该绘本")

        if storybook.status in ("creating", "updating"):
            raise ValueError("绘本正在生成中，请稍后再试")

        if regenerate_image:
            await check_creation_points(user_id)

        storybook.status = "updating"
        storybook.error_message = None
        page.status = PageStatus.GENERATING
        page.error_message = None
        await session.commit()
        return storybook.id, page_id


async def run_regenerate_page_background(
    page_id: int,
    user_id: int,
    regenerate_text: bool = False,
    text_instruction: str = "",
    regenerate_storyboard: bool = False,
    storyboard_instruction: str = "",
    regenerate_image: bool = True,
    image_instruction: str = "",
    reference_page_ids: Optional[List[int]] = None,
) -> None:
    """
    页面重新生成后台任务。
    执行顺序：text -> storyboard -> image，不清空已有图层。
    """
    logger.info(
        "页面重新生成后台任务开始 | page_id=%s text=%s storyboard=%s image=%s",
        page_id, regenerate_text, regenerate_storyboard, regenerate_image,
    )

    storybook_id: Optional[int] = None
    try:
        async with async_session_maker() as session:
            page = await get_page_by_id(session, page_id)
            if not page:
                return

            storybook_id = page.storybook_id
            page.status = PageStatus.GENERATING
            page.error_message = None
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if not storybook:
                return
            storybook.status = "updating"
            storybook.error_message = None

            cli_type = storybook.cli_type
            aspect_ratio = storybook.aspect_ratio
            image_size = storybook.image_size
            title = storybook.title
            template: Optional[Template] = None
            if storybook.template_id:
                template_result = await session.execute(
                    select(Template).where(Template.id == storybook.template_id)
                )
                template = template_result.scalar_one_or_none()
            all_pages = list(storybook.pages)
            await session.commit()

        content_pages = [
            p for p in all_pages
            if _page_type_value(p.page_type) == PageType.CONTENT.value
        ]
        story_texts = [p.text for p in content_pages]
        page_type = _page_type_value(page.page_type)
        llm_client = LLMClientBase.get_client(cli_type)

        if regenerate_text:
            logger.info("重新生成页面文本 | page_id=%s", page_id)
            if page_type == PageType.COVER.value:
                new_text = await llm_client.regenerate_page_text(
                    current_text=page.text or title,
                    story_context=story_texts,
                    page_index=0,
                    instruction=text_instruction or "优化封面标题或封面文案，使其更适合作为绘本封面。",
                )
                page.text = new_text
            else:
                page_idx = _find_content_page_index(content_pages, page_id)
                new_text = await llm_client.regenerate_page_text(
                    current_text=page.text,
                    story_context=story_texts,
                    page_index=page_idx,
                    instruction=text_instruction,
                )
                page.text = new_text
                story_texts[page_idx] = new_text
                content_pages[page_idx].text = new_text

            async with async_session_maker() as session:
                await session.merge(page)
                await session.commit()

        if regenerate_storyboard:
            logger.info("重新生成页面分镜 | page_id=%s", page_id)
            if page_type == PageType.COVER.value:
                storyboard_text = page.text or title
                story_context = story_texts
                page_idx = 0
                instruction = storyboard_instruction or "生成适合作为绘本封面的构图分镜，主角突出，并预留标题空间。"
            else:
                page_idx = _find_content_page_index(content_pages, page_id)
                storyboard_text = page.text
                story_context = story_texts
                instruction = storyboard_instruction

            new_storyboard = await llm_client.regenerate_page_storyboard(
                page_text=storyboard_text,
                story_context=story_context,
                page_index=page_idx,
                instruction=instruction,
            )
            page.storyboard = new_storyboard

            async with async_session_maker() as session:
                await session.merge(page)
                await session.commit()

        if regenerate_image:
            logger.info("重新生成页面图片 | page_id=%s", page_id)
            async with async_session_maker() as session:
                page = await get_page_by_id(session, page_id)
                if not page:
                    return
                result = await session.execute(
                    select(Storybook).where(Storybook.id == storybook_id)
                )
                storybook = result.scalar_one_or_none()
                if not storybook:
                    return
                all_pages = list(storybook.pages)
                content_pages = [
                    p for p in all_pages
                    if _page_type_value(p.page_type) == PageType.CONTENT.value
                ]
                story_texts = [p.text for p in content_pages]

            page_type = _page_type_value(page.page_type)
            if page_type == PageType.COVER.value:
                if reference_page_ids:
                    ref_pages = [
                        p for p in content_pages
                        if p.id in set(reference_page_ids) and p.image_url
                    ]
                else:
                    ref_pages = pick_cover_reference_pages(content_pages)
                image_url = await llm_client.generate_cover(
                    title=title,
                    cover_text=build_cover_description(title, page),
                    reference_images=[p.image_url for p in ref_pages],
                    aspect_ratio=aspect_ratio,
                    image_size=image_size,
                    image_instruction=image_instruction,
                )
            else:
                page_idx = _find_content_page_index(content_pages, page_id)
                selected_reference_urls = _selected_reference_image_urls(content_pages, reference_page_ids)
                previous_page_image = (
                    content_pages[page_idx - 1].image_url
                    if page_idx > 0 and content_pages[page_idx - 1].image_url
                    else None
                )
                image_url = await llm_client.generate_page(
                    story_text=page.text,
                    storyboard=page.storyboard,
                    story_context=story_texts,
                    page_index=page_idx,
                    reference_images=selected_reference_urls or None,
                    previous_page_image=previous_page_image,
                    template=template,
                    aspect_ratio=aspect_ratio,
                    image_size=image_size,
                    image_instruction=image_instruction,
                )

            page.image_url = image_url
            page.status = PageStatus.FINISHED
            page.error_message = None
            await upload_page_image_to_oss(storybook_id, page)
            async with async_session_maker() as session:
                await session.merge(page)
                await session.commit()

            try:
                await consume_for_page_edit(user_id)
            except Exception as e:
                logger.warning("页面重新生成积分扣费失败 | user_id=%s error=%s", user_id, e)

        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                if not regenerate_image:
                    page = await get_page_by_id(session, page_id)
                    if page:
                        page.status = PageStatus.FINISHED
                        page.error_message = None
                await sync_storybook_status_from_pages(session, storybook_id)
                await session.commit()

        logger.info("页面重新生成完成 | page_id=%s storybook_id=%s", page_id, storybook_id)

    except LLMError as e:
        logger.warning("页面重新生成被拒绝 | page_id=%s error=%s", page_id, e.user_message)
        await _mark_storybook_regenerate_error(page_id, e.user_message)
    except Exception as e:
        logger.exception("页面重新生成失败 | page_id=%s error=%s", page_id, e)
        await _mark_storybook_regenerate_error(page_id, str(e)[:500])


async def sync_storybook_status_from_pages(
    session: AsyncSession,
    storybook_id: int,
    active_status: str = "updating",
    fallback_error: Optional[str] = None,
) -> Optional[Storybook]:
    """
    根据页面状态聚合绘本状态。
    - 任一页面 error -> storybook.error
    - 任一页面 pending/generating -> active_status
    - 全部 finished -> storybook.finished
    """
    result = await session.execute(
        select(Storybook).where(Storybook.id == storybook_id)
    )
    storybook = result.scalar_one_or_none()
    if not storybook:
        return None

    pages = list(storybook.pages or [])
    failed_pages = [p for p in pages if _page_status_value(p.status) == PageStatus.ERROR.value]
    active_pages = [
        p for p in pages
        if _page_status_value(p.status) in {PageStatus.PENDING.value, PageStatus.GENERATING.value}
    ]

    if failed_pages:
        storybook.status = "error"
        storybook.error_message = failed_pages[0].error_message or fallback_error or "页面生成失败"
    elif active_pages:
        storybook.status = active_status
        storybook.error_message = None
    else:
        storybook.status = "finished"
        storybook.error_message = None
    return storybook


async def _mark_storybook_regenerate_error(page_id: int, error_message: str) -> None:
    async with async_session_maker() as session:
        page = await get_page_by_id(session, page_id)
        if not page:
            return
        result = await session.execute(
            select(Storybook).where(Storybook.id == page.storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if storybook:
            page.status = PageStatus.ERROR
            page.error_message = error_message
            await sync_storybook_status_from_pages(session, page.storybook_id, fallback_error=error_message)
            await session.commit()
