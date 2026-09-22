from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.deps import CurrentUser
from app.services.extraction import chunk_text, extract_text
from app.services.filetypes import (
    assert_supported_upload,
    kind_label,
    normalize_source_kind,
)
from app.services.llm import llm_client
from app.services.membership import membership_service
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
        notebook_model: str | None = None,
        source_kind: str | None = None,
    ) -> dict:
        assert_supported_upload(filename, mime_type)
        membership_service.assert_can_scan(user)
        document_id = str(uuid4())
        safe_name = Path(filename).name or "notes.txt"
        kind = normalize_source_kind(source_kind, notebook_model)
        model = notebook_model if kind == "scan" else None
        # Path prefix = auth user id so Supabase storage RLS can scope by folder.
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
            "extraction_status": "ready" if extraction_mode == "extracted" and chunks else (
                "stubbed" if extraction_mode == "stubbed" else "empty"
            ),
            "storage_backend": stored_via,
            "notebook_model": model,
            "source_kind": kind,
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

        noun = "Lecture file" if kind == "lecture" else "Scan"
        return {
            **document,
            "chunk_count": len(chunk_rows),
            "store": store.backend,
            "extraction_mode": extraction_mode,
            "storage_backend": stored_via,
            "source_kind": kind,
            "kind_label": kind_label(safe_name, mime_type),
            "message": (
                f"{noun} saved to your library"
                + (
                    " and split into chunks. Select it to generate a practice exam or flashcards."
                    if extraction_mode == "extracted" and chunk_rows
                    else ". It is listed even if text extraction is not ready yet."
                )
            ),
        }

    def list_for_user(self, user: CurrentUser) -> dict:
        documents = store.list_documents(user.id)
        enriched = []
        for document in documents:
            chunks = store.list_chunks(user.id, document["id"])
            filename = document.get("filename") or ""
            mime = document.get("mime_type")
            enriched.append(
                {
                    **document,
                    "chunk_count": len(chunks),
                    "storage_backend": document.get("storage_backend")
                    or ("supabase" if store.backend == "supabase" else "local"),
                    "source_kind": document.get("source_kind")
                    or ("scan" if document.get("notebook_model") else "lecture"),
                    "kind_label": kind_label(filename, mime),
                }
            )
        return {
            "documents": enriched,
            "store": store.backend,
            "cloud_enabled": bool(get_supabase_client()),
        }

    def generate_study(
        self,
        user: CurrentUser,
        document_ids: list[str],
        question_count: int,
        topic: str | None,
        output_type: str,
    ) -> dict:
        if not document_ids:
            raise ValueError("Select at least one item in your library.")
        membership_service.assert_can_chat(user)

        documents = []
        for document_id in document_ids:
            document = store.get_document(user.id, document_id)
            if not document:
                raise KeyError(f"Document not found: {document_id}")
            documents.append(document)

        query_embedding = None
        seed = topic or ", ".join(doc.get("filename") or "" for doc in documents)
        if seed:
            embedded = llm_client.embed([seed])
            query_embedding = embedded[0] if embedded else None

        retrieved: list[dict] = []
        per_doc = max(3, 10 // max(len(document_ids), 1))
        for document_id in document_ids:
            rows = store.match_chunks(
                user.id,
                document_id,
                query_embedding,
                match_count=per_doc,
            )
            retrieved.extend(rows)

        if not retrieved:
            raise ValueError(
                "No extractable text in the selected files yet. PDFs, Word, and PowerPoint "
                "with real text work best; photos are stored but OCR is not connected yet."
            )

        source_text = "\n\n".join(item.get("content") or "" for item in retrieved)
        now = datetime.now(timezone.utc).isoformat()
        primary_id = document_ids[0]

        if output_type == "flashcards":
            flashcards = llm_client.generate_flashcards(source_text, question_count, topic)
            session = {
                "id": str(uuid4()),
                "user_id": user.id,
                "document_id": primary_id,
                "document_ids": document_ids,
                "output_type": "flashcards",
                "progress": 0,
                "score": None,
                "history": [],
                "questions": [],
                "flashcards": [card.model_dump() for card in flashcards],
                "status": "ready",
                "created_at": now,
                "updated_at": now,
            }
            saved = store.create_quiz_session(session)
            return {
                "quiz_session_id": saved["id"],
                "document_id": primary_id,
                "document_ids": document_ids,
                "output_type": "flashcards",
                "provider": llm_client.provider_name,
                "retrieval": {
                    "mode": "pgvector" if query_embedding else "sequential",
                    "chunk_count": len(retrieved),
                    "document_count": len(document_ids),
                },
                "questions": [],
                "flashcards": flashcards,
                "store": store.backend,
            }

        questions = llm_client.generate_quiz(source_text, question_count, topic)
        session = {
            "id": str(uuid4()),
            "user_id": user.id,
            "document_id": primary_id,
            "document_ids": document_ids,
            "output_type": "quiz",
            "progress": 0,
            "score": None,
            "history": [],
            "questions": [question.model_dump() for question in questions],
            "flashcards": [],
            "status": "in_progress",
            "created_at": now,
            "updated_at": now,
        }
        saved = store.create_quiz_session(session)
        return {
            "quiz_session_id": saved["id"],
            "document_id": primary_id,
            "document_ids": document_ids,
            "output_type": "quiz",
            "provider": llm_client.provider_name,
            "retrieval": {
                "mode": "pgvector" if query_embedding else "sequential",
                "chunk_count": len(retrieved),
                "document_count": len(document_ids),
            },
            "questions": questions,
            "flashcards": [],
            "store": store.backend,
        }

    def generate_quiz(
        self,
        user: CurrentUser,
        document_id: str,
        question_count: int,
        topic: str | None,
    ) -> dict:
        return self.generate_study(
            user=user,
            document_ids=[document_id],
            question_count=question_count,
            topic=topic,
            output_type="quiz",
        )

    def read_bytes(self, user: CurrentUser, document_id: str) -> dict | None:
        document = store.get_document(user.id, document_id)
        if not document:
            return None
        storage_path = document.get("storage_path") or ""
        data = self._read_bytes(storage_path)
        if data is None:
            return None
        filename = document.get("filename") or Path(storage_path).name or "file"
        return {
            "document": document,
            "filename": filename,
            "mime_type": document.get("mime_type") or "application/octet-stream",
            "data": data,
        }

    def _local_root(self) -> Path:
        root = Path(self.settings.local_upload_dir)
        if not root.is_absolute():
            root = Path(__file__).resolve().parents[2] / root
        return root

    def _persist_bytes(self, storage_path: str, data: bytes, mime_type: str | None) -> str:
        local_root = self._local_root().resolve()
        local_root.mkdir(parents=True, exist_ok=True)
        local_file = (local_root / storage_path).resolve()
        if not local_file.is_relative_to(local_root):
            raise ValueError("Invalid storage path.")
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

    def _read_bytes(self, storage_path: str) -> bytes | None:
        local_root = self._local_root().resolve()
        local_file = (local_root / storage_path).resolve()
        if local_file.is_relative_to(local_root) and local_file.is_file():
            return local_file.read_bytes()

        client = get_supabase_client()
        if not client:
            return None
        try:
            return client.storage.from_("documents").download(storage_path)
        except Exception:
            return None


document_service = DocumentService()
