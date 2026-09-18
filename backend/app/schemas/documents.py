from datetime import datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: str
    filename: str
    storage_path: str
    mime_type: str | None = None
    byte_size: int | None = None
    extraction_status: str
    chunk_count: int = 0
    created_at: datetime


class UploadDocumentResponse(DocumentResponse):
    store: str = Field(description="supabase or memory")
    extraction_mode: str = Field(description="extracted or stubbed")
    message: str
