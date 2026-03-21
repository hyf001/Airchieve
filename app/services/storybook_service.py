"""
Storybook Service
绘本服务
"""
from typing import Optional, List, Tuple
import asyncio
import time
import io
from datetime import datetime
from sqlalchemy import select
import httpx
from PIL import Image as PILImage, ImageDraw, ImageFont

from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.models.storybook import Storybook, StorybookPage, StorybookStatus
from app.models.template import Template
from app.models.enums import CliType, AspectRatio, ImageSize, PageType
from app.services.llm_cli import LLMClientBase, LLMError
from app.services.points_service import (
    check_creation_points,
    consume_for_creation,
    consume_for_page_edit,
)

logger = get_logger(__name__)


async def _upload_page_image_to_oss(
    storybook_id: int,
    page: StorybookPage
) -> StorybookPage:
    """
    将单个页面的 image_url 上传到 OSS，并替换为 OSS 公开访问 URL

    Args:
        storybook_id: 绘本ID
        page: 页面数据，包含 text 和 image_url
    Returns:
        StorybookPage: 更新了 image_url 的页面数据
    """
    from app.services import oss_service

    url = page.image_url
    if not url:
        return page

    # 根据 data URL 头或默认值决定扩展名
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
        return page
    except Exception as e:
        logger.warning("图片上传OSS失败，保留原URL | storybook_id=%s error=%s",
                      storybook_id, e)
        return page


async def _upload_pages_images_to_oss(
    storybook_id: int,
    pages: List[StorybookPage]
) -> List[StorybookPage]:
    """
    批量将每页的 image_url 上传到 OSS，并替换为 OSS 公开访问 URL

    Args:
        storybook_id: 绘本ID
        pages: 页面列表

    Returns:
        List[StorybookPage]: 更新了 image_url 的页面列表
    """
    results: List[StorybookPage] = []
    for page in pages:
        uploaded_page = await _upload_page_image_to_oss(storybook_id, page)
        results.append(uploaded_page)
    return results


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


async def _generate_storybook_content(
    storybook_id: int,
    instruction: str,
    template: Optional["Template"] = None,
    images: Optional[List[str]] = None,
    page_count: int = 10,
    aspect_ratio: str = "16:9",
    image_size: str = "1k",
    cli_type: CliType = CliType.GEMINI,
) -> None:
    """通用的绘本内容生成流程"""
    start_time = time.time()
    logger.info("开始生成绘本内容 | storybook_id=%s page_count=%d cli_type=%s", storybook_id, page_count, cli_type)

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
        llm_client = LLMClientBase.get_client(cli_type)

        # 第一步：生成故事和分镜（含标题）
        logger.info("第一步：生成故事文本和分镜 | storybook_id=%s", storybook_id)
        generated_title, story_texts, storyboards = await llm_client.create_story_and_storyboard(
            instruction=instruction,
            page_count=page_count,
            template=template,
            images=images,
        )

        if not story_texts:
            raise ValueError("未能生成故事文本")

        logger.info("故事文本和分镜生成完成 | storybook_id=%s count=%d title=%s", storybook_id, len(story_texts), generated_title)

        # 更新数据库中的故事标题（如果 AI 返回了标题）
        if generated_title:
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Storybook).where(Storybook.id == storybook_id)
                )
                storybook = result.scalar_one_or_none()
                if storybook:
                    storybook.title = generated_title
                    await session.commit()
                    logger.info("故事标题已更新 | storybook_id=%s title=%s", storybook_id, generated_title)

        # 第二步：逐页生成图片
        pages = []
        image_urls = []

        for i, (story_text, storyboard) in enumerate(zip(story_texts, storyboards)):
            # 检查是否中止
            if await _is_terminated(storybook_id):
                await _mark_terminated(storybook_id)
                logger.info("绘本生成已中止 | storybook_id=%s", storybook_id)
                return

            logger.info("生成第 %d 页图片 | storybook_id=%s", i + 1, storybook_id)

            # 生成单页
            image_url = await llm_client.generate_page(
                story_text=story_text,
                storyboard=storyboard,
                story_context=story_texts,
                page_index=i,
                reference_images=images,
                previous_page_image=image_urls[-1] if image_urls else None,
                template=template,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            )

            image_urls.append(image_url)

            # 上传OSS
            page = StorybookPage(text=story_text, image_url=image_url, storyboard=storyboard)
            oss_start = time.time()
            page = await _upload_page_image_to_oss(storybook_id, page)
            logger.info("第 %d 页图片上传OSS完成 | storybook_id=%s elapsed=%.2fs",
                       i + 1, storybook_id, time.time() - oss_start)

            # 添加到页面列表
            pages.append(page)

            # 立即更新数据库（增量更新）
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Storybook).where(Storybook.id == storybook_id)
                )
                storybook = result.scalar_one_or_none()
                if storybook:
                    storybook.pages = pages
                    await session.commit()
                    logger.info("更新数据库进度 | storybook_id=%s pages=%d", storybook_id, len(pages))

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
        logger.info("绘本生成完成 | storybook_id=%s pages_count=%s elapsed=%.2fs", storybook_id, len(pages) if pages else 0, elapsed)

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


