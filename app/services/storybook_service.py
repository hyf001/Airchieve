"""
Storybook Service
绘本服务
"""
from typing import Optional, List, Tuple
import asyncio
import time
import io
from sqlalchemy import select, update
import httpx
from PIL import Image as PILImage, ImageDraw, ImageFont

from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.models.storybook import Storybook, StorybookStatus
from app.models.page import Storyboard, Page
from app.schemas.page import PageCreate, StorybookPage
from app.models.template import Template
from app.models.enums import CliType, AspectRatio, ImageSize, PageStatus, PageType, StoryType, Language, AgeGroup
from app.services.llm_cli import LLMClientBase, LLMError
from app.services import page_service
from app.services.image_style_service import (
    get_style_version_for_generation,
    validate_style_available,
)
from app.services.points_service import (
    check_creation_points,
    consume_for_creation,
    consume_for_page_edit,
)

logger = get_logger(__name__)


def _page_type_value(page_type: PageType | str) -> str:
    return page_type.value if isinstance(page_type, PageType) else page_type


def build_cover_storyboard(
    title: str,
    story_content: str,
    content_storyboards: List[Optional[Storyboard]],
) -> Storyboard:
    """基于正文分镜生成封面分镜占位，供用户在确认阶段编辑。"""
    first_storyboard = next((sb for sb in content_storyboards if sb), None)
    return {
        "scene": f"概括《{title}》核心故事的封面场景，体现整本绘本最重要的情境。{story_content[:80]}",
        "characters": (
            first_storyboard.get("characters", "")
            if first_storyboard
            else "主角以温暖、清晰、有吸引力的姿态出现在画面中心"
        ),
        "shot": "封面式构图，主角突出，画面有层次，并预留书名艺术字空间",
        "color": (
            first_storyboard.get("color", "")
            if first_storyboard
            else "温暖明亮、适合儿童绘本的主色调"
        ),
        "lighting": (
            first_storyboard.get("lighting", "")
            if first_storyboard
            else "柔和、有童话感的光线，突出封面主体"
        ),
    }


