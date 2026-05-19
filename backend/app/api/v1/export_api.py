from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.schema.export import ExportFileUrlRead, ExportJobCreate, ExportJobListRead, ExportJobRead
from app.service import export as export_service

router = APIRouter()


@router.post("/book/{book_id}", response_model=ExportJobRead, status_code=status.HTTP_201_CREATED)
async def create_export_job(
    book_id: int,
    payload: ExportJobCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ExportJobRead:
    return await export_service.create_export_job(db, user_id, book_id, payload)


@router.get("/jobs", response_model=ExportJobListRead)
async def list_export_jobs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ExportJobListRead:
    return await export_service.list_export_jobs(db, user_id, limit=limit, offset=offset)


@router.get("/jobs/{export_id}/file-download")
async def download_placeholder_pdf(
    export_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await export_service.get_export_file_url(db, user_id, export_id)
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj\n"
        b"4 0 obj << /Length 44 >> stream\nBT /F1 18 Tf 40 80 Td (AIrchieve PDF Export) Tj ET\nendstream endobj\n"
        b"trailer << /Root 1 0 R >>\n%%EOF\n"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="airchieve-export-{export_id}.pdf"'},
    )


@router.get("/jobs/{export_id}", response_model=ExportJobRead)
async def get_export_job(
    export_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ExportJobRead:
    return await export_service.get_export_job(db, user_id, export_id)


@router.get("/jobs/{export_id}/file-url", response_model=ExportFileUrlRead)
async def get_export_file_url(
    export_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ExportFileUrlRead:
    return await export_service.get_export_file_url(db, user_id, export_id)
