"""Resume import endpoint: upload a resume file, get back an editable draft (not saved)."""

import logging

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_current_user
from app.models.user import User
from app.rate_limit import limit_import
from app.schemas.importer import ImportResult
from app.services import import_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

_MAX_BODY_OVERHEAD = 64 * 1024  # multipart boundaries and part headers


@router.post("/resume", response_model=ImportResult, dependencies=[Depends(limit_import)])
async def import_resume(
    request: Request,
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> ImportResult:
    """Parse an uploaded resume (PDF, DOCX, ODT, RTF, TXT, MD, HTML) into a draft."""
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > import_service.MAX_UPLOAD_BYTES + _MAX_BODY_OVERHEAD:
        raise import_service.FileTooLargeError("The file is too large. The maximum size is 5 MB.")
    # Never trust Content-Length alone: read at most one byte past the limit.
    data = await file.read(import_service.MAX_UPLOAD_BYTES + 1)
    await file.close()
    return await run_in_threadpool(import_service.import_resume, file.filename, data)
