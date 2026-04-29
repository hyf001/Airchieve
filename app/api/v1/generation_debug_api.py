from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.generation_debug import (
    GenerationDebugPageContextResponse,
    GenerationDebugPageItem,
    GenerationDebugPromptPreviewResponse,
    GenerationDebugRunResponse,
    GenerationDebugRunUpdate,
    GenerationDebugStorybookItem,
    PageGenerationDebugParams,
)
from app.services import generation_debug_service


router = APIRouter(prefix="/generation-debug")


@router.get("/storybooks", response_model=list[GenerationDebugStorybookItem])
async def search_storybooks(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=100),
    _admin: User = Depends(get_current_admin),
):
    return await generation_debug_service.search_storybooks(q, limit)


@router.get("/storybooks/{storybook_id}/pages", response_model=list[GenerationDebugPageItem])
async def list_pages(
    storybook_id: int,
    _admin: User = Depends(get_current_admin),
):
    return await generation_debug_service.list_content_pages(storybook_id)


@router.get("/pages/{page_id}/context", response_model=GenerationDebugPageContextResponse)
async def get_page_context(
    page_id: int,
    _admin: User = Depends(get_current_admin),
):
    try:
        return await generation_debug_service.get_page_context(page_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pages/{page_id}/prompt-preview", response_model=GenerationDebugPromptPreviewResponse)
async def prompt_preview(
    page_id: int,
    req: PageGenerationDebugParams,
    _admin: User = Depends(get_current_admin),
):
    preview = await generation_debug_service.preview_prompt(page_id, req)
    return GenerationDebugPromptPreviewResponse(
        prompt=preview.prompt,
        input_resources=[asdict(resource) for resource in preview.input_resources],
    )


@router.post("/pages/{page_id}/runs", response_model=GenerationDebugRunResponse)
async def create_run(
    page_id: int,
    req: PageGenerationDebugParams,
    admin: User = Depends(get_current_admin),
):
    try:
        return await generation_debug_service.create_run(page_id, req, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/pages/{page_id}/runs", response_model=list[GenerationDebugRunResponse])
async def list_runs(
    page_id: int,
    _admin: User = Depends(get_current_admin),
):
    return await generation_debug_service.list_runs(page_id)


@router.get("/runs/{run_id}", response_model=GenerationDebugRunResponse)
async def get_run(
    run_id: int,
    _admin: User = Depends(get_current_admin),
):
    run = await generation_debug_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="调试记录不存在")
    return run


@router.patch("/runs/{run_id}", response_model=GenerationDebugRunResponse)
async def update_run(
    run_id: int,
    req: GenerationDebugRunUpdate,
    _admin: User = Depends(get_current_admin),
):
    run = await generation_debug_service.update_run(run_id, req)
    if not run:
        raise HTTPException(status_code=404, detail="调试记录不存在")
    return run
