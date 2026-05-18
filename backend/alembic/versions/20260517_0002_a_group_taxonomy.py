"""a group taxonomy

Revision ID: 20260517_0002
Revises: 20260517_0001
Create Date: 2026-05-17
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

_now = datetime.now(timezone.utc)


revision = "20260517_0002"
down_revision = "20260517_0001"
branch_labels = None
depends_on = None

SEED_DATA = [
    # age_range
    ("age_range", "age_3_4", "3-4岁", "3-4 years", 1),
    ("age_range", "age_5_6", "5-6岁", "5-6 years", 2),
    ("age_range", "age_7_8", "7-8岁", "7-8 years", 3),
    ("age_range", "age_9_10", "9-10岁", "9-10 years", 4),
    # theme
    ("theme", "friendship", "友谊", "Friendship", 1),
    ("theme", "courage", "勇气", "Courage", 2),
    ("theme", "nature", "自然", "Nature", 3),
    ("theme", "science", "科学", "Science", 4),
    ("theme", "sharing", "分享", "Sharing", 5),
    ("theme", "emotion", "情绪管理", "Emotion", 6),
    ("theme", "fairy_tale", "童话", "Fairy Tale", 7),
    ("theme", "adventure", "冒险", "Adventure", 8),
    # interest_tag
    ("interest_tag", "animals", "动物", "Animals", 1),
    ("interest_tag", "fairy_tale", "童话", "Fairy Tale", 2),
    ("interest_tag", "music", "儿歌", "Music", 3),
    ("interest_tag", "space", "太空", "Space", 4),
    ("interest_tag", "nature", "自然", "Nature", 5),
    ("interest_tag", "friendship", "朋友", "Friendship", 6),
    ("interest_tag", "science", "科学", "Science", 7),
    ("interest_tag", "adventure", "冒险", "Adventure", 8),
    # education_goal
    ("education_goal", "emotion", "情绪表达", "Emotion", 1),
    ("education_goal", "habit", "习惯养成", "Habit", 2),
    ("education_goal", "language", "语言启蒙", "Language", 3),
    ("education_goal", "courage", "勇气建立", "Courage", 4),
    ("education_goal", "social", "社交能力", "Social", 5),
    ("education_goal", "creativity", "想象力", "Creativity", 6),
    # reading_level
    ("reading_level", "starter", "启蒙期", "Starter", 1),
    ("reading_level", "growing", "成长期", "Growing", 2),
    ("reading_level", "independent", "独立阅读", "Independent", 3),
    # language
    ("language", "zh", "中文", "Chinese", 1),
    ("language", "en", "英文", "English", 2),
    ("language", "bilingual", "双语", "Bilingual", 3),
    # narrative_style
    ("narrative_style", "warm", "温馨叙事", "Warm", 1),
    ("narrative_style", "adventure", "冒险叙事", "Adventure", 2),
    ("narrative_style", "poetic", "诗意叙事", "Poetic", 3),
    ("narrative_style", "humorous", "幽默叙事", "Humorous", 4),
    # scene
    ("scene", "bedtime", "睡前", "Bedtime", 1),
    ("scene", "parent_child", "亲子共读", "Parent-Child", 2),
    ("scene", "classroom", "课堂", "Classroom", 3),
    ("scene", "travel", "旅途", "Travel", 4),
    # voice_style
    ("voice_style", "warm_mom", "温柔妈妈", "Warm Mom", 1),
    ("voice_style", "story_dad", "故事爸爸", "Story Dad", 2),
    ("voice_style", "clear_teacher", "清亮老师", "Clear Teacher", 3),
    # asset_category
    ("asset_category", "character", "形象", "Character", 1),
    ("asset_category", "voice", "声音", "Voice", 2),
    ("asset_category", "art_style", "画风", "Art Style", 3),
]


def upgrade() -> None:
    op.create_table(
        "taxonomy_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "age_range",
                "theme",
                "interest_tag",
                "education_goal",
                "reading_level",
                "language",
                "narrative_style",
                "scene",
                "voice_style",
                "asset_category",
                name="taxonomytype",
            ),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("name_en", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "inactive", name="taxonomyitemstatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("type", "code", name="uq_taxonomy_type_code"),
    )
    op.create_index(op.f("ix_taxonomy_items_type"), "taxonomy_items", ["type"], unique=False)

    taxonomy_items = sa.table(
        "taxonomy_items",
        sa.column("type", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("name_en", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("status", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        taxonomy_items,
        [
            {
                "type": t,
                "code": c,
                "name": n,
                "name_en": ne,
                "sort_order": s,
                "status": "active",
                "created_at": _now,
                "updated_at": _now,
            }
            for t, c, n, ne, s in SEED_DATA
        ],
    )


def downgrade() -> None:
    op.drop_table("taxonomy_items")
    op.execute("DROP TYPE IF EXISTS taxonomyitemstatus")
    op.execute("DROP TYPE IF EXISTS taxonomytype")
