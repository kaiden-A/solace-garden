from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

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


class RejectMCPGet:
    """Answer ``GET /mcp`` with 405 instead of holding an idle SSE stream open.

    MCP clients open a standalone GET stream after initialize when the server
    allows one. The transport mounted here is stateless with JSON responses, so
    it never sends anything on that stream: keeping it open holds an HTTP
    request - and a Cloud Run instance - alive while there is no work to do.
    The spec allows 405, and the client SDKs treat it as "no stream offered"
    and keep using POST.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] == "GET" and scope["path"] == "/mcp":
            await Response("SSE stream is not supported.", status_code=405)(scope, receive, send)
            return
        await self.app(scope, receive, send)


# Added before CORS so CORS stays the outermost layer and still decorates the
# 405 response.
app.add_middleware(RejectMCPGet)

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
