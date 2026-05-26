from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus
from app.model.story import (
    Story,
    StoryModerationStatus,
    StoryPublishStatus,
    StorySourceType,
)
from app.model.taxonomy import TaxonomyType
from app.model.generation_task import GenerationTask, GenerationTaskType
from app.schema.book import BookSummary
from app.schema.generation_task import GenerationTaskCreate
from app.schema.story import (
    StartCreationFromStoryRequest,
    StoryCreate,
    StoryCharacter,
    StoryGenerateRequest,
    StoryGenerationTaskResponse,
    StoryCreationSessionRead,
    StoryInternalDTO,
    StoryListRead,
    StoryRead,
    StorySummary,
    StoryUpdate,
)
from app.service.taxonomy import validate_taxonomy_codes
from app.service import generation_task
from app.service import ai_provider


def _story_summary(story: Story) -> StorySummary:
    return StorySummary.model_validate(story)


def _story_meta_with_characters(characters: list[StoryCharacter] | None) -> dict:
    if characters is None:
        return {}
    return {"characters": [character.model_dump(mode="json") for character in characters]}


async def _validate_story_taxonomy(
    db: AsyncSession,
    *,
    age_range_codes: list[str] | None = None,
    theme_codes: list[str] | None = None,
    education_goal_codes: list[str] | None = None,
    narrative_style_code: str | None = None,
) -> None:
    await validate_taxonomy_codes(db, TaxonomyType.AGE_RANGE, age_range_codes or [])
    await validate_taxonomy_codes(db, TaxonomyType.THEME, theme_codes or [])
    await validate_taxonomy_codes(db, TaxonomyType.EDUCATION_GOAL, education_goal_codes or [])
    await validate_taxonomy_codes(db, TaxonomyType.NARRATIVE_STYLE, [narrative_style_code] if narrative_style_code else [])


async def list_stories(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    source_type: StorySourceType | None = None,
    q: str | None = None,
    theme_code: str | None = None,
    age_range_code: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> StoryListRead:
    visible_statuses = [StoryPublishStatus.PUBLISHED]
    if user_id is not None:
        owner_condition = or_(Story.owner_user_id.is_(None), Story.owner_user_id == user_id)
    else:
        owner_condition = Story.owner_user_id.is_(None)
    conditions = [owner_condition, Story.publish_status.in_(visible_statuses)]
    if source_type:
        if source_type == StorySourceType.USER and user_id is not None:
            conditions.append(Story.owner_user_id == user_id)
        else:
            conditions.append(Story.source_type == source_type)
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(or_(Story.title.ilike(pattern), Story.summary.ilike(pattern), Story.body.ilike(pattern)))
    await _validate_story_taxonomy(db, age_range_codes=[age_range_code] if age_range_code else [], theme_codes=[theme_code] if theme_code else [])

    stmt = select(Story).where(*conditions).order_by(Story.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    if theme_code is not None:
        rows = [story for story in rows if theme_code in (story.theme_codes or [])]
    if age_range_code is not None:
        rows = [story for story in rows if age_range_code in (story.age_range_codes or [])]
    total = await db.scalar(select(func.count()).select_from(Story).where(*conditions))
    return StoryListRead(items=[_story_summary(story) for story in rows], total=total or 0, limit=limit, offset=offset)


async def get_story(db: AsyncSession, story_id: int, user_id: int | None = None) -> StoryRead:
    story = await db.get(Story, story_id)
    if story is None or story.publish_status == StoryPublishStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    if story.owner_user_id is not None and story.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    return StoryRead(
        **_story_summary(story).model_dump(),
        body=story.body,
        characters=story.characters,
        moderation_status=story.moderation_status,
        generated_books=await list_generated_books(db, story.id, user_id=user_id),
    )


async def create_user_story(db: AsyncSession, user_id: int, payload: StoryCreate) -> StoryRead:
    await _validate_story_taxonomy(
        db,
        age_range_codes=payload.age_range_codes,
        theme_codes=payload.theme_codes,
        education_goal_codes=payload.education_goal_codes,
        narrative_style_code=payload.narrative_style_code,
    )
    story = Story(
        owner_user_id=user_id,
        source_type=payload.source_type if payload.source_type in {StorySourceType.UPLOADED, StorySourceType.GENERATED_IDEA} else StorySourceType.USER,
        title=payload.title,
        summary=payload.summary,
        body=payload.body,
        meta=_story_meta_with_characters(payload.characters),
        age_range_codes=payload.age_range_codes,
        theme_codes=payload.theme_codes,
        education_goal_codes=payload.education_goal_codes,
        language=payload.language,
        narrative_style_code=payload.narrative_style_code,
        moderation_status=StoryModerationStatus.APPROVED,
        publish_status=StoryPublishStatus.PUBLISHED,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return await get_story(db, story.id, user_id=user_id)


async def generate_user_story(db: AsyncSession, user_id: int, payload: StoryGenerateRequest) -> StoryGenerationTaskResponse:
    await _validate_story_taxonomy(
        db,
        age_range_codes=payload.age_range_codes,
        theme_codes=payload.theme_codes,
        education_goal_codes=payload.education_goal_codes,
        narrative_style_code=payload.narrative_style_code,
    )
    story = Story(
        owner_user_id=user_id,
        source_type=StorySourceType.GENERATED_IDEA,
        title="AI 故事生成中",
        summary=payload.idea_prompt[:160],
        body=payload.idea_prompt,
        meta=_story_meta_with_characters(payload.characters),
        age_range_codes=payload.age_range_codes,
        theme_codes=payload.theme_codes,
        education_goal_codes=payload.education_goal_codes,
        language=payload.language,
        narrative_style_code=payload.narrative_style_code,
        moderation_status=StoryModerationStatus.PENDING,
        publish_status=StoryPublishStatus.DRAFT,
    )
    db.add(story)
    await db.flush()
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.STORY,
            owner_type="story",
            owner_id=story.id,
            user_id=user_id,
            input_payload={
                "idea_prompt": payload.idea_prompt,
                "characters": [character.model_dump(mode="json") for character in payload.characters],
                "language": payload.language,
                "age_range_codes": payload.age_range_codes,
                "theme_codes": payload.theme_codes,
                "narrative_style_code": payload.narrative_style_code,
            },
        ),
    )
    await db.commit()
    await db.refresh(story)
    return StoryGenerationTaskResponse(story=await get_story(db, story.id, user_id=user_id), task=task)


async def run_story_generation_task(db: AsyncSession, task: GenerationTask) -> None:
    story = await db.get(Story, task.owner_id)
    if story is None or story.owner_user_id != task.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    idea_prompt = str((task.input_payload or {}).get("idea_prompt") or story.body or "").strip()
    if not idea_prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="STORY_PROMPT_MISSING")
    input_payload = task.input_payload or {}
    generated_story = await ai_provider.generate_story(
        db,
        task_id=task.id,
        idea_prompt=idea_prompt,
        characters=list(input_payload.get("characters") or story.characters or []),
        language=str(input_payload.get("language") or story.language),
        age_range_codes=list(input_payload.get("age_range_codes") or story.age_range_codes or []),
        theme_codes=list(input_payload.get("theme_codes") or story.theme_codes or []),
        narrative_style_code=str(input_payload.get("narrative_style_code") or story.narrative_style_code or "") or None,
    )
    story.title = generated_story["title"]
    story.summary = generated_story["summary"]
    story.body = generated_story["body"]
    story.meta = {**(story.meta or {}), "characters": list(input_payload.get("characters") or story.characters or [])}
    story.source_type = StorySourceType.GENERATED_IDEA
    story.moderation_status = StoryModerationStatus.APPROVED
    story.publish_status = StoryPublishStatus.PUBLISHED
    await generation_task.mark_task_succeeded(db, task.id, result_refs={"story_id": story.id, "story_preview": story.body[:500]})


