"""
Storybook Service
绘本服务
"""
from typing import Optional, List, Tuple
import asyncio
import time
import io
from sqlalchemy import select
from reportlab.lib.pagesizes import A4, A3, A5, LETTER, LEGAL, landscape
from reportlab.platypus import SimpleDocTemplate, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
import httpx
from PIL import Image as PILImage, ImageDraw, ImageFont

from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.models.storybook import Storybook, StorybookPage, StorybookStatus
from app.services.gemini_cli import GeminiCli
from app.services.points_service import (
    check_creation_points,
    consume_for_creation,
    consume_for_page_edit,
)

logger = get_logger(__name__)


async def _upload_pages_images_to_oss(
    storybook_id: int,
    pages: List[StorybookPage]
) -> List[StorybookPage]:
    """将每页的 image_url 上传到 OSS，并替换为 OSS 公开访问 URL"""
    from app.services import oss_service

    async def _upload_one(i: int, page: StorybookPage) -> StorybookPage:
        url = page.get("image_url", "")
        if not url:
            return page
        # 根据 data URL 头或默认值决定扩展名
        if url.startswith("data:image/png"):
            ext = ".png"
        else:
            ext = ".jpg"
        object_key = f"storybooks/{storybook_id}/page_{i}{ext}"
        try:
            oss_url = await oss_service.upload_from_url(url, object_key)
            return {**page, "image_url": oss_url}
        except Exception as e:
            logger.warning("图片上传OSS失败，保留原URL | page=%s error=%s", i, e)
            return page

    results = await asyncio.gather(*[_upload_one(i, page) for i, page in enumerate(pages)])
    return list(results)


async def _generate_storybook_content(
    storybook_id: int,
    instruction: str,
    system_prompt: Optional[str] = None,
    images: Optional[List[str]] = None,
    is_edit: bool = False,
    original_pages: Optional[List[StorybookPage]] = None
) -> None:
    """通用的绘本内容生成流程（支持创建和编辑）"""
    mode = "编辑" if is_edit else "创建"
    start_time = time.time()
    logger.info("开始生成绘本内容 | storybook_id=%s mode=%s", storybook_id, mode)

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
        llm_client = GeminiCli()

        if is_edit and original_pages:
            pages = await llm_client.edit_story(
                instruction=instruction,
                current_pages=original_pages,
                system_prompt=system_prompt
            )
        else:
            pages = await llm_client.create_story(
                instruction=instruction,
                system_prompt=system_prompt,
                images=images
            )

        # 将图片转存到 OSS
        if pages:
            oss_start = time.time()
            pages = await _upload_pages_images_to_oss(storybook_id, pages)
            logger.info("图片转存OSS完成 | storybook_id=%s pages=%s elapsed=%.2fs", storybook_id, len(pages), time.time() - oss_start)

        # 更新绘本内容
        async with async_session_maker() as session:
            result = await session.execute(
                select(Storybook).where(Storybook.id == storybook_id)
            )
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.pages = pages
                storybook.status = "finished"
                storybook.error_message = None
                await session.commit()

        elapsed = time.time() - start_time
        logger.info("绘本生成完成 | storybook_id=%s pages_count=%s elapsed=%.2fs", storybook_id, len(pages) if pages else 0, elapsed)

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
) -> tuple[int, str, Optional[str]]:
    """
    同步阶段：检查积分、解析模版、创建绘本记录。
    返回 (storybook_id, title, systemprompt) 供后台任务使用。
    积分不足时抛出 InsufficientPointsError。
    """
    await check_creation_points(user_id)

    systemprompt: Optional[str] = None
    style_prefix = ""

    if template_id:
        from app.models.template import Template
        async with async_session_maker() as session:
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                systemprompt = template.systemprompt
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

    logger.info("绘本记录已创建（异步模式）| storybook_id=%s", storybook_id)
    return storybook_id, title, systemprompt