# ============ 异步创建（轮询模式） ============

async def create_storybook_async(
    instruction: str,
    user_id: int,
    template_id: Optional[int] = None,
    cli_type: CliType = CliType.GEMINI,
    page_count: int = 10,
    aspect_ratio: AspectRatio = AspectRatio.RATIO_16_9,
    image_size: ImageSize = ImageSize.SIZE_1K,
) -> tuple[int, str, Optional[Template]]:
    """
    同步阶段：检查积分、解析模版、创建绘本记录。
    返回 (storybook_id, title, template, style_prefix) 供后台任务使用。
    积分不足时抛出 InsufficientPointsError。
    """
    await check_creation_points(user_id)

    template: Optional[Template] = None
    style_prefix = ""

    if template_id:
        async with async_session_maker() as session:
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                style_prefix = template.instruction if template.instruction else ""

    async with async_session_maker() as session:
        new_storybook = Storybook(
            title=instruction[:100] if len(instruction) > 100 else instruction,
            description=f"风格: {style_prefix}\n指令: {instruction}",
            creator=str(user_id),
            instruction=instruction,
            template_id=template_id,
            status="init"
        )
        session.add(new_storybook)
        await session.commit()
        await session.refresh(new_storybook)
        storybook_id = new_storybook.id
        title = new_storybook.title

    logger.info("绘本记���已创建（异步模式）| storybook_id=%s", storybook_id)
    return storybook_id, title, template


async def run_create_storybook_background(
    storybook_id: int,
    instruction: str,
    user_id: int,
    template: Optional[Template],
    images: Optional[List[str]],
    page_count: int = 10,
    aspect_ratio: str = "16:9",
    image_size: str = "1k",
    cli_type: CliType = CliType.GEMINI,
) -> None:
    """后台任务：执行绘本内容生成，生成完成后按页数扣除积分。"""
    logger.info("创建绘本后台任务开始 | storybook_id=%s cli_type=%s", storybook_id, cli_type)
    try:
        await asyncio.wait_for(
            _generate_storybook_content(
                storybook_id=storybook_id,
                instruction=instruction,
                template=template,
                images=images,
                page_count=page_count,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                cli_type=cli_type,
            ),
            timeout=900,
        )
        # 获取实际生成的页数作为积分消耗
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            page_count = len(storybook.pages) if storybook and storybook.pages else 1
        await consume_for_creation(user_id, page_count)
    except asyncio.TimeoutError:
        logger.error("创建绘本超时 | storybook_id=%s", storybook_id)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = "生成超时，请重试"
                await session.commit()
    except Exception as e:
        logger.exception("创建绘本后台任务异常 | storybook_id=%s error=%s", storybook_id, e)

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