def _build_storyboard_complexity_hint(style_summary: Optional[str]) -> str:
    """根据画风摘要给分镜阶段一个轻量复杂度建议。"""
    if not style_summary:
        return "按儿童绘本常规复杂度安排镜头，保持画面清晰易读。"
    summary = style_summary.lower()
    simple_keywords = ["极简", "简笔", "涂鸦", "低龄", "扁平", "simple", "minimal", "doodle"]
    if any(keyword in summary for keyword in simple_keywords):
        return "画风偏极简或低龄，分镜应减少复杂镜头、强光影和拥挤构图，优先清楚的主体动作。"
    return "保持适中画面层次，分镜复杂度服务于故事，不额外增加与故事无关的视觉元素。"


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
            for page in storybook.pages or []:
                if (
                    _page_type_value(page.page_type) in (PageType.COVER.value, PageType.CONTENT.value)
                    and page.status == PageStatus.GENERATING.value
                ):
                    page.status = PageStatus.PENDING
                    page.error_message = None
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
        has_cover = _page_type_value(pages[0].page_type) == PageType.COVER.value if pages else False
        has_back_cover = _page_type_value(pages[-1].page_type) == PageType.BACK_COVER.value if pages else False

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
                if _page_type_value(p.page_type) not in (PageType.COVER.value, PageType.BACK_COVER.value)
            ]

            # 获取模板（如果有）
            template = None
            if storybook.template_id:
                template_result = await session.execute(
                    select(Template).where(Template.id == storybook.template_id)
                )
                template = template_result.scalar_one_or_none()
            image_style_version_id = storybook.image_style_version_id

            # 获取绘本的cli_type、aspect_ratio和image_size
            cli_type = storybook.cli_type if hasattr(storybook, 'cli_type') else CliType.GEMINI
            aspect_ratio = storybook.aspect_ratio if hasattr(storybook, 'aspect_ratio') else "16:9"
            image_size = storybook.image_size if hasattr(storybook, 'image_size') else "1k"

        llm_client = LLMClientBase.get_client(cli_type)
        image_style_version = (
            await get_style_version_for_generation(image_style_version_id)
            if image_style_version_id
            else None
        )

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
        has_cover = bool(storybook.pages) and _page_type_value(storybook.pages[0].page_type) == PageType.COVER.value
        ref_insert_position = insert_position - (1 if has_cover else 0)
        # 插入新页面的文本到上下文中
        for i, text in enumerate(story_texts):
            all_story_texts.insert(ref_insert_position + i, text)

        # 提取前后参考图片（封面和封底不作为参考）
        reference_images = []
        if (ref_insert_position > 0
            and reference_pages[ref_insert_position - 1].image_url
            and _page_type_value(reference_pages[ref_insert_position - 1].page_type) == PageType.CONTENT.value):
            reference_images.append(reference_pages[ref_insert_position - 1].image_url)
        if (ref_insert_position < len(reference_pages)
            and reference_pages[ref_insert_position].image_url
            and _page_type_value(reference_pages[ref_insert_position].page_type) == PageType.CONTENT.value):
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
                character_reference_images=reference_images,
                previous_page_image=image_urls[-1] if image_urls else None,
                template=template,
                image_style_version=image_style_version,
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
                page_type=PageType.CONTENT,
                status=PageStatus.FINISHED,
                error_message=None,
                storyboard=storyboard,
            )
            new_pages.append(new_page)
            logger.info("插入页面进度 | storybook_id=%s current=%d total=%d", storybook_id, len(new_pages), count)

        # 上传OSS
        await page_service.upload_pages_images_to_oss(storybook_id, new_pages)

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
    """查询绘本状态和页面进度，包含页面简要状态列表"""
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

        # 查询所有页面的简要状态（按 page_index 排序）
        pages_result = await session.execute(
            select(
                Page.id,
                Page.page_index,
                Page.page_type,
                Page.status,
                Page.image_url,
            )
            .where(Page.storybook_id == storybook_id)
            .order_by(Page.page_index)
        )
        pages = [
            {
                "id": p.id,
                "page_index": p.page_index,
                "page_type": p.page_type,
                "status": p.status,
                "image_url": p.image_url if p.status == PageStatus.FINISHED.value else None,
            }
            for p in pages_result.all()
        ]

        # 从已查询的 pages 列表计算进度，封底是固定底图不计入
        generatable_types = {PageType.COVER.value, PageType.CONTENT.value}
        generatable_pages = [p for p in pages if p["page_type"] in generatable_types]

        return {
            "id": row.id,
            "status": row.status,
            "error_message": row.error_message,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "total_pages": len(generatable_pages),
            "completed_pages": sum(1 for p in generatable_pages if p["status"] == PageStatus.FINISHED.value),
            "generating_pages": sum(1 for p in generatable_pages if p["status"] == PageStatus.GENERATING.value),
            "failed_pages": sum(1 for p in generatable_pages if p["status"] == PageStatus.ERROR.value),
            "pages": pages,
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
    image_style_id: int | None = None,
) -> Tuple[List[str], List[Optional[Storyboard]]]:
    """
    仅生成分镜，不保存数据库

    Args:
        story_content: 故事内容
        page_count: 页数
        cli_type: CLI类型
        image_style_id: 图片风格ID

    Returns:
        Tuple[List[str], List[Optional[Storyboard]]]: (每页文字列表, 分镜列表)
    """
    logger.info("开始生成分镜 | page_count=%d content_length=%d", page_count, len(story_content))

    if image_style_id is None:
        raise ValueError("请选择画风")
    style, style_version = await validate_style_available(image_style_id)

    llm_client = LLMClientBase.get_client(cli_type)
    story_texts, storyboards = await llm_client.create_storyboard_from_story(
        story_content=story_content,
        page_count=page_count,
        style_name=style.name,
        style_summary=style_version.style_summary,
        storyboard_complexity=_build_storyboard_complexity_hint(style_version.style_summary),
    )

    logger.info("分镜生成完成 | count=%d", len(story_texts))
    return story_texts, storyboards


# ============ 基于故事创建绘本（分镜+图片） ============