async def run_create_storybook_background(
    storybook_id: int,
    instruction: str,
    user_id: int,
    systemprompt: Optional[str],
    images: Optional[List[str]],
) -> None:
    """后台任务：执行绘本内容生成，生成完成后按页数扣除积分。"""
    logger.info("创建绘本后台任务开始 | storybook_id=%s", storybook_id)
    try:
        await asyncio.wait_for(
            _generate_storybook_content(
                storybook_id=storybook_id,
                instruction=instruction,
                system_prompt=systemprompt,
                images=images,
                is_edit=False,
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


# ============ 异步编辑整本（轮询模式） ============

async def edit_storybook_async(
    storybook_id: int,
    instruction: str,
    user_id: int,
) -> tuple[int, str, Optional[str], List[StorybookPage]]:
    """
    同步阶段：检查积分、获取原绘本、创建新绘本记录。
    返回 (new_storybook_id, title, systemprompt, original_pages) 供后台任务使用。
    积分不足时抛出 InsufficientPointsError。
    原绘本不存在时抛出 ValueError。
    """
    await check_creation_points(user_id)

    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        original = result.scalar_one_or_none()

        if not original or not original.pages:
            raise ValueError("原绘本不存在或没有页面")

        original_pages: List[StorybookPage] = list(original.pages)
        template_id = original.template_id
        original_title = original.title
        original_creator = original.creator

        systemprompt: Optional[str] = None
        if template_id:
            from app.models.template import Template
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                systemprompt = template.systemprompt

        new_storybook = Storybook(
            title=f"{original_title} (编辑版)",
            description=f"基于绘本#{storybook_id}编辑\n编辑指令: {instruction}",
            creator=original_creator,
            instruction=instruction,
            template_id=template_id,
            status="init"
        )
        session.add(new_storybook)
        await session.commit()
        await session.refresh(new_storybook)
        new_id = new_storybook.id
        new_title = new_storybook.title

    logger.info("编辑版绘本记录已创建（异步模式）| original_id=%s new_id=%s", storybook_id, new_id)
    return new_id, new_title, systemprompt, original_pages


async def run_edit_storybook_background(
    new_storybook_id: int,
    instruction: str,
    user_id: int,
    systemprompt: Optional[str],
    images: Optional[List[str]],
    original_pages: List[StorybookPage],
) -> None:
    """后台任务：执行编辑版绘本的内容生成，生成完成后按页数扣除积分。"""
    logger.info("编辑绘本后台任务开始 | new_storybook_id=%s", new_storybook_id)
    try:
        await asyncio.wait_for(
            _generate_storybook_content(
                storybook_id=new_storybook_id,
                instruction=instruction,
                system_prompt=systemprompt,
                images=images,
                is_edit=True,
                original_pages=original_pages,
            ),
            timeout=900,
        )
        # 获取实际生成的页数作为积分消耗
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == new_storybook_id))
            storybook = result.scalar_one_or_none()
            page_count = len(storybook.pages) if storybook and storybook.pages else 1
        await consume_for_creation(user_id, page_count)
    except asyncio.TimeoutError:
        logger.error("编辑绘本超时 | new_storybook_id=%s", new_storybook_id)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == new_storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = "生成超时，请重试"
                await session.commit()
    except Exception as e:
        logger.exception("编辑绘本后台任务异常 | new_storybook_id=%s error=%s", new_storybook_id, e)


# ============ 异步编辑单页（轮询模式） ============

async def run_edit_page_background(
    storybook_id: int,
    page_index: int,
    instruction: str,
    user_id: int,
) -> None:
    """后台任务：执行单页编辑，更新绘本状态，成功后扣除积分。"""
    logger.info("单页编辑后台任务开始 | storybook_id=%s page_index=%s", storybook_id, page_index)
    try:
        await asyncio.wait_for(
            _do_edit_page(storybook_id, page_index, instruction, user_id),
            timeout=900,
        )
    except asyncio.TimeoutError:
        logger.error("单页编辑超时 | storybook_id=%s page_index=%s", storybook_id, page_index)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = "生成超时，请重试"
                await session.commit()
    except Exception as e:
        logger.exception("单页编辑后台任务失败 | storybook_id=%s error=%s", storybook_id, e)
        async with async_session_maker() as session:
            result = await session.execute(select(Storybook).where(Storybook.id == storybook_id))
            storybook = result.scalar_one_or_none()
            if storybook:
                storybook.status = "error"
                storybook.error_message = str(e)[:500]
                await session.commit()


