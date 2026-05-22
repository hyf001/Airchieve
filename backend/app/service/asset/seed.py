from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, ArtStyleStatus, AssetAccessLevel


SYSTEM_ART_STYLES = [
    {
        "code": "watercolor",
        "name": "水彩画风",
        "description": "柔和的水彩渲染效果，色彩自然融合，如同在纸上晕染开的颜料，温暖而富有诗意。",
        "prompt": "soft watercolor children's picture book illustration, gentle pigment bloom, warm poetic colors",
        "age_range_codes": ["2-4", "4-6", "6+"],
        "access_level": AssetAccessLevel.FREE,
        "sort_order": 10,
    },
    {
        "code": "crayon",
        "name": "蜡笔画风",
        "description": "粗犷有力的蜡笔笔触，充满童趣和活力，就像小朋友亲手在纸上涂鸦一样可爱。",
        "prompt": "childlike crayon drawing, textured strokes, playful and vivid picture book style",
        "age_range_codes": ["2-4", "4-6"],
        "access_level": AssetAccessLevel.FREE,
        "sort_order": 20,
    },
    {
        "code": "cartoon",
        "name": "卡通画风",
        "description": "干净明快的平涂色块，清晰的线条轮廓，经典的卡通表现手法，适合各种主题的绘本。",
        "prompt": "bright cartoon picture book, clean flat colors, clear outlines, friendly expressive shapes",
        "age_range_codes": ["2-4", "4-6", "6+"],
        "access_level": AssetAccessLevel.FREE,
        "sort_order": 30,
    },
    {
        "code": "bedtime",
        "name": "睡前温柔画风",
        "description": "柔和的粉彩梦境效果，朦胧温暖的色调，特别适合睡前故事，营造安宁温馨的氛围。",
        "prompt": "gentle bedtime picture book, soft pastel dream light, calm warm night atmosphere",
        "age_range_codes": ["0-3", "3-6"],
        "access_level": AssetAccessLevel.VIP,
        "sort_order": 40,
    },
    {
        "code": "chinese",
        "name": "国风画风",
        "description": "温润的中国传统水墨韵味，融入古典建筑与山水意象，典雅庄重又不失童真。",
        "prompt": "Chinese ink inspired children's illustration, elegant mountains, warm traditional architecture",
        "age_range_codes": ["4-6", "6+"],
        "access_level": AssetAccessLevel.VIP,
        "sort_order": 50,
    },
    {
        "code": "sketch",
        "name": "手绘线稿画风",
        "description": "简约的线条勾勒，淡淡的色彩点缀，注重结构表达，给孩子留出想象与涂色的空间。",
        "prompt": "hand drawn sketch picture book, simple pencil line art, light color accents, open imaginative space",
        "age_range_codes": ["4-6", "6+"],
        "access_level": AssetAccessLevel.FREE,
        "sort_order": 60,
    },
]


async def seed_system_art_styles(db: AsyncSession) -> None:
    result = await db.execute(select(ArtStyle).where(ArtStyle.code.in_([item["code"] for item in SYSTEM_ART_STYLES])))
    existing = {style.code: style for style in result.scalars().all()}

    changed = False
    for item in SYSTEM_ART_STYLES:
        if item["code"] not in existing:
            db.add(ArtStyle(owner_user_id=None, status=ArtStyleStatus.ACTIVE, **item))
            changed = True

    if changed:
        await db.commit()