async def create_storybook_from_story_async(
    title: str,
    description: str,
    user_id: int,
    pages: List[StorybookPage],
    image_style_id: int | None = None,
    cli_type: CliType = CliType.GEMINI,
    aspect_ratio: AspectRatio = AspectRatio.RATIO_16_9,
    image_size: ImageSize = ImageSize.SIZE_1K,
) -> tuple[int, str, int]:
    """
    基于已有的故事和分镜创建绘本（同步阶段）

    创建时同步保存 cover/content/back_cover 完整页面占位：
    - 封面：从 pages 中提取 page_type=cover 的页面，若无则自动创建
    - 正文：pages 中 page_type=content 的页面
    - 封底：自动创建，使用配置中的固定 OSS 图片

    积分检查：正文页数 + 1（封面）

    Args:
        title: 绘本标题
        description: 绘本描述/用户原始输入
        user_id: 用户ID
        pages: 页面列表（包含文本和分镜，可含封面页）
        image_style_id: 图片风格ID
        cli_type: CLI类型
        aspect_ratio: 图片比例
        image_size: 图片尺寸

    Returns:
        tuple[int, str, int]: (绘本ID, 标题, 锁定的画风版本ID)
    """
    # 分离封面页和正文页
    cover_pages = [p for p in pages if p.page_type == PageType.COVER.value]
    content_pages = [p for p in pages if p.page_type != PageType.COVER.value]

    # 积分检查：正文页数 + 1（封面）
    await check_creation_points(user_id)

    if image_style_id is None:
        raise ValueError("请选择画风")
    _style, style_version = await validate_style_available(image_style_id)

    # 获取封底图片 URL
    back_cover_url = page_service.get_back_cover_image_url(aspect_ratio.value)

    # 创建 Storybook 先获取 ID，再构建 Page ORM 对象
    async with async_session_maker() as session:
        new_storybook = Storybook(
            title=title,
            description=description,
            creator=str(user_id),
            instruction=description,
            template_id=None,
            image_style_id=image_style_id,
            image_style_version_id=style_version.id,
            cli_type=cli_type,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
            status="init"
        )
        session.add(new_storybook)
        await session.flush()
        storybook_id = new_storybook.id

        page_index = 0

        # 1. 封面页
        if cover_pages:
            cover_data = cover_pages[0]
            await page_service.create_page(
                session,
                PageCreate(
                    storybook_id=storybook_id,
                    page_index=page_index,
                    text=cover_data.text or title,
                    image_url="",
                    storyboard=cover_data.storyboard,
                    page_type=PageType.COVER.value,
                    status=PageStatus.PENDING.value,
                ),
            )
        else:
            await page_service.create_page(
                session,
                PageCreate(
                    storybook_id=storybook_id,
                    page_index=page_index,
                    text=title,
                    image_url="",
                    page_type=PageType.COVER.value,
                    status=PageStatus.PENDING.value,
                ),
            )
        page_index += 1

        # 2. 正文页
        for page in content_pages:
            await page_service.create_page(
                session,
                PageCreate(
                    storybook_id=storybook_id,
                    page_index=page_index,
                    text=page.text,
                    image_url="",
                    storyboard=page.storyboard,
                    page_type=PageType.CONTENT.value,
                    status=PageStatus.PENDING.value,
                ),
            )
            page_index += 1

        # 3. 封底页（固定图片）
        await page_service.create_page(
            session,
            PageCreate(
                storybook_id=storybook_id,
                page_index=page_index,
                text="",
                image_url=back_cover_url,
                page_type=PageType.BACK_COVER.value,
                status=PageStatus.FINISHED.value,
            ),
        )

        await session.commit()
        await session.refresh(new_storybook)

    total_pages = 1 + len(content_pages) + 1  # cover + content + back_cover
    logger.info("绘本记录和分镜已保存 | storybook_id=%s pages=%d", storybook_id, total_pages)
    return storybook_id, title, style_version.id


