import uuid

from sqlalchemy import desc, func, select

from app.db.session import async_session_maker
from app.models.enums import PageType
from app.models.generation_debug import GenerationDebugRun
from app.models.page import Page
from app.models.storybook import Storybook
from app.schemas.generation_debug import (
    GenerationDebugDisplayContext,
    GenerationDebugPageContextResponse,
    GenerationDebugPageItem,
    GenerationDebugRunResponse,
    GenerationDebugRunUpdate,
    GenerationDebugStorybookItem,
    PageGenerationDebugParams,
)
from app.services.oss_service import upload_from_url
from app.services.page_generation_service import (
    build_page_generation_context_and_records_from_page,
    build_page_generation_context_from_debug_params,
    build_page_prompt_preview,
    generate_page_with_context,
    page_generation_anchor_to_dict,
    page_generation_storyboard_to_dict,
)


def _value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _run_response(run: GenerationDebugRun) -> GenerationDebugRunResponse:
    return GenerationDebugRunResponse(
        id=run.id,
        storybook_id=run.storybook_id,
        page_id=run.page_id,
        admin_user_id=run.admin_user_id,
        status=run.status,
        debug_params=PageGenerationDebugParams.model_validate(run.debug_params),
        output_image_url=run.output_image_url,
        error_message=run.error_message,
        rating=run.rating,
        tags=run.tags or [],
        notes=run.notes or "",
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


async def search_storybooks(keyword: str = "", limit: int = 20) -> list[GenerationDebugStorybookItem]:
    async with async_session_maker() as session:
        page_count = (
            select(func.count(Page.id))
            .where(Page.storybook_id == Storybook.id)
            .where(Page.page_type == PageType.CONTENT.value)
            .scalar_subquery()
        )
        stmt = select(Storybook, page_count.label("page_count")).order_by(desc(Storybook.created_at)).limit(limit)
        if keyword:
            stmt = stmt.where(Storybook.title.contains(keyword))
        rows = (await session.execute(stmt)).all()
        return [
            GenerationDebugStorybookItem(
                id=storybook.id,
                title=storybook.title,
                status=storybook.status,
                image_style_id=storybook.image_style_id,
                image_style_version_id=storybook.image_style_version_id,
                cli_type=_value(storybook.cli_type),
                page_count=count or 0,
                created_at=storybook.created_at,
            )
            for storybook, count in rows
        ]


async def list_content_pages(storybook_id: int) -> list[GenerationDebugPageItem]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(Page)
            .where(Page.storybook_id == storybook_id)
            .where(Page.page_type == PageType.CONTENT.value)
            .order_by(Page.page_index)
        )
        pages = list(result.scalars().all())
        return [
            GenerationDebugPageItem(
                id=page.id,
                page_index=page.page_index,
                content_page_index=index,
                text=page.text,
                image_url=page.image_url,
                status=_value(page.status),
                storyboard=page.storyboard,
            )
            for index, page in enumerate(pages)
        ]


async def get_page_context(page_id: int) -> GenerationDebugPageContextResponse:
    context, page, storybook = await build_page_generation_context_and_records_from_page(page_id)
    storyboard_data = (
        page_generation_storyboard_to_dict(context.storyboard)
        if context.storyboard
        else None
    )
    visual_anchor_data = [
        page_generation_anchor_to_dict(anchor)
        for anchor in context.visual_anchors
    ]

    debug_params = PageGenerationDebugParams(
        cli_type=context.cli_type,
        page_index=context.page_index,
        story_text=context.story_text,
        storyboard=storyboard_data,
        story_context=context.story_context,
        visual_anchors=visual_anchor_data,
        image_style_id=storybook.image_style_id,
        image_style_version_id=storybook.image_style_version_id,
        style_name=context.style.name,
        style_generation_prompt=context.style.generation_prompt,
        style_negative_prompt=context.style.negative_prompt,
        style_reference_images=context.style.reference_images,
        aspect_ratio=context.aspect_ratio,
        image_size=context.image_size,
        image_instruction="",
        previous_page_image=context.previous_page_image,
        character_reference_images=context.character_reference_images,
        selected_reference_page_images=context.selected_reference_page_images,
    )
    return GenerationDebugPageContextResponse(
        display_context=GenerationDebugDisplayContext(
            storybook_id=storybook.id,
            storybook_title=storybook.title,
            page_id=page.id,
            page_index=page.page_index,
            content_page_index=context.page_index,
            page_status=_value(page.status),
            image_url=page.image_url,
            story_text=page.text,
            storyboard=storyboard_data,
            visual_anchors=visual_anchor_data,
            image_style_id=storybook.image_style_id,
            image_style_version_id=storybook.image_style_version_id,
            style_name=context.style.name,
        ),
        debug_params=debug_params,
    )


async def preview_prompt(page_id: int, params: PageGenerationDebugParams):
    context = build_page_generation_context_from_debug_params(page_id, params)
    return build_page_prompt_preview(context)


async def create_run(page_id: int, params: PageGenerationDebugParams, admin_user_id: int) -> GenerationDebugRunResponse:
    async with async_session_maker() as session:
        page = (await session.execute(select(Page).where(Page.id == page_id))).scalar_one_or_none()
        if not page:
            raise ValueError("页面不存在")
        run = GenerationDebugRun(
            storybook_id=page.storybook_id,
            page_id=page_id,
            admin_user_id=admin_user_id,
            status="running",
            debug_params=params.model_dump(),
            tags=[],
            notes="",
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)

    try:
        context = build_page_generation_context_from_debug_params(page_id, params)
        image_url = await generate_page_with_context(context)
        output_url = await upload_from_url(image_url, f"generation-debug/{page_id}/{uuid.uuid4().hex}.png")
        async with async_session_maker() as session:
            run = (await session.execute(select(GenerationDebugRun).where(GenerationDebugRun.id == run.id))).scalar_one()
            run.status = "finished"
            run.output_image_url = output_url
            await session.commit()
            await session.refresh(run)
            return _run_response(run)
    except Exception as exc:
        async with async_session_maker() as session:
            run = (await session.execute(select(GenerationDebugRun).where(GenerationDebugRun.id == run.id))).scalar_one()
            run.status = "error"
            run.error_message = str(exc)
            await session.commit()
            await session.refresh(run)
            return _run_response(run)


async def list_runs(page_id: int) -> list[GenerationDebugRunResponse]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(GenerationDebugRun)
            .where(GenerationDebugRun.page_id == page_id)
            .order_by(desc(GenerationDebugRun.created_at))
        )
        return [_run_response(run) for run in result.scalars().all()]


async def get_run(run_id: int) -> GenerationDebugRunResponse | None:
    async with async_session_maker() as session:
        run = (await session.execute(select(GenerationDebugRun).where(GenerationDebugRun.id == run_id))).scalar_one_or_none()
        return _run_response(run) if run else None


async def update_run(run_id: int, req: GenerationDebugRunUpdate) -> GenerationDebugRunResponse | None:
    async with async_session_maker() as session:
        run = (await session.execute(select(GenerationDebugRun).where(GenerationDebugRun.id == run_id))).scalar_one_or_none()
        if not run:
            return None
        if req.rating is not None:
            run.rating = req.rating
        if req.tags is not None:
            run.tags = req.tags
        if req.notes is not None:
            run.notes = req.notes
        await session.commit()
        await session.refresh(run)
        return _run_response(run)