async def _do_edit_page(
    storybook_id: int,
    page_index: int,
    instruction: str,
    user_id: int,
) -> None:
    """单页编辑的实际逻辑，供 wait_for 包裹。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if not storybook or not storybook.pages:
            logger.warning("单页编辑失败，绘本不存在或无页面 | storybook_id=%s", storybook_id)
            return

        current_page = storybook.pages[page_index]
        template_id = storybook.template_id
        systemprompt: Optional[str] = None

        if template_id:
            from app.models.template import Template
            result = await session.execute(
                select(Template).where(Template.id == template_id)
            )
            template = result.scalar_one_or_none()
            if template and template.is_active:
                systemprompt = template.systemprompt

    # LLM 编辑单页
    llm_client = GeminiCli()
    new_page = await llm_client.edit_page(
        page_index=page_index,
        instruction=instruction,
        current_page=current_page,
        system_prompt=systemprompt,
    )

    # 更新页面内容并恢复状态
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        storybook = result.scalar_one_or_none()
        if storybook and storybook.pages:
            storybook.pages[page_index] = new_page
            storybook.status = "finished"
            storybook.error_message = None
            await session.commit()
            logger.info("单页编辑完成 | storybook_id=%s page_index=%s", storybook_id, page_index)

    try:
        await consume_for_page_edit(user_id)
    except Exception as e:
        logger.warning("单页编辑积分扣费失败 | user_id=%s error=%s", user_id, e)


# ============ 查询 ============

async def get_storybook(storybook_id: int) -> Optional[Storybook]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(Storybook).where(Storybook.id == storybook_id)
        )
        return result.scalar_one_or_none()


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


def _get_chinese_font_size(size: int) -> ImageFont.ImageFont:
    """获���中文字体，支持不同大小"""
    font_paths = [
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STSong.ttc",
        # Linux
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        # Windows
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            continue

    # 如果都失败了，使用默认字体
    return ImageFont.load_default()


def _draw_text_on_image(image_data: bytes, text: str) -> bytes:
    """
    将文字绘制到图片底部

    保持图片原始尺寸，在图片底部绘制半透明背景和文字
    """
    # 打开图片
    img = PILImage.open(io.BytesIO(image_data))

    # 转换为 RGBA 模式以支持透明度
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 创建一个新的图层用于绘制
    overlay = PILImage.new('RGBA', img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    # 计算文字区域大小（底部 25%）
    text_area_height = int(img.height * 0.25)
    text_area_top = img.height - text_area_height

    # 绘制半透明白色背景
    draw.rectangle(
        [(0, text_area_top), (img.width, img.height)],
        fill=(255, 255, 255, 230)
    )

    # 获取字体（根据图片大小自适应）
    font_size = max(20, int(img.width * 0.04))  # 动态字体大小
    font = _get_chinese_font_size(font_size)

    # 计算文字位置（居中）
    # 获取文本边界框
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # 居中位置
    x = (img.width - text_width) // 2
    y = text_area_top + (text_area_height - text_height) // 2

    # 如果文字太宽，进行换行处理
    if text_width > img.width * 0.9:
        # 简单的换行逻辑
        avg_char_width = text_width / len(text)
        max_chars_per_line = int((img.width * 0.9) / avg_char_width)

        lines = []
        current_line = ""
        for char in text:
            if len(current_line) >= max_chars_per_line:
                lines.append(current_line)
                current_line = char
            else:
                current_line += char
        if current_line:
            lines.append(current_line)

        # 绘制多行文字
        line_height = text_height + 10
        total_text_height = len(lines) * line_height
        start_y = text_area_top + (text_area_height - total_text_height) // 2

        for i, line in enumerate(lines):
            line_bbox = draw.textbbox((0, 0), line, font=font)
            line_width = line_bbox[2] - line_bbox[0]
            line_x = (img.width - line_width) // 2
            draw.text((line_x, start_y + i * line_height), line, font=font, fill=(0, 0, 0, 255))
    else:
        # 单行文字
        draw.text((x, y), text, font=font, fill=(0, 0, 0, 255))

    # 合并图片和覆盖层
    combined = PILImage.alpha_composite(img, overlay)

    # 转换回 RGB 并保存
    if combined.mode != 'RGB':
        combined = combined.convert('RGB')

    # 保存到字节流
    output = io.BytesIO()
    combined.save(output, format='JPEG', quality=95)
    return output.getvalue()


def _setup_chinese_font() -> bool:
    """设置中文字体，返回是否成功"""
    # 尝试注册常见的中文字体
    font_paths = [
        # macOS 系统字体
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STSong.ttc",
        # Linux 常见字体
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        # Windows 字体
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
    ]

    for font_path in font_paths:
        try:
            pdfmetrics.registerFont(TTFont("ChineseFont", font_path))
            logger.info("成功注册中文字体 | path=%s", font_path)
            return True
        except Exception:
            continue

    logger.warning("未找到可用的中文字体，PDF中文可能无法正常显示")
    return False


async def generate_storybook_pdf(
    storybook_id: int,
    paper_size: str = "a4",
    orientation: str = "landscape"
) -> Optional[bytes]:
    """
    生成绘本PDF

    参数:
        storybook_id: 绘本ID
        paper_size: 纸张类型 (a3, a4, a5, letter, legal)
        orientation: 纸张方向 (portrait, landscape)

    返回 PDF 字节数据，失败返回 None
    """
    storybook = await get_storybook(storybook_id)

    if not storybook or not storybook.pages:
        logger.warning("生成PDF失败，绘本不存在或无页面 | storybook_id=%s", storybook_id)
        return None

    # 设置中文字体
    _setup_chinese_font()

    # 根据参数选择纸张类型
    paper_sizes = {
        "a3": A3,
        "a4": A4,
        "a5": A5,
        "letter": LETTER,
        "legal": LEGAL,
    }

    base_size = paper_sizes.get(paper_size, A4)

    # 根据方向设置页面尺寸
    if orientation == "landscape":
        page_size = landscape(base_size)
    else:
        page_size = base_size

    # 创建 PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=0,
        rightMargin=0,
        topMargin=0,
        bottomMargin=0,
    )

    # 创建样式
    styles = getSampleStyleSheet()

    # 尝试使用中文字体
    try:
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontName='ChineseFont',
            fontSize=20,
            alignment=1,  # 居中
            spaceAfter=12,
        )
    except Exception:
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            alignment=1,
            spaceAfter=12,
        )

    # 构建 PDF 内容
    story = []

    # 添加标题页（单独一页）
    title = storybook.title or "未命名绘本"
    try:
        story.append(Paragraph(title, title_style))
    except Exception:
        story.append(Paragraph(title, styles['Heading1']))
    story.append(PageBreak())

    # 为每一页添加内容
    for page in storybook.pages:
        text = page.get("text", "")
        image_url = page.get("image_url", "")

        # 下载图片并将文字绘制到图片上
        if image_url:
            image_data = await _download_image(image_url)
            if image_data:
                try:
                    # 如果有文字，将文字绘制到图片上
                    if text:
                        image_data = _draw_text_on_image(image_data, text)

                    img_buffer = io.BytesIO(image_data)
                    # 创建 Image 对象获取原始尺寸
                    img = Image(img_buffer)

                    # 计算适合横向 A4 页面的尺寸（保持原始宽高比）
                    page_width = page_size[0]
                    page_height = page_size[1]

                    # 计算缩放比例，使图片填满页面（不被挤压）
                    width_ratio = page_width / img.drawWidth
                    height_ratio = page_height / img.drawHeight
                    scale = min(width_ratio, height_ratio)

                    # 应用缩放，让图片尽可能大
                    img.drawWidth = img.drawWidth * scale
                    img.drawHeight = img.drawHeight * scale

                    img.hAlign = 'CENTER'
                    img.vAlign = 'MIDDLE'
                    story.append(img)
                except Exception as e:
                    logger.warning("添加图片到PDF失败 | url=%s error=%s", image_url, e)

        story.append(PageBreak())

    # 生成 PDF
    try:
        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        logger.info("PDF生成成功 | storybook_id=%s pages=%s size=%s",
                   storybook_id, len(storybook.pages), len(pdf_data))
        return pdf_data
    except Exception as e:
        logger.exception("PDF生成失败 | storybook_id=%s error=%s", storybook_id, e)
        buffer.close()
        return None