async def mark_story_generation_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    story = await db.get(Story, task.owner_id)
    if story is None:
        return
    story.moderation_status = StoryModerationStatus.REJECTED
    story.publish_status = StoryPublishStatus.DELETED


async def update_user_story(db: AsyncSession, user_id: int, story_id: int, payload: StoryUpdate) -> StoryRead:
    story = await db.get(Story, story_id)
    if story is None or story.owner_user_id != user_id or story.publish_status == StoryPublishStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    data = payload.model_dump(exclude_unset=True)
    await _validate_story_taxonomy(
        db,
        age_range_codes=data.get("age_range_codes"),
        theme_codes=data.get("theme_codes"),
        education_goal_codes=data.get("education_goal_codes"),
        narrative_style_code=data.get("narrative_style_code"),
    )
    for field, value in data.items():
        if field == "characters":
            story.meta = {**(story.meta or {}), "characters": [character.model_dump(mode="json") for character in value]}
        else:
            setattr(story, field, value)
    await db.commit()
    await db.refresh(story)
    return await get_story(db, story.id, user_id=user_id)


async def delete_user_story(db: AsyncSession, user_id: int, story_id: int) -> None:
    story = await db.get(Story, story_id)
    if story is None or story.owner_user_id != user_id or story.publish_status == StoryPublishStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    story.publish_status = StoryPublishStatus.DELETED
    await db.commit()


async def assert_story_usable(db: AsyncSession, user_id: int, story_id: int) -> StoryInternalDTO:
    story = await db.get(Story, story_id)
    if story is None or story.publish_status != StoryPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    if story.owner_user_id is not None and story.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权使用该故事")
    return StoryInternalDTO(
        id=story.id,
        owner_user_id=story.owner_user_id,
        title=story.title,
        body=story.body,
        language=story.language,
        age_range_codes=story.age_range_codes or [],
        theme_codes=story.theme_codes or [],
        education_goal_codes=story.education_goal_codes or [],
        characters=story.characters,
        access_level=story.access_level,
    )


async def list_generated_books(db: AsyncSession, story_id: int, user_id: int | None = None) -> list[BookSummary]:
    conditions = [Book.source_story_id == story_id, Book.publish_status == BookPublishStatus.PUBLISHED]
    if user_id is not None:
        conditions.append(or_(Book.owner_user_id.is_(None), Book.owner_user_id == user_id))
    else:
        conditions.append(Book.owner_user_id.is_(None))
    result = await db.execute(select(Book).where(*conditions).order_by(Book.created_at.desc()).limit(12))
    return [BookSummary.model_validate(book) for book in result.scalars().all()]


async def start_creation_from_story(
    db: AsyncSession,
    *,
    user_id: int,
    story_id: int,
    payload: StartCreationFromStoryRequest,
) -> StoryCreationSessionRead:
    story = await assert_story_usable(db, user_id, story_id)
    return StoryCreationSessionRead(
        source_story_id=story.id,
        story_title=story.title,
        prefilled_language=story.language,
        prefilled_age_range_codes=story.age_range_codes,
        prefilled_theme_codes=story.theme_codes,
        guidance="已使用故事正文和文本元数据作为创作来源；后续绘本页面、插图和音频由创作流程生成。",
    )
