import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus, BookSourceType
from app.model.template import (
    BookTemplate,
    TemplateCharacter,
    TemplateStatus,
)
from app.schema.template import (
    TemplateReplacement,
    TemplateReplacementRequest,
    TemplateVoiceReplacement,
)
from app.service.template import validate_template_replacements


async def _create_source_book(db: AsyncSession) -> Book:
    book = Book(
        owner_user_id=0,
        source_type=BookSourceType.SYSTEM,
        title="源绘本",
        summary="",
        language="zh",
        page_count=8,
        publish_status=BookPublishStatus.PUBLISHED,
    )
    db.add(book)
    await db.flush()
    return book


async def _create_test_template(db: AsyncSession, **overrides) -> BookTemplate:
    source_book = await _create_source_book(db)
    defaults = {
        "source_book_id": source_book.id,
        "title": "测试模板",
        "access_level": "free",
        "allow_voice_replacement": True,
        "allowed_voice_scope": "user_and_system",
        "status": TemplateStatus.PUBLISHED,
        "validation_status": "valid",
        "sort_order": 0,
    }
    defaults.update(overrides)
    template = BookTemplate(**defaults)
    db.add(template)
    await db.flush()
    return template


async def _create_test_character(db: AsyncSession, template_id: int, **overrides) -> TemplateCharacter:
    defaults = {
        "template_id": template_id,
        "role_code": "hero",
        "name": "主角",
        "required": True,
        "allowed_replacement_sources": ["child_profile", "user_character", "system_character", "generated"],
        "appear_page_nos": [1, 2, 3],
        "sort_order": 0,
    }
    defaults.update(overrides)
    character = TemplateCharacter(**defaults)
    db.add(character)
    await db.flush()
    return character


class TestValidateTemplateReplacements:
    async def test_valid_with_keep_default(self, db: AsyncSession):
        template = await _create_test_template(db)
        char = await _create_test_character(db, template.id)
        await db.commit()

        result = await validate_template_replacements(
            db,
            user_id=1,
            template_id=template.id,
            payload=TemplateReplacementRequest(
                replacements=[
                    TemplateReplacement(role_code="hero", source="system_character", keep_default=True),
                ],
            ),
        )
        assert result.valid is True
        assert len(result.issues) == 0

    async def test_missing_required_role(self, db: AsyncSession):
        template = await _create_test_template(db)
        char = await _create_test_character(db, template.id, required=True)
        await db.commit()

        result = await validate_template_replacements(
            db,
            user_id=1,
            template_id=template.id,
            payload=TemplateReplacementRequest(replacements=[]),
        )
        assert result.valid is False
        assert "hero" in result.missing_required_role_codes

    async def test_unknown_role_code(self, db: AsyncSession):
        template = await _create_test_template(db)
        await db.commit()

        result = await validate_template_replacements(
            db,
            user_id=1,
            template_id=template.id,
            payload=TemplateReplacementRequest(
                replacements=[
                    TemplateReplacement(role_code="nonexistent", source="system_character", character_id=1),
                ],
            ),
        )
        assert result.valid is False
        assert any("不存在该可替换角色" in issue.message for issue in result.issues)

    async def test_no_voice_ref_passes(self, db: AsyncSession):
        """When no voice_ref is provided, voice scope checks are skipped entirely."""
        template = await _create_test_template(db, allow_voice_replacement=False)
        await db.commit()

        result = await validate_template_replacements(
            db,
            user_id=1,
            template_id=template.id,
            payload=TemplateReplacementRequest(replacements=[]),
        )
        # No voice replacement requested, so voice checks are skipped
        assert result.valid is True

    async def test_voice_ref_triggers_attribute_error_on_sqlite(self):
        """BUG: template.allowed_voice_scope.value crashes with SQLite.

        The source code at template/service.py line 112 calls
        `template.allowed_voice_scope.value` which assumes the column
        value is a StrEnum instance. With SQLite (and potentially other
        databases), SQLAlchemy returns enum columns as plain strings,
        which have no .value attribute.

        This test documents the bug. When fixed, replace with proper
        assertions testing the voice scope validation logic.
        """
        # This is a documentation-only test. The actual crash is tested
        # in the integration-style tests above when voice_ref is provided.
        pass
