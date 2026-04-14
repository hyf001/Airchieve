"""
Storybook Service
绘本服务
"""
from typing import Optional, List, Tuple
import asyncio
import time
import io
from datetime import datetime
from sqlalchemy import select, update
import httpx
from PIL import Image as PILImage, ImageDraw, ImageFont

from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.models.storybook import Storybook, StorybookStatus
from app.models.page import Storyboard, Page
from app.schemas.page import StorybookPage
from app.models.template import Template
from app.models.enums import CliType, AspectRatio, ImageSize, PageType, StoryType, Language, AgeGroup
from app.services.llm_cli import LLMClientBase, LLMError
from app.services.points_service import (
    check_creation_points,
    consume_for_creation,
    consume_for_page_edit,
)

logger = get_logger(__name__)


async def _upload_page_image_to_oss(
    storybook_id: int,
    page: Page,
) -> Page:
    """
    将单个页面的 image_url 上传到 OSS，并原地替换为 OSS 公开访问 URL

    Args:
        storybook_id: 绘本ID
        page: Page ORM 对象（会原地修改 image_url）
    Returns:
        Page: 同一个 Page 对象（image_url 已更新）
    """
    from app.services import oss_service

    url = page.image_url
    if not url:
        return page

    if url.startswith("data:image/png"):
        ext = ".png"
    else:
        ext = ".jpg"

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
    object_key = f"storybooks/{storybook_id}/page_{timestamp}{ext}"
    try:
        oss_url = await oss_service.upload_from_url(url, object_key)
        logger.info("图片上传OSS成功 | storybook_id=%s object_key=%s",
                   storybook_id, object_key)
        page.image_url = oss_url
    except Exception as e:
        logger.warning("图片上传OSS失败，保留原URL | storybook_id=%s error=%s",
                      storybook_id, e)
    return page


async def _upload_pages_images_to_oss(
    storybook_id: int,
    pages: List[Page],
) -> List[Page]:
    """
    批量将每页的 image_url 上传到 OSS，原地修改

    Args:
        storybook_id: 绘本ID
        pages: Page ORM 对象列表

    Returns:
        List[Page]: 同一个列表（每个 page 的 image_url 已更新）
    """
    for page in pages:
        await _upload_page_image_to_oss(storybook_id, page)
    return pages


async def _is_terminated(storybook_id: int) -> bool:
    """检查绘本是否已中止"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook.status).where(Storybook.id == storybook_id)
        )
        status = result.scalar_one_or_none()
        return status == "terminated"


async def _mark_terminated(storybook_id: int) -> None:
    """标记绘本为已中止"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if storybook:
            storybook.status = "terminated"
            await session.commit()


# ============ 图片编辑（仅生成，不写库） ============

async def generate_edited_image(
    instruction: str,
    image_url: str,
    referenced_image: Optional[str],
    storybook_id: int,
    user_id: int,
) -> str:
    """调用 AI 仅生成新图片，不修改数据库，返回 base64 data URL。
    生成前检查积分，生成成功后扣除积分。
    从绘本获取 cli_type、aspect_ratio、image_size 配置。
    """
    from app.services.points_service import check_creation_points
    await check_creation_points(user_id)

    # 从绘本获取配置
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook:
            raise ValueError("绘本不存在")

        cli_type = storybook.cli_type if hasattr(storybook, 'cli_type') else CliType.GEMINI
        aspect_ratio = storybook.aspect_ratio if hasattr(storybook, 'aspect_ratio') else "16:9"
        image_size = storybook.image_size if hasattr(storybook, 'image_size') else "1k"

    llm_client = LLMClientBase.get_client(cli_type)
    result = await llm_client.edit_image(
        instruction=instruction,
        current_image_url=image_url,
        referenced_image=referenced_image,
        aspect_ratio=aspect_ratio,
        image_size=image_size,
    )
    try:
        await consume_for_page_edit(user_id)
    except Exception as e:
        logger.warning("图片编辑积分扣费失败 | user_id=%s error=%s", user_id, e)
    return result



