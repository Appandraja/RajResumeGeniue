"""FastAPI application entry point."""

import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers
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
