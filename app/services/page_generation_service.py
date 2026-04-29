from dataclasses import asdict
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.models.enums import CliType, PageType
from app.models.generation_debug import StorybookReferenceImage
from app.models.image_style import ImageStyleVersion
from app.models.page import Page
from app.models.storybook import Storybook
from app.schemas.page_generation import (
    PageGenerationContext,
    PageGenerationPreview,
    PageGenerationStoryboard,
    PageGenerationStyleContext,
    PageGenerationVisualAnchor,
)
from app.services.llm_cli import LLMClientBase
from app.services.visual_anchor_service import anchors_for_storyboard

if TYPE_CHECKING:
    from app.schemas.generation_debug import PageGenerationDebugParams


def _enum_value(value: Any) -> str:
    return value.value if hasattr(value, "value") else str(value)


def page_generation_storyboard_from_raw(raw: Any) -> PageGenerationStoryboard | None:
    if not raw:
        return None
    return PageGenerationStoryboard(
        summary=str(raw.get("summary") or ""),
        visual_brief=str(raw.get("visual_brief") or ""),
        anchor_refs=list(raw.get("anchor_refs") or []),
        must_include=list(raw.get("must_include") or []),
        composition=str(raw.get("composition") or ""),
        avoid=list(raw.get("avoid") or []),
    )


def page_generation_anchors_from_raw(raw: Any) -> list[PageGenerationVisualAnchor]:
    items = raw or []
    return [
        PageGenerationVisualAnchor(
            id=str(item.get("id") or ""),
            type=str(item.get("type") or ""),
            name=str(item.get("name") or ""),
            description=str(item.get("description") or ""),
            key_attributes=list(item.get("key_attributes") or []),
        )
        for item in items
        if isinstance(item, dict)
    ]


def page_generation_style_context_from_version(version: ImageStyleVersion | None) -> PageGenerationStyleContext:
    if not version:
        return PageGenerationStyleContext()
    return PageGenerationStyleContext(
        name=version.image_style.name if version.image_style else "",
        generation_prompt=version.generation_prompt or "",
        negative_prompt=version.negative_prompt or "",
        reference_images=[image.url for image in version.reference_images if image.url],
    )


def page_generation_storyboard_to_dict(storyboard: PageGenerationStoryboard) -> dict[str, Any]:
    return asdict(storyboard)


def page_generation_anchor_to_dict(anchor: PageGenerationVisualAnchor) -> dict[str, Any]:
    return asdict(anchor)


async def list_storybook_reference_images(storybook_id: int) -> list[str]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(StorybookReferenceImage)
            .where(StorybookReferenceImage.storybook_id == storybook_id)
            .where(StorybookReferenceImage.reference_type == "character")
            .order_by(StorybookReferenceImage.sort_order, StorybookReferenceImage.id)
        )
        return [item.image_url for item in result.scalars().all()]


async def create_storybook_reference_images(storybook_id: int, image_urls: list[str]) -> None:
    if not image_urls:
        return
    async with async_session_maker() as session:
        for index, url in enumerate(image_urls):
            session.add(StorybookReferenceImage(
                storybook_id=storybook_id,
                image_url=url,
                reference_type="character",
                sort_order=index,
            ))
        await session.commit()


async def build_page_generation_context_from_page(
    page_id: int,
    *,
    image_instruction: str = "",
    selected_reference_page_ids: list[int] | None = None,
) -> PageGenerationContext:
    context, _page, _storybook = await build_page_generation_context_and_records_from_page(
        page_id,
        image_instruction=image_instruction,
        selected_reference_page_ids=selected_reference_page_ids,
    )
    return context