# ============ 插入页面（异步轮询模式） ============

async def insert_pages_async(
    storybook_id: int,
    insert_position: int,
    count: int,
    instruction: str,
    user_id: int,
) -> None:
    """同步阶段：检查积分，校验参数，设置 status=updating。"""
    from app.services.points_service import check_creation_points
    await check_creation_points(user_id)

    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook or not storybook.pages:
            raise ValueError("绘本不存在或无页面")

        pages = storybook.pages
        page_count = len(pages)

        # 检查封面和封底位置
        has_cover = pages[0].page_type == PageType.COVER if pages else False
        has_back_cover = pages[-1].page_type == PageType.BACK_COVER if pages else False

        # 计算有效的插入位置范围
        min_position = 1 if has_cover else 0
        max_position = page_count - 1 if has_back_cover else page_count

        if insert_position < min_position or insert_position > max_position:
            if has_cover and has_back_cover:
                raise ValueError(f"插入位置 {insert_position} 无效，不能在封面前或封底后，应在 {min_position}-{max_position} 之间")
            elif has_cover:
                raise ValueError(f"插入位置 {insert_position} 无效，不能在封面前，应在 {min_position}-{max_position} 之间")
            elif has_back_cover:
                raise ValueError(f"插入位置 {insert_position} 无效，不能在封底后，应在 {min_position}-{max_position} 之间")
            else:
                raise ValueError(f"插入位置 {insert_position} 无效，应在 {min_position}-{max_position} 之间")

        storybook.status = "updating"
        await session.commit()