async def run_create_storybook_from_story_background(
    storybook_id: int,
    user_id: int,
    aspect_ratio: str = "16:9",
    image_size: str = "1k",
    cli_type: CliType = CliType.GEMINI,
    images: Optional[List[str]] = None,
) -> None:
    """
    后台任务：为已有分镜的绘本生成图片

    流程：
    1. 读取 cover/content/back_cover 页面
    2. 逐页生成正文图片
    3. 正文图完成后，自动选择参考图生成封面图
    4. 封底不动（同步阶段已写入固定 URL）
    5. 设置绘本状态为 finished

    失败时保留所有页面和已生成图片，用户可逐页 regenerate。
    """
    logger.info("基于故事创建绘本后台任务开始 | storybook_id=%s", storybook_id)
    start_time = time.time()

    storybook = await get_storybook(storybook_id)
    if not storybook:
        logger.error("绘本不存在 | storybook_id=%s", storybook_id)
        return

    await update_storybook_status(storybook_id, "creating")

    pages = storybook.pages or []
    if not pages:
        logger.error("绘本没有页面数据 | storybook_id=%s", storybook_id)
        await update_storybook_status(storybook_id, "error", error_message="没有页面数据")
        return

    # 分离页面类型
    cover_page: Optional[Page] = None
    content_pages: List[Page] = []
    for p in pages:
        if _page_type_value(p.page_type) == PageType.COVER.value:
            cover_page = p
        elif _page_type_value(p.page_type) == PageType.CONTENT.value:
            content_pages.append(p)

    if not content_pages:
        await update_storybook_status(storybook_id, "error", error_message="没有正文页数据")
        return

    active_page_id: Optional[int] = None

    try:
        llm_client = LLMClientBase.get_client(cli_type)
        if not storybook.image_style_version_id:
            raise ValueError("绘本未锁定画风版本")
        image_style_version = await get_style_version_for_generation(
            storybook.image_style_version_id
        )

        # 正文文本上下文（用于生成和封面）
        story_texts = [p.text for p in content_pages]

        # ========== 第一步：逐页生成正文图片 ==========
        logger.info("开始生成正文图片 | storybook_id=%s content_pages=%d", storybook_id, len(content_pages))

        for i, page in enumerate(content_pages):
            if await _is_terminated(storybook_id):
                await _mark_terminated(storybook_id)
                logger.info("绘本生成已中止 | storybook_id=%s", storybook_id)
                return

            logger.info("生成正文第 %d/%d 页 | storybook_id=%s", i + 1, len(content_pages), storybook_id)
            active_page_id = page.id
            async with async_session_maker() as session:
                db_page = await page_service.get_page_by_id(session, page.id)
                if db_page:
                    db_page.status = PageStatus.GENERATING
                    db_page.error_message = None
                    await session.commit()

            image_url = await llm_client.generate_page(
                story_text=page.text,
                storyboard=page.storyboard,
                story_context=story_texts,
                page_index=i,
                character_reference_images=images,
                previous_page_image=content_pages[i - 1].image_url if i > 0 and content_pages[i - 1].image_url else None,
                image_style_version=image_style_version,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            )

            page.image_url = image_url
            page.status = PageStatus.FINISHED
            page.error_message = None
            await page_service.upload_page_image_to_oss(storybook_id, page)

            # 增量更新数据库
            async with async_session_maker() as session:
                await session.merge(page)
                await session.commit()
            logger.info("正文第 %d 页完成 | storybook_id=%s", i + 1, storybook_id)

        # ========== 第二步：生成封面图片 ==========
        if cover_page:
            if await _is_terminated(storybook_id):
                await _mark_terminated(storybook_id)
                return

            # 刷新 content_pages 以获取最新的 image_url
            storybook = await get_storybook(storybook_id)
            if storybook:
                refreshed_content = [
                    p for p in storybook.pages
                    if _page_type_value(p.page_type) == PageType.CONTENT.value
                ]
                ref_pages = page_service.pick_cover_reference_pages(refreshed_content)
            else:
                ref_pages = page_service.pick_cover_reference_pages(content_pages)

            reference_image_urls = [p.image_url for p in ref_pages]
            logger.info("封面生成：选取参考页 %d 张 | storybook_id=%s",
                       len(reference_image_urls), storybook_id)
            active_page_id = cover_page.id
            async with async_session_maker() as session:
                db_page = await page_service.get_page_by_id(session, cover_page.id)
                if db_page:
                    db_page.status = PageStatus.GENERATING
                    db_page.error_message = None
                    await session.commit()

            cover_image_url = await llm_client.generate_cover(
                title=storybook.title if storybook else "",
                cover_text=page_service.build_cover_description(storybook.title if storybook else "", cover_page),
                reference_images=reference_image_urls,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                image_style_version=image_style_version,
            )

            cover_page.image_url = cover_image_url
            cover_page.status = PageStatus.FINISHED
            cover_page.error_message = None
            await page_service.upload_page_image_to_oss(storybook_id, cover_page)

            async with async_session_maker() as session:
                await session.merge(cover_page)
                await session.commit()
            logger.info("封面图片生成完成 | storybook_id=%s", storybook_id)

        # ========== 设置状态为 finished ==========
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
        logger.info("绘本生成完成 | storybook_id=%s elapsed=%.2fs", storybook_id, elapsed)

        # 扣除积分：正文页数 + 1（封面）
        content_count = len(content_pages)
        try:
            await consume_for_creation(user_id, content_count + 1)
        except Exception as e:
            logger.warning("积分扣费失败 | user_id=%s error=%s", user_id, e)

    except LLMError as e:
        logger.warning("绘本生成被拒绝 | storybook_id=%s error_type=%s user_message=%s",
                       storybook_id, e.error_type, e.user_message)
        async with async_session_maker() as session:
            if active_page_id:
                page = await page_service.get_page_by_id(session, active_page_id)
                if page:
                    page.status = PageStatus.ERROR
                    page.error_message = e.user_message
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                await page_service.sync_storybook_status_from_pages(
                    session,
                    storybook_id,
                    active_status="creating",
                    fallback_error=e.user_message,
                )
                await session.commit()
    except Exception as e:
        logger.exception("绘本生成失败 | storybook_id=%s error=%s", storybook_id, e)
        async with async_session_maker() as session:
            error_message = str(e)[:500]
            if active_page_id:
                page = await page_service.get_page_by_id(session, active_page_id)
                if page:
                    page.status = PageStatus.ERROR
                    page.error_message = error_message
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                await page_service.sync_storybook_status_from_pages(
                    session,
                    storybook_id,
                    active_status="creating",
                    fallback_error=error_message,
                )
                await session.commit()
