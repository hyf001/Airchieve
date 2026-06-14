from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, ArtStyleStatus, AssetAccessLevel, AssetSourceType, LibraryItemStatus, Voice
from app.model.taxonomy import TaxonomyItem, TaxonomyItemStatus, TaxonomyType


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

CHARACTER_CATEGORIES = [
    {
        "code": "child",
        "name": "儿童",
        "name_en": "Child",
        "description": "儿童主角、同学和朋友角色。",
        "sort_order": 10,
    },
    {
        "code": "family",
        "name": "家人",
        "name_en": "Family",
        "description": "爸爸、妈妈、爷爷奶奶等家庭角色。",
        "sort_order": 20,
    },
    {
        "code": "teacher",
        "name": "老师",
        "name_en": "Teacher",
        "description": "教师、辅导员和课堂引导者角色。",
        "sort_order": 30,
    },
    {
        "code": "friend",
        "name": "朋友",
        "name_en": "Friend",
        "description": "故事伙伴、同伴和陪伴型角色。",
        "sort_order": 40,
    },
    {
        "code": "fantasy",
        "name": "幻想角色",
        "name_en": "Fantasy",
        "description": "精灵、魔法师、机器人等非现实角色。",
        "sort_order": 50,
    },
    {
        "code": "animal",
        "name": "动物伙伴",
        "name_en": "Animal Companion",
        "description": "动物主角、宠物和拟人动物伙伴。",
        "sort_order": 60,
    },
]