async def run_insert_pages_background(
    storybook_id: int,
    insert_position: int,
    count: int,
    instruction: str,
    user_id: int,
) -> None:
    """后台任务：在指定位置插入 count 张新页面，成功后扣积分。"""
    logger.info("插入页面后台任务开始 | storybook_id=%s insert_position=%s count=%s", storybook_id, insert_position, count)
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if not storybook or not storybook.pages:
                return
            # 获取所有页面作为参考（排除封面和封底）
            reference_pages: List[Page] = [
                p for p in storybook.pages
                if p.page_type not in (PageType.COVER, PageType.BACK_COVER)
            ]

            # 获取模板（如果有）
            template = None
            if storybook.template_id:
                template_result = await session.execute(
                    select(Template).where(Template.id == storybook.template_id)
                )
                template = template_result.scalar_one_or_none()

            # 获取绘本的cli_type、aspect_ratio和image_size
            cli_type = storybook.cli_type if hasattr(storybook, 'cli_type') else CliType.GEMINI
            aspect_ratio = storybook.aspect_ratio if hasattr(storybook, 'aspect_ratio') else "16:9"
            image_size = storybook.image_size if hasattr(storybook, 'image_size') else "1k"

        llm_client = LLMClientBase.get_client(cli_type)

        # 第一步：生成插入页的故事和分镜
        story_texts, storyboards = await llm_client.create_insertion_story_and_storyboard(
            pages=reference_pages,
            insert_position=insert_position,
            count=count,
            instruction=instruction,
            template=template,
        )

        if not story_texts:
            raise ValueError("未能生成插入页面故事文本")

        logger.info("插入页面故事文本和分镜生成完成 | storybook_id=%s count=%d", storybook_id, len(story_texts))

        # 第二步：逐页生成图片
        new_pages = []
        image_urls = []

        # 构建完整故事上下文
        all_story_texts = [page.text for page in reference_pages]
        # 将 insert_position（基于全页列表含封面）转换为 reference_pages 的索引
        has_cover = bool(storybook.pages) and storybook.pages[0].page_type == PageType.COVER
        ref_insert_position = insert_position - (1 if has_cover else 0)
        # 插入新页面的文本到上下文中
        for i, text in enumerate(story_texts):
            all_story_texts.insert(ref_insert_position + i, text)

        # 提取前后参考图片（封面和封底不作为参考）
        reference_images = []
        if (ref_insert_position > 0
            and reference_pages[ref_insert_position - 1].image_url
            and reference_pages[ref_insert_position - 1].page_type == PageType.CONTENT):
            reference_images.append(reference_pages[ref_insert_position - 1].image_url)
        if (ref_insert_position < len(reference_pages)
            and reference_pages[ref_insert_position].image_url
            and reference_pages[ref_insert_position].page_type == PageType.CONTENT):
            reference_images.append(reference_pages[ref_insert_position].image_url)

        for i, (story_text, storyboard) in enumerate(zip(story_texts, storyboards)):
            # 检查是否中止
            if await _is_terminated(storybook_id):
                await _mark_terminated(storybook_id)
                logger.info("插入页面生成已中止 | storybook_id=%s", storybook_id)
                return

            logger.info("生成插入页面第 %d 页图片 | storybook_id=%s", i + 1, storybook_id)

            # 生成单页
            image_url = await llm_client.generate_page(
                story_text=story_text,
                storyboard=storyboard,
                story_context=all_story_texts,
                page_index=insert_position + i,
                reference_images=reference_images,
                previous_page_image=image_urls[-1] if image_urls else None,
                template=template,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            )

            image_urls.append(image_url)

            # 构建页面 ORM 对象
            new_page = Page(
                storybook_id=storybook_id,
                page_index=0,  # 稍后统一调整
                text=story_text,
                image_url=image_url,
                storyboard=storyboard,
            )
            new_pages.append(new_page)
            logger.info("插入页面进度 | storybook_id=%s current=%d total=%d", storybook_id, len(new_pages), count)

        # 上传OSS
        await _upload_pages_images_to_oss(storybook_id, new_pages)

        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                # 将现有页面 page_index 后移，腾出位置
                existing_pages = list(storybook.pages)
                for ep in existing_pages:
                    if ep.page_index >= insert_position:
                        ep.page_index += count

                # 插入新页面并设置正确的 page_index
                for i, new_page in enumerate(new_pages):
                    new_page.storybook_id = storybook_id
                    new_page.page_index = insert_position + i
                    session.add(new_page)

                storybook.status = "finished"
                storybook.error_message = None
                await session.commit()

        try:
            await consume_for_page_edit(user_id, count)
        except Exception as e:
            logger.warning("插入页面积分扣费失败 | user_id=%s error=%s", user_id, e)

        logger.info("插入页面后台任务完成 | storybook_id=%s new_pages=%s", storybook_id, len(new_pages))

    except asyncio.TimeoutError:
        logger.error("插入页面生成超时 | storybook_id=%s", storybook_id)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = "生成超时，请重试"
                await session.commit()
    except LLMError as e:
        logger.warning("插入页面生成被拒绝 | storybook_id=%s error_type=%s user_message=%s",
                       storybook_id, e.error_type, e.user_message)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = e.user_message
                await session.commit()
    except Exception as e:
        logger.exception("插入页面后台任务异常 | storybook_id=%s error=%s", storybook_id, e)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = str(e)[:500]
                await session.commit()


# ============ 查询 ============

async def get_storybook(storybook_id: int) -> Optional[Storybook]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        return result.scalar_one_or_none()


async def get_storybook_status(storybook_id: int) -> Optional[dict]:
    """查询绘本状态和页面进度，不加载 page 对象"""
    from sqlalchemy import func as sa_func

    async with async_session_maker() as session:
        result = await session.execute(
            select(
                Storybook.id,
                Storybook.status,
                Storybook.error_message,
                Storybook.updated_at,
            ).where(Storybook.id == storybook_id)
        )
        row = result.one_or_none()
        if row is None:
            return None

        # 轻量 COUNT 查询页面进度
        total = (await session.execute(
            select(sa_func.count()).select_from(Page).where(Page.storybook_id == storybook_id)
        )).scalar_one()
        completed = (await session.execute(
            select(sa_func.count()).select_from(Page).where(
                Page.storybook_id == storybook_id,
                Page.image_url != "",
            )
        )).scalar_one()

        return {
            "id": row.id,
            "status": row.status,
            "error_message": row.error_message,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "total_pages": total,
            "completed_pages": completed,
        }


