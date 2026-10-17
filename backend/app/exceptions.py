"""Custom application exceptions and FastAPI handlers."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base class for all domain errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str = "Internal server error",
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(AppException):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found")


class ConflictError(AppException):
    status_code = 409
    code = "CONFLICT"

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message)


class BadRequestError(AppException):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message)


class UnauthorizedError(AppException):
    status_code = 401
    code = "UNAUTHORIZED"

    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(message)


class ForbiddenError(AppException):
    status_code = 403
    code = "FORBIDDEN"

    def __init__(self, message: str = "Not allowed") -> None:
        super().__init__(message)


class TooManyRequestsError(AppException):
    status_code = 429
    code = "RATE_LIMITED"

    def __init__(self, retry_after: int = 60) -> None:
        super().__init__("Too many requests. Please try again later.")
        self.retry_after = retry_after


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppException):
        return await unhandled_exception_handler(request, exc)
    headers: dict[str, str] | None = None
    if exc.status_code == 401:
        headers = {"WWW-Authenticate": "Bearer"}
    elif isinstance(exc, TooManyRequestsError):
        headers = {"Retry-After": str(exc.retry_after)}
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
        headers=headers,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the app."""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