SYSTEM_VOICES = [
    {"name": "阳光少年", "voice_style_code": "genshin_vindi2", "voice_language": "zh"},
    {"name": "懂事小弟", "voice_style_code": "zhinen_xuesheng", "voice_language": "zh"},
    {"name": "运动少年", "voice_style_code": "tiyuxi_xuedi", "voice_language": "zh"},
    {"name": "青春少女", "voice_style_code": "ai_shatang", "voice_language": "zh"},
    {"name": "温柔小妹", "voice_style_code": "genshin_klee2", "voice_language": "zh"},
    {"name": "元气少女", "voice_style_code": "genshin_kirara", "voice_language": "zh"},
    {"name": "阳光男生", "voice_style_code": "ai_kaiya", "voice_language": "zh"},
    {"name": "幽默小哥", "voice_style_code": "tiexin_nanyou", "voice_language": "zh"},
    {"name": "文艺小哥", "voice_style_code": "ai_chenjiahao_712", "voice_language": "zh"},
    {"name": "甜美邻家", "voice_style_code": "girlfriend_1_speech02", "voice_language": "zh"},
    {"name": "温柔姐姐", "voice_style_code": "chat1_female_new-3", "voice_language": "zh"},
    {"name": "职场女青", "voice_style_code": "girlfriend_2_speech02", "voice_language": "zh"},
    {"name": "活泼男童", "voice_style_code": "cartoon-boy-07", "voice_language": "zh"},
    {"name": "俏皮女童", "voice_style_code": "cartoon-girl-01", "voice_language": "zh"},
    {"name": "稳重老爸", "voice_style_code": "ai_huangyaoshi_712", "voice_language": "zh"},
    {"name": "温柔妈妈", "voice_style_code": "you_pingjing", "voice_language": "zh"},
    {"name": "严肃上司", "voice_style_code": "ai_laoguowang_712", "voice_language": "zh"},
    {"name": "优雅贵妇", "voice_style_code": "chengshu_jiejie", "voice_language": "zh"},
    {"name": "慈祥爷爷", "voice_style_code": "zhuxi_speech02", "voice_language": "zh"},
    {"name": "唠叨爷爷", "voice_style_code": "uk_oldman3", "voice_language": "zh"},
    {"name": "唠叨奶奶", "voice_style_code": "laopopo_speech02", "voice_language": "zh"},
    {"name": "和蔼奶奶", "voice_style_code": "heainainai_speech02", "voice_language": "zh"},
    {"name": "东北老铁", "voice_style_code": "dongbeilaotie_speech02", "voice_language": "zh"},
    {"name": "重庆小伙", "voice_style_code": "chongqingxiaohuo_speech02", "voice_language": "zh"},
    {"name": "四川妹子", "voice_style_code": "chuanmeizi_speech02", "voice_language": "zh"},
    {"name": "潮汕大叔", "voice_style_code": "chaoshandashu_speech02", "voice_language": "zh"},
    {"name": "台湾男生", "voice_style_code": "ai_taiwan_man2_speech02", "voice_language": "zh"},
    {"name": "西安掌柜", "voice_style_code": "xianzhanggui_speech02", "voice_language": "zh"},
    {"name": "天津姐姐", "voice_style_code": "tianjinjiejie_speech02", "voice_language": "zh"},
    {"name": "新闻播报男", "voice_style_code": "diyinnansang_DB_CN_M_04-v2", "voice_language": "zh"},
    {"name": "译制片男", "voice_style_code": "yizhipiannan-v1", "voice_language": "zh"},
    {"name": "元气少女 2", "voice_style_code": "guanxiaofang-v2", "voice_language": "zh"},
    {"name": "撒娇女友", "voice_style_code": "tianmeixuemei-v1", "voice_language": "zh"},
    {"name": "刀片烟嗓", "voice_style_code": "daopianyansang-v1", "voice_language": "zh"},
    {"name": "乖巧正太", "voice_style_code": "mengwa-v1", "voice_language": "zh"},
    {"name": "Sunny", "voice_style_code": "genshin_vindi2", "voice_language": "en"},
    {"name": "Sage", "voice_style_code": "zhinen_xuesheng", "voice_language": "en"},
    {"name": "Ace", "voice_style_code": "AOT", "voice_language": "en"},
    {"name": "Blossom", "voice_style_code": "ai_shatang", "voice_language": "en"},
    {"name": "Peppy", "voice_style_code": "genshin_klee2", "voice_language": "en"},
    {"name": "Dove", "voice_style_code": "genshin_kirara", "voice_language": "en"},
    {"name": "Shine", "voice_style_code": "ai_kaiya", "voice_language": "en"},
    {"name": "Anchor", "voice_style_code": "oversea_male1", "voice_language": "en"},
    {"name": "Lyric", "voice_style_code": "ai_chenjiahao_712", "voice_language": "en"},
    {"name": "Melody", "voice_style_code": "girlfriend_4_speech02", "voice_language": "en"},
    {"name": "Tender", "voice_style_code": "chat1_female_new-3", "voice_language": "en"},
    {"name": "Siren", "voice_style_code": "chat_0407_5-1", "voice_language": "en"},
    {"name": "Zippy", "voice_style_code": "cartoon-boy-07", "voice_language": "en"},
    {"name": "Bud", "voice_style_code": "uk_boy1", "voice_language": "en"},
    {"name": "Sprite", "voice_style_code": "cartoon-girl-01", "voice_language": "en"},
    {"name": "Candy", "voice_style_code": "PeppaPig_platform", "voice_language": "en"},
    {"name": "Beacon", "voice_style_code": "ai_huangzhong_712", "voice_language": "en"},
    {"name": "Rock", "voice_style_code": "ai_huangyaoshi_712", "voice_language": "en"},
    {"name": "Titan", "voice_style_code": "ai_laoguowang_712", "voice_language": "en"},
    {"name": "Grace", "voice_style_code": "chengshu_jiejie", "voice_language": "en"},
    {"name": "Helen", "voice_style_code": "you_pingjing", "voice_language": "en"},
    {"name": "Lore", "voice_style_code": "calm_story1", "voice_language": "en"},
    {"name": "Crag", "voice_style_code": "uk_man2", "voice_language": "en"},
    {"name": "Prattle", "voice_style_code": "laopopo_speech02", "voice_language": "en"},
    {"name": "Hearth", "voice_style_code": "heainainai_speech02", "voice_language": "en"},
    {"name": "The Reader", "voice_style_code": "reader_en_m-v1", "voice_language": "en"},
    {"name": "Commercial Lady", "voice_style_code": "commercial_lady_en_f-v1", "voice_language": "en"},
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


async def seed_character_categories(db: AsyncSession) -> None:
    result = await db.execute(
        select(TaxonomyItem).where(
            TaxonomyItem.type == TaxonomyType.CHARACTER_CATEGORY,
            TaxonomyItem.code.in_([item["code"] for item in CHARACTER_CATEGORIES]),
        )
    )
    existing = {item.code for item in result.scalars().all()}

    changed = False
    for item in CHARACTER_CATEGORIES:
        if item["code"] not in existing:
            db.add(
                TaxonomyItem(
                    type=TaxonomyType.CHARACTER_CATEGORY,
                    metadata_=None,
                    status=TaxonomyItemStatus.ACTIVE,
                    **item,
                )
            )
            changed = True

    if changed:
        await db.commit()


async def seed_system_voices(db: AsyncSession) -> None:
    result = await db.execute(
        select(Voice).where(
            Voice.owner_user_id.is_(None),
            Voice.voice_style_code.in_([item["voice_style_code"] for item in SYSTEM_VOICES]),
        )
    )
    existing = {(voice.voice_style_code, voice.voice_language): voice for voice in result.scalars().all()}

    changed = False
    for item in SYSTEM_VOICES:
        voice_key = (item["voice_style_code"], item["voice_language"])
        voice = existing.get(voice_key)
        if voice is None:
            db.add(
                Voice(
                    owner_user_id=None,
                    name=item["name"],
                    voice_style_code=item["voice_style_code"],
                    voice_language=item["voice_language"],
                    access_level=AssetAccessLevel.FREE,
                    source_type=AssetSourceType.SYSTEM,
                    status=LibraryItemStatus.ACTIVE,
                )
            )
            changed = True
        elif voice.name != item["name"] or voice.voice_language != item["voice_language"] or voice.source_type != AssetSourceType.SYSTEM:
            voice.name = item["name"]
            voice.voice_language = item["voice_language"]
            voice.source_type = AssetSourceType.SYSTEM
            voice.status = LibraryItemStatus.ACTIVE
            changed = True

    if changed:
        await db.commit()