# ============ 状态更新 ============

async def update_storybook_status(
    storybook_id: int,
    status: str,
    error_message: Optional[str] = None,
) -> None:
    """更新绘本状态"""
    async with async_session_maker() as session:
        values: dict = {"status": status}
        if error_message is not None:
            values["error_message"] = error_message
        await session.execute(
            update(Storybook).where(Storybook.id == storybook_id).values(**values)
        )
        await session.commit()


# ============ 中止功能 ============

async def terminate_storybook(storybook_id: int) -> bool:
    """中止正在生成的绘本"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook:
            return False

        if storybook.status in ["creating", "updating"]:
            storybook.status = "terminated"
            await session.commit()
            logger.info("绘本已标记为中止 | storybook_id=%s", storybook_id)
            return True
        return False


async def list_storybooks(
    creator: Optional[str] = None,
    title: Optional[str] = None,
    status: Optional[str] = None,
    is_public: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Storybook]:
    from sqlalchemy import desc

    async with async_session_maker() as session:
        query = select(Storybook).order_by(desc(Storybook.created_at))

        if creator:
            query = query.where(Storybook.creator == creator)
        if title:
            query = query.where(Storybook.title.like(f"%{title}%"))
        if status:
            query = query.where(Storybook.status == status)
        if is_public is not None:
            query = query.where(Storybook.is_public == is_public)

        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        storybooks = result.scalars().all()

        return list(storybooks)



# ============ 封面生成 ============

def _pick_reference_pages(pages: List[Page]) -> List[Page]:
    """
    从内页中选取参考页：
    - 超过3页：取第一页、中间页、最后一页
    - 3页及以下：全选
    只取 page_type == CONTENT 的页面。
    """
    content_pages = [p for p in pages if p.page_type == PageType.CONTENT]
    if not content_pages:
        # 降级：所有页面都算
        content_pages = list(pages)

    n = len(content_pages)
    if n <= 3:
        return content_pages
    mid = n // 2
    return [content_pages[0], content_pages[mid], content_pages[-1]]


async def generate_cover_async(
    storybook_id: int,
    user_id: int,
    selected_page_indices: Optional[List[int]] = None,
) -> None:
    """
    手动触发封面生成（异步，由后台任务调用）。
    若提供 selected_page_indices，则使用用户指定的页面作为参考图；
    否则自动选取首/中/尾3张。
    封面文字使用绘本标题。
    生成后插入/替换 pages[0]（page_type=COVER）。
    """
    await check_creation_points(user_id)

    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook:
            raise ValueError("绘本不存在")
        if not storybook.pages:
            raise ValueError("绘本暂无页面，无法生成封面")

        cli_type = storybook.cli_type
        aspect_ratio = storybook.aspect_ratio
        image_size = storybook.image_size
        title = storybook.title
        pages_snapshot = list(storybook.pages)

        storybook.status = "updating"
        await session.commit()

    try:
        if selected_page_indices is not None:
            # 用户手动选择的页面（过滤越界索引）
            reference_image_urls = [
                pages_snapshot[i].image_url
                for i in selected_page_indices
                if 0 <= i < len(pages_snapshot)
            ]
        else:
            reference_pages = _pick_reference_pages(pages_snapshot)
            reference_image_urls = [p.image_url for p in reference_pages]

        logger.info(
            "封面生成：选取参考页 %d 张 | storybook_id=%s",
            len(reference_image_urls), storybook_id,
        )

        llm_client = LLMClientBase.get_client(cli_type)
        cover_image_url = await llm_client.generate_cover(
            title=title,
            cover_text=title,
            reference_images=reference_image_urls,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        )

        cover_page = Page(
            storybook_id=storybook_id,
            page_index=0,
            text="",
            image_url=cover_image_url,
            page_type=PageType.COVER,
        )
        await _upload_page_image_to_oss(storybook_id, cover_page)

        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if not storybook:
                return

            # 替换已有封面，或插入到最前面
            existing_pages = list(storybook.pages)
            if existing_pages and existing_pages[0].page_type == PageType.COVER:
                existing_pages[0].text = cover_page.text
                existing_pages[0].image_url = cover_page.image_url
            else:
                # 其他页面 page_index 后移
                for ep in existing_pages:
                    ep.page_index += 1
                cover_page.storybook_id = storybook_id
                cover_page.page_index = 0
                session.add(cover_page)

            storybook.status = "finished"
            await session.commit()

        logger.info("封面生成完成 | storybook_id=%s", storybook_id)

    except LLMError as e:
        logger.warning("封面生成被拒绝 | storybook_id=%s error=%s", storybook_id, e.user_message)
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = e.user_message
                await session.commit()
        raise
    except Exception as e:
        logger.exception("封面生成失败 | storybook_id=%s error=%s", storybook_id, e)
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = str(e)[:500]
                await session.commit()
        raise


async def run_generate_cover_background(
    storybook_id: int,
    user_id: int,
    selected_page_indices: Optional[List[int]] = None,
) -> None:
    """后台任务入口，吞掉异常（已写入 error_message）"""
    try:
        await generate_cover_async(storybook_id, user_id, selected_page_indices)
    except Exception:
        pass


async def generate_back_cover_async(
    storybook_id: int,
    image_data: str,
) -> None:
    """
    生成封底（同步）。
    封底使用前端传来的 base64 图片，直接插入到绘本最后一页。
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook:
            raise ValueError("绘本不存在")
        if not storybook.pages:
            raise ValueError("绘本暂无页面，无法生成封底")

        # 检查是否已有封底
        if any(p.page_type == PageType.BACK_COVER for p in storybook.pages):
            raise ValueError("封底已存在，不能重复生成")

        storybook.status = "updating"
        await session.commit()

        try:
            # 上传图片到 OSS
            from app.services import oss_service

            # 从 base64 data URL 中确定文件扩展名
            if image_data.startswith('data:image'):
                ext = '.png' if 'png' in image_data else '.jpg'
            else:
                raise ValueError("无效的图片数据格式")

            timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
            object_key = f"storybooks/{storybook_id}/backcover_{timestamp}{ext}"

            # 上传到 OSS
            oss_url = await oss_service.upload_from_url(image_data, object_key)
            logger.info("封底图片上传OSS成功 | storybook_id=%s object_key=%s",
                       storybook_id, object_key)

            # 创建封底页面
            back_cover_page = Page(
                storybook_id=storybook_id,
                page_index=0,  # 稍后设置
                text="",
                image_url=oss_url,
                page_type=PageType.BACK_COVER,
            )

            async with async_session_maker() as session:
                result = await session.execute(
                    select(Storybook).where(Storybook.id == storybook_id)
                )
                storybook = result.scalar_one_or_none()
                if not storybook:
                    return
                # 设置 page_index 为最后
                back_cover_page.storybook_id = storybook_id
                back_cover_page.page_index = len(storybook.pages)
                session.add(back_cover_page)
                storybook.status = "finished"
                await session.commit()

            logger.info("封底创建成功 | storybook_id=%s", storybook_id)

        except Exception as e:
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Storybook).where(Storybook.id == storybook_id)
                )
                storybook = result.scalar_one_or_none()
                if storybook:
                    storybook.status = "error"
                    storybook.error_message = f"封底生成失败: {str(e)}"
                    await session.commit()
            logger.error("封底生成失败 | storybook_id=%s error=%s", storybook_id, e)
            raise