async def build_page_generation_context_and_records_from_page(
    page_id: int,
    *,
    image_instruction: str = "",
    selected_reference_page_ids: list[int] | None = None,
) -> tuple[PageGenerationContext, Page, Storybook]:
    async with async_session_maker() as session:
        page = (await session.execute(select(Page).where(Page.id == page_id))).scalar_one_or_none()
        if not page:
            raise ValueError("页面不存在")
        storybook = (
            await session.execute(
                select(Storybook)
                .options(selectinload(Storybook.pages))
                .where(Storybook.id == page.storybook_id)
            )
        ).scalar_one_or_none()
        if not storybook:
            raise ValueError("绘本不存在")
        if _enum_value(page.page_type) != PageType.CONTENT.value:
            raise ValueError("仅支持正文页图片生成")
        content_pages = [
            p for p in storybook.pages
            if _enum_value(p.page_type) == PageType.CONTENT.value
        ]
        content_pages.sort(key=lambda item: item.page_index)
        page_idx = next((idx for idx, item in enumerate(content_pages) if item.id == page_id), -1)
        if page_idx < 0:
            raise ValueError("正文页不存在")
        story_texts = [p.text for p in content_pages]
        previous_page_image = content_pages[page_idx - 1].image_url if page_idx > 0 else None
        selected_urls = [
            p.image_url
            for p in content_pages
            if selected_reference_page_ids and p.id in set(selected_reference_page_ids) and p.image_url
        ]
        style_version = None
        if storybook.image_style_version_id:
            style_version = (
                await session.execute(
                    select(ImageStyleVersion)
                    .options(
                        selectinload(ImageStyleVersion.image_style),
                        selectinload(ImageStyleVersion.reference_images),
                    )
                    .where(ImageStyleVersion.id == storybook.image_style_version_id)
                )
            ).scalar_one_or_none()
        ref_result = await session.execute(
            select(StorybookReferenceImage)
            .where(StorybookReferenceImage.storybook_id == storybook.id)
            .where(StorybookReferenceImage.reference_type == "character")
            .order_by(StorybookReferenceImage.sort_order, StorybookReferenceImage.id)
        )
        character_refs = [item.image_url for item in ref_result.scalars().all()]

        context = PageGenerationContext(
            cli_type=_enum_value(storybook.cli_type),
            storybook_id=storybook.id,
            page_id=page.id,
            page_index=page_idx,
            story_text=page.text,
            storyboard=page_generation_storyboard_from_raw(page.storyboard),
            story_context=story_texts,
            visual_anchors=page_generation_anchors_from_raw(anchors_for_storyboard(page.storyboard, storybook.visual_anchors)),
            style=page_generation_style_context_from_version(style_version),
            aspect_ratio=_enum_value(storybook.aspect_ratio),
            image_size=_enum_value(storybook.image_size),
            image_instruction=image_instruction,
            previous_page_image=previous_page_image,
            character_reference_images=character_refs,
            selected_reference_page_images=selected_urls,
        )
        return context, page, storybook


def build_page_generation_context_from_debug_params(
    page_id: int,
    debug_params: "PageGenerationDebugParams",
) -> PageGenerationContext:
    return PageGenerationContext(
        cli_type=debug_params.cli_type,
        storybook_id=None,
        page_id=page_id,
        page_index=debug_params.page_index,
        story_text=debug_params.story_text,
        storyboard=page_generation_storyboard_from_raw(debug_params.storyboard.model_dump() if debug_params.storyboard else None),
        story_context=list(debug_params.story_context or []),
        visual_anchors=page_generation_anchors_from_raw([anchor.model_dump() for anchor in debug_params.visual_anchors]),
        style=PageGenerationStyleContext(
            name=debug_params.style_name,
            generation_prompt=debug_params.style_generation_prompt,
            negative_prompt=debug_params.style_negative_prompt,
            reference_images=list(debug_params.style_reference_images or []),
        ),
        aspect_ratio=debug_params.aspect_ratio,
        image_size=debug_params.image_size,
        image_instruction=debug_params.image_instruction,
        previous_page_image=debug_params.previous_page_image,
        character_reference_images=list(debug_params.character_reference_images or []),
        selected_reference_page_images=list(debug_params.selected_reference_page_images or []),
    )


def build_page_prompt_preview(context: PageGenerationContext) -> PageGenerationPreview:
    client = LLMClientBase.get_client(CliType(context.cli_type))
    return PageGenerationPreview(
        prompt=client.build_page_prompt(context),
        input_resources=client.build_page_input_resources(context),
    )


async def generate_page_with_context(context: PageGenerationContext) -> str:
    client = LLMClientBase.get_client(CliType(context.cli_type))
    return await client.generate_page(context)