# ============ 直接保存页面内容 ============

async def save_page_content(
    storybook_id: int,
    page_index: int,
    text: str,
    image_url: str,
) -> StorybookPage:
    """直接将指定页面内容写入数据库，不触发 AI 生成。
    若 image_url 为 base64 data URL，先上传 OSS 再保存 OSS URL。
    返回最终保存的页面数据。
    """
    # 如果是 base64 data URL，上传到 OSS
    final_image_url = image_url
    if image_url.startswith("data:"):
        from app.services import oss_service
        ext = ".png" if image_url.startswith("data:image/png") else ".jpg"
        ts = int(time.time() * 1000)
        object_key = f"storybooks/{storybook_id}/page_{page_index}_{ts}{ext}"
        try:
            final_image_url = await oss_service.upload_from_url(image_url, object_key)
        except Exception as e:
            logger.warning("图片上传OSS失败，保留base64 | page=%s error=%s", page_index, e)

    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook or not storybook.pages:
            raise ValueError("绘本不存在或无页面")
        if page_index < 0 or page_index >= len(storybook.pages):
            raise ValueError("页码无效")

        # 保留原有的 storyboard 和 page_type
        existing_page = storybook.pages[page_index]
        existing_storyboard = existing_page.storyboard if existing_page else None
        existing_page_type = existing_page.page_type if existing_page else PageType.CONTENT

        saved_page: StorybookPage = StorybookPage(
            text=text,
            image_url=final_image_url,
            storyboard=existing_storyboard,
            page_type=existing_page_type
        )
        pages = list(storybook.pages)
        pages[page_index] = saved_page
        storybook.pages = pages
        await session.commit()

    return saved_page


# ============ 删除页 ============

