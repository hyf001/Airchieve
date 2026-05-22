"""seed taxonomy items

Revision ID: 20260522_0001
Revises:
Create Date: 2026-05-22

"""
from collections.abc import Sequence
from datetime import datetime

from alembic import op
import sqlalchemy as sa


revision: str = "20260522_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


taxonomy_items = sa.table(
    "taxonomy_items",
    sa.column("type", sa.String),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("name_en", sa.String),
    sa.column("description", sa.Text),
    sa.column("metadata", sa.JSON),
    sa.column("sort_order", sa.Integer),
    sa.column("status", sa.String),
    sa.column("created_at", sa.DateTime),
    sa.column("updated_at", sa.DateTime),
)


SEED_ITEMS: list[dict] = [
    {
        "type": "age_range",
        "code": "age_0_2",
        "name": "0-2岁",
        "name_en": "Ages 0-2",
        "description": "适合视觉认知、亲子朗读和低龄启蒙内容。",
        "metadata": {"min_age": 0, "max_age": 2},
        "sort_order": 10,
    },
    {
        "type": "age_range",
        "code": "age_3_4",
        "name": "3-4岁",
        "name_en": "Ages 3-4",
        "description": "适合启蒙认知、短句朗读和亲子共读。",
        "metadata": {"min_age": 3, "max_age": 4},
        "sort_order": 20,
    },
    {
        "type": "age_range",
        "code": "age_5_6",
        "name": "5-6岁",
        "name_en": "Ages 5-6",
        "description": "适合情节更完整的睡前、冒险和成长故事。",
        "metadata": {"min_age": 5, "max_age": 6},
        "sort_order": 30,
    },
    {
        "type": "age_range",
        "code": "age_7_8",
        "name": "7-8岁",
        "name_en": "Ages 7-8",
        "description": "适合自主阅读起步、科普探索和章节化内容。",
        "metadata": {"min_age": 7, "max_age": 8},
        "sort_order": 40,
    },
    {
        "type": "age_range",
        "code": "age_9_10",
        "name": "9-10岁",
        "name_en": "Ages 9-10",
        "description": "适合更复杂的主题、人物关系和知识型内容。",
        "metadata": {"min_age": 9, "max_age": 10},
        "sort_order": 50,
    },
    {"type": "theme", "code": "bedtime", "name": "睡前", "name_en": "Bedtime", "sort_order": 10},
    {"type": "theme", "code": "adventure", "name": "冒险", "name_en": "Adventure", "sort_order": 20},
    {"type": "theme", "code": "nature", "name": "自然", "name_en": "Nature", "sort_order": 30},
    {"type": "theme", "code": "emotion", "name": "情绪", "name_en": "Emotion", "sort_order": 40},
    {"type": "theme", "code": "fairy_tale", "name": "童话", "name_en": "Fairy Tale", "sort_order": 50},
    {"type": "theme", "code": "science", "name": "科普", "name_en": "Science", "sort_order": 60},
    {"type": "theme", "code": "animals", "name": "动物", "name_en": "Animals", "sort_order": 70},
    {"type": "theme", "code": "friendship", "name": "友谊", "name_en": "Friendship", "sort_order": 80},
    {"type": "theme", "code": "space", "name": "太空", "name_en": "Space", "sort_order": 90},
    {"type": "theme", "code": "classic", "name": "经典", "name_en": "Classic", "sort_order": 100},
    {"type": "interest_tag", "code": "animals", "name": "动物", "name_en": "Animals", "sort_order": 10},
    {"type": "interest_tag", "code": "fairy_tale", "name": "童话", "name_en": "Fairy Tale", "sort_order": 20},
    {"type": "interest_tag", "code": "music", "name": "音乐", "name_en": "Music", "sort_order": 30},
    {"type": "interest_tag", "code": "space", "name": "太空", "name_en": "Space", "sort_order": 40},
    {"type": "interest_tag", "code": "nature", "name": "自然", "name_en": "Nature", "sort_order": 50},
    {"type": "interest_tag", "code": "friendship", "name": "友谊", "name_en": "Friendship", "sort_order": 60},
    {"type": "interest_tag", "code": "science", "name": "科普", "name_en": "Science", "sort_order": 70},
    {"type": "interest_tag", "code": "adventure", "name": "冒险", "name_en": "Adventure", "sort_order": 80},
    {"type": "education_goal", "code": "emotion", "name": "情感教育", "name_en": "Emotional Learning", "sort_order": 10},
    {"type": "education_goal", "code": "habit", "name": "习惯养成", "name_en": "Habit Building", "sort_order": 20},
    {"type": "education_goal", "code": "language", "name": "语言发展", "name_en": "Language Development", "sort_order": 30},
    {"type": "education_goal", "code": "courage", "name": "勇气", "name_en": "Courage", "sort_order": 40},
    {"type": "education_goal", "code": "social", "name": "社交能力", "name_en": "Social Skills", "sort_order": 50},
    {"type": "education_goal", "code": "creativity", "name": "创造力", "name_en": "Creativity", "sort_order": 60},
    {"type": "reading_level", "code": "starter", "name": "启蒙阅读", "name_en": "Starter", "sort_order": 10},
    {"type": "reading_level", "code": "growing", "name": "成长阅读", "name_en": "Growing", "sort_order": 20},
    {"type": "reading_level", "code": "independent", "name": "自主阅读", "name_en": "Independent", "sort_order": 30},
    {"type": "language", "code": "zh", "name": "中文", "name_en": "Chinese", "sort_order": 10},
    {"type": "language", "code": "en", "name": "English", "name_en": "English", "sort_order": 20},
    {"type": "language", "code": "bilingual", "name": "中英双语", "name_en": "Bilingual", "sort_order": 30},
    {"type": "narrative_style", "code": "bedtime", "name": "睡前温柔", "name_en": "Gentle Bedtime", "sort_order": 10},
    {"type": "narrative_style", "code": "adventure", "name": "冒险探索", "name_en": "Adventure", "sort_order": 20},
    {"type": "narrative_style", "code": "fairy_tale", "name": "童话奇幻", "name_en": "Fairy Tale", "sort_order": 30},
    {"type": "narrative_style", "code": "science", "name": "科普探索", "name_en": "Science", "sort_order": 40},
    {"type": "narrative_style", "code": "humor", "name": "轻松幽默", "name_en": "Humor", "sort_order": 50},
    {"type": "narrative_style", "code": "emotion", "name": "情绪管理", "name_en": "Emotion Coaching", "sort_order": 60},
    {"type": "narrative_style", "code": "habit", "name": "习惯养成", "name_en": "Habit Building", "sort_order": 70},
    {"type": "scene", "code": "bedtime", "name": "睡前故事", "name_en": "Bedtime", "sort_order": 10},
    {"type": "scene", "code": "parent_child", "name": "亲子共读", "name_en": "Parent-child Reading", "sort_order": 20},
    {"type": "scene", "code": "classroom", "name": "课堂播放", "name_en": "Classroom", "sort_order": 30},
    {"type": "scene", "code": "emotion_guidance", "name": "情绪引导", "name_en": "Emotion Guidance", "sort_order": 40},
    {"type": "scene", "code": "habit_building", "name": "习惯养成", "name_en": "Habit Building", "sort_order": 50},
    {"type": "scene", "code": "english_enlightenment", "name": "英语启蒙", "name_en": "English Enlightenment", "sort_order": 60},
    {"type": "voice_style", "code": "gentle_sister", "name": "温柔姐姐", "name_en": "Gentle Sister", "sort_order": 10},
    {"type": "voice_style", "code": "lively_brother", "name": "活泼哥哥", "name_en": "Lively Brother", "sort_order": 20},
    {"type": "voice_style", "code": "adventure_uncle", "name": "冒险叔叔", "name_en": "Adventure Uncle", "sort_order": 30},
    {"type": "voice_style", "code": "warm_mother", "name": "妈妈的声音", "name_en": "Warm Mother", "sort_order": 40},
    {"type": "asset_category", "code": "character", "name": "角色形象", "name_en": "Character", "sort_order": 10},
    {"type": "asset_category", "code": "art_style", "name": "画风", "name_en": "Art Style", "sort_order": 20},
    {"type": "asset_category", "code": "voice", "name": "声音", "name_en": "Voice", "sort_order": 30},
    {"type": "asset_category", "code": "cover", "name": "封面", "name_en": "Cover", "sort_order": 40},
    {"type": "asset_category", "code": "book_image", "name": "绘本插图", "name_en": "Book Image", "sort_order": 50},
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("taxonomy_items"):
        op.create_table(
            "taxonomy_items",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("type", sa.Enum("age_range", "theme", "interest_tag", "education_goal", "reading_level", "language", "narrative_style", "scene", "voice_style", "asset_category", name="taxonomytype"), nullable=False),
            sa.Column("code", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("name_en", sa.String(length=120), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("status", sa.Enum("active", "inactive", name="taxonomyitemstatus"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("type", "code", name="uq_taxonomy_type_code"),
        )
        op.create_index(op.f("ix_taxonomy_items_type"), "taxonomy_items", ["type"], unique=False)

    now = datetime.utcnow()
    for item in SEED_ITEMS:
        existing_id = bind.execute(
            sa.select(taxonomy_items.c.code).where(
                taxonomy_items.c.type == item["type"],
                taxonomy_items.c.code == item["code"],
            )
        ).scalar_one_or_none()
        if existing_id is not None:
            continue

        values = {
            **item,
            "description": item.get("description"),
            "metadata": item.get("metadata"),
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        bind.execute(taxonomy_items.insert().values(**values))


def downgrade() -> None:
    bind = op.get_bind()
    for item in SEED_ITEMS:
        bind.execute(
            taxonomy_items.delete().where(
                taxonomy_items.c.type == item["type"],
                taxonomy_items.c.code == item["code"],
            )
        )
