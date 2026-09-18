from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import get_settings
from app.deps import CurrentUser, get_current_user
from app.schemas.documents import UploadDocumentResponse
from app.services.documents import document_service

router = APIRouter(tags=["documents"])


@router.post("/upload-document", response_model=UploadDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
) -> UploadDocumentResponse:
    settings = get_settings()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Filen är tom.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Filen är större än 10 MB.")
    try:
        result = document_service.upload(
            user=user,
            filename=file.filename or "dokument.txt",
            data=data,
            mime_type=file.content_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return UploadDocumentResponse(**result)
