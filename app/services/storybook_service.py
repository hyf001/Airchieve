"""
Storybook Service
绘本服务
"""
from typing import Optional, List, Tuple
import asyncio
import time
import io
from sqlalchemy import select
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
        text = page.get("text", "")
        image_url = page.get("image_url", "")

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

