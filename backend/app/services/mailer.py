"""Outgoing email. Never raises to the caller; failures are logged by type only."""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT_SECONDS = 10


def _build_message(to_email: str, code: str, minutes: int) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = "Your RajResumeGenie password reset code"
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email
    message.set_content(
        "Hi there,\n\n"
        "We received a request to reset your RajResumeGenie password.\n\n"
        f"Your reset code is: {code}\n\n"
        f"This code expires in {minutes} minutes and can only be used once.\n\n"
        "If you didn't request this, ignore this email. Your password will not change.\n\n"
        "- The RajResumeGenie team\n"
    )
    return message


def _send_smtp(to_email: str, code: str, minutes: int) -> None:
    message = _build_message(to_email, code, minutes)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=_SMTP_TIMEOUT_SECONDS) as s:
        if settings.SMTP_USE_TLS:
            s.starttls(context=ssl.create_default_context())
        if settings.SMTP_USERNAME:
            s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        s.send_message(message)


def send_password_reset_email(to_email: str, code: str, minutes: int) -> None:
    """Send the reset code. Blocking: call it as a background task (runs in a thread)."""
    backend = settings.EMAIL_BACKEND
    try:
        if backend == "console":
            logger.warning(
                "DEV ONLY - EMAIL_BACKEND=console: password reset code for %s is %s",
                to_email,
                code,
            )
        elif backend == "smtp":
            if not settings.SMTP_HOST:
                logger.warning("EMAIL_BACKEND=smtp but SMTP_HOST is empty; email not sent")
                return
            _send_smtp(to_email, code, minutes)
            logger.info("Password reset email sent")
        else:
            logger.warning("No email backend configured (EMAIL_BACKEND=disabled); email not sent")
    except Exception as exc:  # mail failures must never break the request
        logger.error("Failed to send password reset email: %s", type(exc).__name__)
