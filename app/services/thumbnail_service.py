"""
Thumbnail Service
文件缩略图生成服务
"""
import hashlib
import io
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings

# 缩略图配置
THUMBNAIL_SIZE = (200, 200)
THUMBNAIL_CACHE_DIR = "thumbnails"

# 文件类型图标颜色映射
FILE_TYPE_COLORS = {
    "pdf": "#E53E3E",  # 红色
    "doc": "#3182CE",  # 蓝色
    "docx": "#3182CE",
    "xls": "#38A169",  # 绿色
    "xlsx": "#38A169",
    "ppt": "#DD6B20",  # 橙色
    "pptx": "#DD6B20",
    "txt": "#718096",  # 灰色
    "csv": "#38A169",  # 绿色
    "md": "#805AD5",  # 紫色
}


def _get_cache_path(file_path: Path, size: tuple[int, int]) -> Path:
    """获取缩略图缓存路径"""
    # 基于文件路径和修改时间生成唯一标识
    stat = file_path.stat()
    cache_key = f"{file_path}:{stat.st_mtime}:{size[0]}x{size[1]}"
    cache_hash = hashlib.md5(cache_key.encode()).hexdigest()

    cache_dir = Path(settings.USER_PROJECTS_ROOT) / THUMBNAIL_CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)

    return cache_dir / f"{cache_hash}.png"


def _generate_image_thumbnail(file_path: Path, size: tuple[int, int]) -> bytes:
    """生成图片缩略图"""
    with Image.open(file_path) as img:
        # 转换为RGB模式（处理RGBA等格式）
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # 计算缩放比例，保持宽高比
        img.thumbnail(size, Image.Resampling.LANCZOS)

        # 创建正方形背景
        thumb = Image.new("RGB", size, (26, 26, 26))  # #1a1a1a 背景
        # 居中粘贴
        offset = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
        thumb.paste(img, offset)

        buffer = io.BytesIO()
        thumb.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()


def _generate_pdf_thumbnail(file_path: Path, size: tuple[int, int]) -> bytes:
    """生成PDF缩略图（第一页）"""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(file_path)
        if len(doc) == 0:
            doc.close()
            return _generate_placeholder_thumbnail("PDF", "pdf", size)

        page = doc[0]
        # 计算缩放比例
        zoom = min(size[0] / page.rect.width, size[1] / page.rect.height)
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        # 转换为PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        doc.close()

        # 创建正方形背景并居中
        thumb = Image.new("RGB", size, (26, 26, 26))
        offset = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
        thumb.paste(img, offset)

        buffer = io.BytesIO()
        thumb.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
    except Exception:
        return _generate_placeholder_thumbnail("PDF", "pdf", size)


def _generate_text_thumbnail(file_path: Path, size: tuple[int, int], file_type: str) -> bytes:
    """生成文本文件缩略图（显示前几行内容）"""
    try:
        # 读取文件内容
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(500)  # 只读取前500个字符

        # 创建图片
        img = Image.new("RGB", size, (37, 37, 37))  # #252525 背景
        draw = ImageDraw.Draw(img)

        # 尝试使用系统字体
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 10)
        except (OSError, IOError):
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 10)
            except (OSError, IOError):
                font = ImageFont.load_default()

        # 绘制文本
        lines = content.split("\n")[:15]  # 最多显示15行
        y = 5
        for line in lines:
            # 截断过长的行
            if len(line) > 25:
                line = line[:25] + "..."
            draw.text((5, y), line, fill=(200, 200, 200), font=font)
            y += 12
            if y > size[1] - 10:
                break

        # 添加文件类型标签
        color = FILE_TYPE_COLORS.get(file_type.lower(), "#718096")
        draw.rectangle([size[0] - 35, 5, size[0] - 5, 20], fill=color)
        draw.text((size[0] - 32, 6), file_type.upper()[:3], fill=(255, 255, 255), font=font)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
    except Exception:
        return _generate_placeholder_thumbnail(file_type.upper(), file_type, size)


def _generate_placeholder_thumbnail(label: str, file_type: str, size: tuple[int, int]) -> bytes:
    """生成占位符缩略图（用于Office文档等）"""
    img = Image.new("RGB", size, (37, 37, 37))  # #252525 背景
    draw = ImageDraw.Draw(img)

    # 获取文件类型颜色
    color = FILE_TYPE_COLORS.get(file_type.lower(), "#718096")

    # 绘制文件图标形状
    icon_size = 60
    x = (size[0] - icon_size) // 2
    y = (size[1] - icon_size) // 2 - 15

    # 文件图标背景
    draw.rounded_rectangle([x, y, x + icon_size, y + icon_size], radius=8, fill=color)

    # 尝试加载字体
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    except (OSError, IOError):
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        except (OSError, IOError):
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

    # 绘制文件扩展名
    ext = label[:4].upper()
    bbox = draw.textbbox((0, 0), ext, font=font_large)
    text_width = bbox[2] - bbox[0]
    text_x = x + (icon_size - text_width) // 2
    text_y = y + (icon_size - 24) // 2
    draw.text((text_x, text_y), ext, fill=(255, 255, 255), font=font_large)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_thumbnail(
    file_path: str,
    size: tuple[int, int] = THUMBNAIL_SIZE,
    use_cache: bool = True,
) -> Optional[bytes]:
    """生成文件缩略图

    Args:
        file_path: 文件路径
        size: 缩略图尺寸 (width, height)
        use_cache: 是否使用缓存

    Returns:
        PNG格式的缩略图字节数据，失败返回None
    """
    path = Path(file_path)

    if not path.exists() or not path.is_file():
        return None

    # 检查缓存
    if use_cache:
        cache_path = _get_cache_path(path, size)
        if cache_path.exists():
            return cache_path.read_bytes()

    suffix = path.suffix.lower()
    thumbnail_data: Optional[bytes] = None

    try:
        # 图片文件
        if suffix in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico"}:
            thumbnail_data = _generate_image_thumbnail(path, size)

        # PDF文件
        elif suffix == ".pdf":
            thumbnail_data = _generate_pdf_thumbnail(path, size)

        # 文本文件
        elif suffix in {".txt", ".csv", ".md"}:
            thumbnail_data = _generate_text_thumbnail(path, size, suffix[1:])

        # Office文档（生成占位符）
        elif suffix in {".doc", ".docx"}:
            thumbnail_data = _generate_placeholder_thumbnail("WORD", "docx", size)
        elif suffix in {".xls", ".xlsx"}:
            thumbnail_data = _generate_placeholder_thumbnail("EXCEL", "xlsx", size)
        elif suffix in {".ppt", ".pptx"}:
            thumbnail_data = _generate_placeholder_thumbnail("PPT", "pptx", size)

        # SVG特殊处理
        elif suffix == ".svg":
            # SVG作为文本预览
            thumbnail_data = _generate_text_thumbnail(path, size, "svg")

        # 保存缓存
        if thumbnail_data and use_cache:
            cache_path = _get_cache_path(path, size)
            cache_path.write_bytes(thumbnail_data)

        return thumbnail_data

    except Exception:
        return None
