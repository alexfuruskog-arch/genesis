from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import get_settings
from app.deps import CurrentUser, get_current_user
from app.schemas.documents import DocumentListResponse, UploadDocumentResponse
from app.services.documents import document_service
from app.services.filetypes import SOURCE_KINDS, UnsupportedUploadError
from app.services.membership import PlanLimitError

router = APIRouter(tags=["documents"])


@router.post("/upload-document", response_model=UploadDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    notebook_model: str | None = Form(default=None),
    source_kind: str | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
) -> UploadDocumentResponse:
    settings = get_settings()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File is empty.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB.")
    model = (notebook_model or "").strip().lower() or None
    if model and model not in {"math", "cornell"}:
        raise HTTPException(
            status_code=400,
            detail="notebook_model must be math or cornell.",
        )
    kind = (source_kind or "").strip().lower() or None
    if kind and kind not in SOURCE_KINDS:
        raise HTTPException(
            status_code=400,
            detail="source_kind must be scan or lecture.",
        )
    try:
        result = document_service.upload(
            user=user,
            filename=file.filename or "notes.txt",
            data=data,
            mime_type=file.content_type,
            notebook_model=model,
            source_kind=kind,
        )
    except UnsupportedUploadError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except PlanLimitError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return UploadDocumentResponse(**result)


@router.get("/documents", response_model=DocumentListResponse)
def list_documents(
    user: CurrentUser = Depends(get_current_user),
) -> DocumentListResponse:
    result = document_service.list_for_user(user)
    return DocumentListResponse(**result)


@router.get("/documents/{document_id}/file")
def download_document(
    document_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> Response:
    payload = document_service.read_bytes(user, document_id)
    if not payload:
        raise HTTPException(
            status_code=404,
            detail=(
                "File is not available. Without Supabase storage it lives on this "
                "API instance disk and may be missing after a deploy."
            ),
        )
    filename = payload["filename"].replace('"', "")
    return Response(
        content=payload["data"],
        media_type=payload["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )
