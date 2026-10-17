"""FastAPI application entry point."""

import logging
import logging.config

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint

from app.config import settings
from app.exceptions import register_exception_handlers
from app.rate_limit import client_ip
from app.routers import auth, export, imports, resumes, tailor, templates


def configure_logging() -> None:
    """Configure root logging once at startup."""
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {"format": "%(asctime)s %(levelname)s [%(name)s] %(message)s"}
            },
            "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "default"}},
            "root": {"level": settings.LOG_LEVEL.upper(), "handlers": ["console"]},
        }
    )


configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Let the browser/app read the download filename from cross-origin responses.
        expose_headers=["Content-Disposition"],
    )

    register_exception_handlers(application)

    if settings.DEBUG_CLIENT_IP:
        # Temporary diagnostic for calibrating TRUSTED_PROXY_HOPS on a new host.
        # Exposes no secrets: only the caller's own address and the forwarded chain.
        logger.warning("DEBUG_CLIENT_IP is on: turn it off once TRUSTED_PROXY_HOPS is verified")

        @application.middleware("http")
        async def _debug_client_ip(
            request: Request, call_next: RequestResponseEndpoint
        ) -> Response:
            response = await call_next(request)
            response.headers["X-Debug-Client-IP"] = client_ip(request)
            response.headers["X-Debug-Peer"] = request.client.host if request.client else ""
            response.headers["X-Debug-Forwarded-For"] = request.headers.get("x-forwarded-for", "")
            return response

    # Routers carry their own prefixes: /auth/* and /api/*
    application.include_router(auth.router)
    application.include_router(templates.router)
    application.include_router(resumes.router)
    application.include_router(export.router)
    application.include_router(tailor.router)
    application.include_router(imports.router)

    @application.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "healthy"}

    logger.info("%s v%s initialized", settings.APP_NAME, settings.APP_VERSION)
    return application


app = create_app()
