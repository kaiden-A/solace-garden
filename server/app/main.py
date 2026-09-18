from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import mcp_server, mcp_tools  # noqa: F401  (mcp_tools registers the tools)
from .config import get_settings
from .routers import (
    auth_router,
    feelings_router,
    gifts_router,
    health_router,
    maintenance_router,
    music_router,
    plants_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """The host owns the session manager: a mounted app's lifespan never runs."""
    if not settings.mcp_enabled:
        yield
        return
    mcp_server.start()
    try:
        async with mcp_server.mcp.session_manager.run():
            yield
    finally:
        mcp_server.stop()


app = FastAPI(
    title="Solace Garden API",
    version="0.1.0",
    description="Plants,gifts and auth for the Solace Garden client.",
    lifespan=lifespan,
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """The client reads {"error": "..."} - keep that shape for string details."""
    if isinstance(exc.detail, str):
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=exc.headers)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        {"error": "Check the details you sent.", "details": exc.errors()},
        status_code=422,
    )


app.include_router(health_router.router)
app.include_router(auth_router.router)
app.include_router(plants_router.router)
app.include_router(feelings_router.router)
app.include_router(gifts_router.router)
app.include_router(music_router.router)
app.include_router(maintenance_router.router)

if settings.mcp_enabled:
    # Mounted last on purpose: Starlette tries routes in order, so every
    # /api/* route above wins and the MCP app only sees the rest.
    app.mount("/", mcp_server.mcp_mount)
