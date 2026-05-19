from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.schema.template import (
    TemplateCreateBookResponse,
    TemplateListRead,
    TemplatePreviewResponse,
    TemplateRead,
    TemplateReplacementRequest,
    TemplateValidationResult,
)
from app.service import template

router = APIRouter()


@router.get("", response_model=TemplateListRead)
async def list_templates(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> TemplateListRead:
    return await template.list_templates(db, limit=limit, offset=offset)


@router.get("/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
) -> TemplateRead:
    return await template.get_template(db, template_id)


@router.post("/{template_id}/validate-replacements", response_model=TemplateValidationResult)
async def validate_replacements(
    template_id: int,
    payload: TemplateReplacementRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> TemplateValidationResult:
    return await template.validate_template_replacements(db, user_id=user_id, template_id=template_id, payload=payload)


@router.post("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: int,
    payload: TemplateReplacementRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> TemplatePreviewResponse:
    return await template.preview_template_replacement(db, user_id=user_id, template_id=template_id, payload=payload)


@router.post("/{template_id}/create-book", response_model=TemplateCreateBookResponse)
async def create_book_from_template(
    template_id: int,
    payload: TemplateReplacementRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> TemplateCreateBookResponse:
    return await template.create_book_from_template(db, user_id=user_id, template_id=template_id, payload=payload)