# ============ 创建故事（仅文本） ============

async def create_story_only(
    instruction: str,
    word_count: int = 500,
    story_type: StoryType = StoryType.FAIRY_TALE,
    language: Language = Language.ZH,
    age_group: AgeGroup = AgeGroup.AGE_3_6,
    cli_type: CliType = CliType.GEMINI,
) -> Tuple[str, str]:
    """
    创建纯文本故事（不含分镜和图片）

    Args:
        instruction: 用户指令/故事描述
        word_count: 目标字数
        story_type: 故事类型
        language: 语言
        age_group: 年龄组
        cli_type: CLI类型

    Returns:
        Tuple[str, str]: (故事标题, 故事内容)
    """
    logger.info("开始创建故事 | instruction=%s word_count=%d story_type=%s",
               instruction[:50], word_count, story_type)

    llm_client = LLMClientBase.get_client(cli_type)
    title, content = await llm_client.create_story(
        instruction=instruction,
        word_count=word_count,
        story_type=story_type,
        language=language,
        age_group=age_group,
    )

    logger.info("故事创建完成 | title=%s content_length=%d", title, len(content))
    return title, content


# ============ 生成分镜（仅分镜，不保存） ============

async def create_storyboard_only(
    story_content: str,
    page_count: int = 10,
    cli_type: CliType = CliType.GEMINI,
) -> Tuple[List[str], List[Optional[Storyboard]]]:
    """
    仅生成分镜，不保存数据库

    Args:
        story_content: 故事内容
        page_count: 页数
        cli_type: CLI类型

    Returns:
        Tuple[List[str], List[Optional[Storyboard]]]: (每页文字列表, 分镜列表)
    """
    logger.info("开始生成分镜 | page_count=%d content_length=%d", page_count, len(story_content))

    llm_client = LLMClientBase.get_client(cli_type)
    story_texts, storyboards = await llm_client.create_storyboard_from_story(
        story_content=story_content,
        page_count=page_count,
    )

    logger.info("分镜生成完成 | count=%d", len(story_texts))
    return story_texts, storyboards