async def delete_page(
    storybook_id: int,
    page_index: int,
) -> Storybook:
    """删除指定页，至少保留 1 页。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook or not storybook.pages:
            raise ValueError("绘本不存在或无页面")
        if len(storybook.pages) <= 1:
            raise ValueError("至少保留 1 页，无法删除")
        if page_index < 0 or page_index >= len(storybook.pages):
            raise ValueError("页码无效")
        pages = list(storybook.pages)
        pages.pop(page_index)
        storybook.pages = pages
        await session.commit()
        await session.refresh(storybook)
        return storybook


# ============ 重新排序页 ============

async def reorder_pages(
    storybook_id: int,
    order: List[int],
) -> Storybook:
    """按 order 数组重新排列页面。order 为原下标的新排列，例如 [2,0,1]。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook or not storybook.pages:
            raise ValueError("绘本不存在或无页面")
        pages = storybook.pages
        if sorted(order) != list(range(len(pages))):
            raise ValueError("order 参数无效，必须是页面下标的完整排列")
        storybook.pages = [pages[i] for i in order]
        await session.commit()
        await session.refresh(storybook)
        return storybook


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
            reference_pages: List[StorybookPage] = [
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
        # 插入新页面的文本到上下文中
        for i, text in enumerate(story_texts):
            all_story_texts.insert(insert_position + i, text)

        # 提取前后参考图片（封面和封底不作为参考）
        reference_images = []
        if (insert_position > 0
            and reference_pages[insert_position - 1].image_url
            and reference_pages[insert_position - 1].page_type == PageType.CONTENT):
            reference_images.append(reference_pages[insert_position - 1].image_url)
        if (insert_position < len(reference_pages)
            and reference_pages[insert_position].image_url
            and reference_pages[insert_position].page_type == PageType.CONTENT):
            reference_images.append(reference_pages[insert_position].image_url)

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

            # 构建页面
            page = StorybookPage(text=story_text, image_url=image_url, storyboard=storyboard)
            new_pages.append(page)
            logger.info("插入页面进度 | storybook_id=%s current=%d total=%d", storybook_id, len(new_pages), count)

        # 上传OSS
        uploaded = await _upload_pages_images_to_oss(storybook_id, new_pages)

        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                pages = list(storybook.pages or [])
                # 在指定位置插入新页面
                for i, uploaded_page in enumerate(uploaded):
                    pages.insert(insert_position + i, uploaded_page)
                storybook.pages = pages
                storybook.status = "finished"
                storybook.error_message = None
                await session.commit()

        try:
            await consume_for_page_edit(user_id, count)
        except Exception as e:
            logger.warning("插入页面积分扣费失败 | user_id=%s error=%s", user_id, e)

        logger.info("插入页面后台任务完成 | storybook_id=%s new_pages=%s", storybook_id, len(uploaded))

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


async def update_storybook_pages(
    storybook_id: int,
    pages: List[StorybookPage]
) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()

        if not storybook:
            logger.warning("更新页面失败，绘本不存在 | storybook_id=%s", storybook_id)
            return False

        storybook.pages = pages
        storybook.status = "finished"
        await session.commit()

        logger.info("绘本页面更新成功 | storybook_id=%s pages_count=%s", storybook_id, len(pages))
        return True


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


# ============ PDF 生成 ============

async def _download_image(image_url: str, timeout: float = 30.0) -> Optional[bytes]:
    """下载图片并返回字节数据"""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            return response.content
    except Exception as e:
        logger.warning("下载图片失败 | url=%s error=%s", image_url, e)
        return None


def _get_chinese_font_size(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    """获取中文字体，支持不同大小"""
    font_paths = [
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STSong.ttc",
        # CentOS / RHEL / Fedora（dnf 安装路径）
        "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc",
        "/usr/share/fonts/wqy-microhei/wqy-microhei.ttc",
        "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/google-noto-cjk/NotoSansCJKsc-Regular.otf",
        # Debian / Ubuntu（apt 安装路径）
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        # Windows
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
    ]

    for font_path in font_paths:
        try:
            import os
            if not os.path.exists(font_path):
                continue
            # .ttc 是字体集合文件，PIL 需要指定 index
            if font_path.lower().endswith(".ttc"):
                return ImageFont.truetype(font_path, size, index=0)
            else:
                return ImageFont.truetype(font_path, size)
        except Exception:
            continue

    # 如果都失败了，使用默认字体
    return ImageFont.load_default()


async def generate_storybook_image(
    storybook_id: int,
    panel_width: int = 600,
    panel_height: int = 800,
) -> Optional[bytes]:
    """
    生成绘本横向长图：图片全屏铺满面板，底部渐变遮罩叠加白色文字，面板间留白间距。
    """
    storybook = await get_storybook(storybook_id)
    if not storybook or not storybook.pages:
        logger.warning("生成图片失败，绘本不存在或无页面 | storybook_id=%s", storybook_id)
        return None

    GAP = 16                          # 面板间距（px）
    BG_COLOR = (30, 30, 36)           # 画布背景色（深色）
    GRAD_RATIO = 0.42                 # 底部渐变区占面板高度比例
    grad_h = int(panel_height * GRAD_RATIO)

    padding = int(panel_width * 0.05)
    max_text_w = panel_width - padding * 2
    font_size = max(22, int(panel_height * 0.030))

    # 预生成底部渐变遮罩（RGBA：从全透明 → black/75）
    gradient = PILImage.new('RGBA', (panel_width, grad_h), (0, 0, 0, 0))
    draw_g = ImageDraw.Draw(gradient)
    for row in range(grad_h):
        alpha = int(192 * (row / grad_h))   # 0 → 192 ≈ black/75
        draw_g.line([(0, row), (panel_width - 1, row)], fill=(0, 0, 0, alpha))

    panels: list[PILImage.Image] = []

    for page in storybook.pages:
        text = page.text
        image_url = page.image_url

        # ── 底色（深色，letterbox 留边时可见）──────────────────
        panel = PILImage.new('RGB', (panel_width, panel_height), (20, 20, 28))

        # ── 故事图（全屏 letterbox，不裁剪）───────────────────
        if image_url:
            image_data = await _download_image(image_url)
            if image_data:
                try:
                    src = PILImage.open(io.BytesIO(image_data)).convert('RGB')
                    scale = min(panel_width / src.width, panel_height / src.height)
                    new_w = int(src.width * scale)
                    new_h = int(src.height * scale)
                    src = src.resize((new_w, new_h), PILImage.Resampling.LANCZOS)
                    x_off = (panel_width - new_w) // 2
                    y_off = (panel_height - new_h) // 2
                    panel.paste(src, (x_off, y_off))
                except Exception as e:
                    logger.warning("处理图片失败 | url=%s error=%s", image_url, e)

        # ── 底部渐变遮罩 ───────────────────────────────────────
        panel_rgba = panel.convert('RGBA')
        panel_rgba.paste(gradient, (0, panel_height - grad_h), gradient)
        panel = panel_rgba.convert('RGB')

        # ── 白色文字（居中，叠在渐变上）───────────────────────
        draw = ImageDraw.Draw(panel)
        font = _get_chinese_font_size(font_size)

        def wrap_text(t: str) -> list[str]:
            lines, cur = [], ""
            for ch in t:
                test = cur + ch
                w = draw.textbbox((0, 0), test, font=font)[2]
                if w > max_text_w and cur:
                    lines.append(cur)
                    cur = ch
                else:
                    cur = test
            if cur:
                lines.append(cur)
            return lines

        lines = wrap_text(text)
        line_h = draw.textbbox((0, 0), "测", font=font)[3] + int(font_size * 0.45)
        total_h = len(lines) * line_h
        # 文字垂直居中于渐变区下半部分
        grad_top = panel_height - grad_h
        y = grad_top + (grad_h - total_h) // 2
        y = max(grad_top + padding // 2, y)
        for line in lines:
            lw = draw.textbbox((0, 0), line, font=font)[2]
            x = (panel_width - lw) // 2
            # 轻微阴影增强可读性
            draw.text((x + 1, y + 1), line, font=font, fill=(0, 0, 0, 160))
            draw.text((x, y), line, font=font, fill=(255, 255, 255))
            y += line_h

        panels.append(panel)

    if not panels:
        return None

    # ── 拼接所有面板为横向长图（面板间加间距）─────────────────
    n = len(panels)
    total_w = panel_width * n + GAP * (n - 1)
    canvas = PILImage.new('RGB', (total_w, panel_height), BG_COLOR)
    for i, p in enumerate(panels):
        canvas.paste(p, (i * (panel_width + GAP), 0))

    out = io.BytesIO()
    canvas.save(out, format='JPEG', quality=92)
    logger.info("绘本长图生成成功 | storybook_id=%s panels=%s size=%s",
                storybook_id, len(panels), out.tell())
    return out.getvalue()


# ============ 封面生成 ============

def _pick_reference_pages(pages: List[StorybookPage]) -> List[StorybookPage]:
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

        cover_page = StorybookPage(
            text="",
            image_url=cover_image_url,
            page_type=PageType.COVER,
        )
        cover_page = await _upload_page_image_to_oss(storybook_id, cover_page)

        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if not storybook:
                return
            pages = list(storybook.pages or [])
            # 替换已有封面，或插入到最前面
            if pages and pages[0].page_type == PageType.COVER:
                pages[0] = cover_page
            else:
                pages.insert(0, cover_page)
            storybook.pages = pages
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
            back_cover_page = StorybookPage(
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
                pages = list(storybook.pages or [])
                # 将封底添加到最后一页
                pages.append(back_cover_page)
                storybook.pages = pages
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
