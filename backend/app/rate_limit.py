"""Small in-process fixed-window rate limiter used as a FastAPI dependency.

Limits are tracked per client IP and per limiter name, in memory. This protects a
single process against credential stuffing and CPU-heavy abuse; behind multiple
workers or replicas, put a shared limiter (e.g. reverse proxy or Redis) in front.
"""

import logging
import time
from collections import deque
from threading import Lock

from fastapi import Request

from app.config import settings
from app.exceptions import TooManyRequestsError

logger = logging.getLogger(__name__)

_MAX_TRACKED_KEYS = 10_000


class RateLimiter:
    """Allow at most `limit` requests per `window_seconds` per client IP."""

    def __init__(self, name: str, limit: int, window_seconds: int = 60) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def reset(self) -> None:
        """Forget all recorded requests (used by tests)."""
        with self._lock:
            self._hits.clear()

    def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            if len(self._hits) > _MAX_TRACKED_KEYS:
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > cutoff}
            hits = self._hits.setdefault(client, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = max(1, int(hits[0] + self.window_seconds - now) + 1)
                logger.warning("Rate limit '%s' exceeded", self.name)
                raise TooManyRequestsError(retry_after)
            hits.append(now)


limit_register = RateLimiter("register", limit=5)
limit_login = RateLimiter("login", limit=10)
limit_refresh = RateLimiter("refresh", limit=30)
limit_google = RateLimiter("google", limit=20)
limit_export = RateLimiter("export", limit=20)
limit_import = RateLimiter("import", limit=10)

ALL_LIMITERS: tuple[RateLimiter, ...] = (
    limit_register,
    limit_login,
    limit_refresh,
    limit_google,
    limit_export,
    limit_import,
)