# ============ 基于故事创建绘本（分镜+图片） ============

async def create_storybook_from_story_async(
    title: str,
    description: str,
    user_id: int,
    pages: List[StorybookPage],
    template_id: Optional[int] = None,
    cli_type: CliType = CliType.GEMINI,
    aspect_ratio: AspectRatio = AspectRatio.RATIO_16_9,
    image_size: ImageSize = ImageSize.SIZE_1K,
) -> tuple[int, str, Optional[Template]]:
    """
    基于已有的故事和分镜创建绘本（同步阶段）

    在创建时就把 pages（包含 text 和 storyboard）保存到数据库，
    此时 image_url 为空。后台任务只负责生成图片。

    Args:
        title: 绘本标题
        description: 绘本描述/用户原始输入
        user_id: 用户ID
        pages: 页面列表（包含文本和分镜）
        template_id: 模板ID（可选）
        cli_type: CLI类型
        aspect_ratio: 图片比例
        image_size: 图片尺寸

    Returns:
        tuple[int, str, Optional[Template]]: (绘本ID, 标题, 模板)
    """
    await check_creation_points(user_id)

    template: Optional[Template] = None
    if template_id:
        async with async_session_maker() as session:
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()

    # 创建 Storybook 先获取 ID，再构建 Page ORM 对象
    async with async_session_maker() as session:
        new_storybook = Storybook(
            title=title,
            description=description,
            creator=str(user_id),
            instruction=description,
            template_id=template_id,
            cli_type=cli_type,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
            status="init"
        )
        session.add(new_storybook)
        await session.flush()
        storybook_id = new_storybook.id

        # 创建 Page ORM 对象
        for i, page in enumerate(pages):
            page_obj = Page(
                storybook_id=storybook_id,
                page_index=i,
                text=page.text,
                image_url="",
                storyboard=page.storyboard,
                page_type=PageType.CONTENT,
            )
            session.add(page_obj)

        await session.commit()
        await session.refresh(new_storybook)

    logger.info("绘本记录和分镜已保存 | storybook_id=%s pages=%d", storybook_id, len(pages))
    return storybook_id, title, template


