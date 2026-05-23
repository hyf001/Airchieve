from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
import asyncio

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import async_session_maker, init_db
from app.service.asset.seed import seed_character_categories, seed_system_art_styles
from app.worker.runner import run_worker


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    async with async_session_maker() as session:
        await seed_system_art_styles(session)
        await seed_character_categories(session)
    worker_task: asyncio.Task | None = None
    stop_worker = asyncio.Event()
    if settings.WORKER_ENABLED:
        # TODO(worker-concurrency): This starts one in-process worker loop only.
        # If we add in-process concurrency later, pass a configured concurrency value
        # into run_worker instead of starting extra FastAPI lifespan tasks here.
        worker_task = asyncio.create_task(run_worker(stop_event=stop_worker))
    try:
        yield
    finally:
        if worker_task is not None:
            stop_worker.set()
            try:
                await asyncio.wait_for(worker_task, timeout=settings.WORKER_SHUTDOWN_TIMEOUT_SECONDS)
            except TimeoutError:
                worker_task.cancel()
                try:
                    await worker_task
                except asyncio.CancelledError:
                    pass


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        version=settings.VERSION,
        lifespan=lifespan,
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"])
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "service": settings.PROJECT_NAME})

    return app


app = create_app()
