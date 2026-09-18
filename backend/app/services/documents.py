from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.deps import CurrentUser
from app.services.extraction import chunk_text, extract_text
from app.services.llm import llm_client
from app.services.store import store
from app.services.supabase_client import get_supabase_client


class DocumentService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def upload(
        self,
        user: CurrentUser,
        filename: str,
        data: bytes,
        mime_type: str | None,
    ) -> dict:
        document_id = str(uuid4())
        safe_name = Path(filename).name or "dokument.txt"
        storage_path = f"{user.id}/{document_id}_{safe_name}"
        stored_via = self._persist_bytes(storage_path, data, mime_type)

        text, extraction_mode = extract_text(safe_name, mime_type, data)
        chunks = chunk_text(text)
        embeddings = llm_client.embed(chunks) if chunks else None

        now = datetime.now(timezone.utc).isoformat()
        document = {
            "id": document_id,
            "user_id": user.id,
            "filename": safe_name,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "byte_size": len(data),
            "extraction_status": "ready" if chunks else "empty",
            "created_at": now,
        }
        store.create_document(document)

        chunk_rows = []
        for index, content in enumerate(chunks):
            row = {
                "id": str(uuid4()),
                "document_id": document_id,
                "user_id": user.id,
                "chunk_index": index,
                "content": content,
                "created_at": now,
            }
            if embeddings:
                row["embedding"] = embeddings[index]
            chunk_rows.append(row)
        store.save_chunks(chunk_rows)

        return {
            **document,
            "chunk_count": len(chunk_rows),
            "store": store.backend,
            "extraction_mode": extraction_mode,
            "storage_backend": stored_via,
            "message": (
                "Dokumentet är sparat och texten är uppdelad i chunkar. "
                "Generera ett quiz när du är redo."
            ),
        }

    def generate_quiz(
        self,
        user: CurrentUser,
        document_id: str,
        question_count: int,
        topic: str | None,
    ) -> dict:
        document = store.get_document(user.id, document_id)
        if not document:
            raise KeyError("Dokumentet hittades inte.")

        query_embedding = None
        if topic:
            embedded = llm_client.embed([topic])
            query_embedding = embedded[0] if embedded else None
        elif document.get("filename"):
            embedded = llm_client.embed([document["filename"]])
            query_embedding = embedded[0] if embedded else None

        retrieved = store.match_chunks(
            user.id,
            document_id,
            query_embedding,
            match_count=8,
        )
        if not retrieved:
            raise ValueError("Inga textchunkar finns för dokumentet ännu.")

        source_text = "\n\n".join(item.get("content") or "" for item in retrieved)
        questions = llm_client.generate_quiz(source_text, question_count, topic)
        session = {
            "id": str(uuid4()),
            "user_id": user.id,
            "document_id": document_id,
            "progress": 0,
            "score": None,
            "history": [],
            "questions": [question.model_dump() for question in questions],
            "status": "in_progress",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        saved = store.create_quiz_session(session)
        return {
            "quiz_session_id": saved["id"],
            "document_id": document_id,
            "provider": llm_client.provider_name,
            "retrieval": {
                "mode": "pgvector" if query_embedding else "sequential",
                "chunk_count": len(retrieved),
            },
            "questions": questions,
            "store": store.backend,
        }

    def _persist_bytes(self, storage_path: str, data: bytes, mime_type: str | None) -> str:
        local_root = Path(self.settings.local_upload_dir)
        local_root.mkdir(parents=True, exist_ok=True)
        local_file = local_root / storage_path
        local_file.parent.mkdir(parents=True, exist_ok=True)
        local_file.write_bytes(data)

        client = get_supabase_client()
        if not client:
            return "local"
        try:
            options = {"content-type": mime_type or "application/octet-stream", "upsert": "true"}
            client.storage.from_("documents").upload(storage_path, data, options)
            return "supabase"
        except Exception:
            return "local"


document_service = DocumentService()