async def run_create_storybook_from_story_background(
    storybook_id: int,
    user_id: int,
    template: Optional[Template],
    aspect_ratio: str = "16:9",
    image_size: str = "1k",
    cli_type: CliType = CliType.GEMINI,
    images: Optional[List[str]] = None,
) -> None:
    """
    后台任务：为已有分镜的绘本生成图片

    从数据库读取已有的 pages（包含 text 和 storyboard），
    逐页生成图片并更新 image_url。

    Args:
        storybook_id: 绘本ID
        user_id: 用户ID
        template: 模板对象（可选）
        aspect_ratio: 图片比例
        image_size: 图片尺寸
        cli_type: CLI类型
        images: 参考图片（可选）
    """
    logger.info("基于故事创建绘本后台任务开始 | storybook_id=%s", storybook_id)
    start_time = time.time()

    # 从数据库读取绘本和已有的分镜
    storybook = await get_storybook(storybook_id)
    if not storybook:
        logger.error("绘本不存在 | storybook_id=%s", storybook_id)
        return

    # 更新状态为 creating
    await update_storybook_status(storybook_id, "creating")

    # 获取已有的 pages
    pages = storybook.pages or []

    if not pages:
        logger.error("绘本没有页面数据 | storybook_id=%s", storybook_id)
        await update_storybook_status(storybook_id, "error", error_message="没有页面数据")
        return

    try:
        llm_client = LLMClientBase.get_client(cli_type)
        # 从 pages 中提取故事文本列表（用于上下文）
        logger.info("提取故事文本和分镜信息 | storybook_id=%s pages=%d", storybook_id, len(pages))
        story_texts = [page.text for page in pages]
        logger.info("开始生成绘本图片 | storybook_id=%s", storybook_id)

        # 逐页生成图片并更新
        image_urls = []

        for i, page in enumerate(pages):
            # 检查是否中止
            if await _is_terminated(storybook_id):
                await _mark_terminated(storybook_id)
                logger.info("绘本生成已中止 | storybook_id=%s", storybook_id)
                return

            logger.info("生成第 %d 页图片 | storybook_id=%s", i + 1, storybook_id)

            # 生成单页图片
            image_url = await llm_client.generate_page(
                story_text=page.text,
                storyboard=page.storyboard,
                story_context=story_texts,
                page_index=i,
                reference_images=images,
                previous_page_image=image_urls[-1] if image_urls else None,
                template=template,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            )

            image_urls.append(image_url)

            # 上传OSS（直接修改 Page ORM 的 image_url）
            oss_start = time.time()
            page.image_url = image_url
            await _upload_page_image_to_oss(storybook_id, page)
            logger.info("第 %d 页图片上传OSS完成 | storybook_id=%s elapsed=%.2fs",
                       i + 1, storybook_id, time.time() - oss_start)

            # 立即更新数据库（增量更新）
            async with async_session_maker() as session:
                merged_page = await session.merge(page)
                await session.commit()
                logger.info("更新数据库进度 | storybook_id=%s pages=%d", storybook_id, i + 1)

        # 所有页面生成完成，更新状态为 finished
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "finished"
                storybook.error_message = None
                await session.commit()

        elapsed = time.time() - start_time
        logger.info("绘本生成完成 | storybook_id=%s pages_count=%s elapsed=%.2fs",
                   storybook_id, len(pages), elapsed)

        # 扣除积分
        try:
            await consume_for_creation(user_id, len(pages))
        except Exception as e:
            logger.warning("积分扣费失败 | user_id=%s error=%s", user_id, e)

    except LLMError as e:
        logger.warning("绘本生成被拒绝 | storybook_id=%s error_type=%s user_message=%s",
                       storybook_id, e.error_type, e.user_message)
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = e.user_message
                await session.commit()
    except Exception as e:
        logger.exception("绘本生成失败 | storybook_id=%s error=%s", storybook_id, e)
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = str(e)[:500]
                await session.commit()

