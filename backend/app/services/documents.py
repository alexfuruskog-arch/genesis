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

CHIP_PROMPTS = {
    "explain": (
        "Explain the main ideas in this file as if teaching a student. "
        "Stay grounded in the notes; do not invent facts."
    ),
    "summarize": (
        "Summarize this file for studying. Cover the main ideas in a short, structured recap."
    ),
}

CHIP_LABELS = {
    "explain": "Explain this",
    "summarize": "Summarize",
    "flashcards": "Make flashcards",
    "quiz": "Quiz me",
}


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
        chip_id: str | None = None,
    ) -> dict:
        if not document_ids:
            raise ValueError("Select one item in your library.")
        if output_type not in {"flashcards", "questions", "quiz"}:
            raise ValueError("output_type must be flashcards or questions.")
        canonical = "flashcards" if output_type == "flashcards" else "questions"
        membership_service.assert_can_chat(user)

        for document_id in document_ids:
            document = store.get_document(user.id, document_id)
            if not document:
                raise KeyError(f"Document not found: {document_id}")
            if document.get("extraction_status") != "ready":
                raise ValueError(
                    "No extractable text in this file yet. PDFs, Word, PowerPoint, and "
                    "text files with real text work best; photos are stored but OCR is "
                    "not connected yet."
                )

        retrieved, query_embedding, source_text = self._retrieve(
            user, document_ids, topic
        )
        now = datetime.now(timezone.utc).isoformat()
        primary_id = document_ids[0]
        retrieval = {
            "mode": "pgvector" if query_embedding else "sequential",
            "chunk_count": len(retrieved),
            "document_count": len(document_ids),
        }

        if canonical == "flashcards":
            flashcards = llm_client.generate_flashcards(source_text, question_count, topic)
            session = {
                "id": str(uuid4()),
                "user_id": user.id,
                "document_id": primary_id,
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
            payload = self._session_payload(
                saved,
                document_ids=document_ids,
                retrieval=retrieval,
                questions=[],
                flashcards=flashcards,
            )
            self._record_turn(
                user_id=user.id,
                document_id=primary_id,
                user_content="Make flashcards",
                assistant_content="Flashcards from this file.",
                prompt_kind="chip",
                chip_id=chip_id or "flashcards",
                retrieval=retrieval,
                quiz_session_id=saved["id"],
            )
            return payload

        questions = llm_client.generate_quiz(source_text, question_count, topic)
        session = {
            "id": str(uuid4()),
            "user_id": user.id,
            "document_id": primary_id,
            "output_type": "questions",
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
        payload = self._session_payload(
            saved,
            document_ids=document_ids,
            retrieval=retrieval,
            questions=questions,
            flashcards=[],
        )
        self._record_turn(
            user_id=user.id,
            document_id=primary_id,
            user_content="Quiz me",
            assistant_content="Short quiz from this file.",
            prompt_kind="chip",
            chip_id=chip_id or "quiz",
            retrieval=retrieval,
            quiz_session_id=saved["id"],
        )
        return payload

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
            output_type="questions",
            chip_id="quiz",
        )

    def ask(
        self,
        user: CurrentUser,
        document_id: str,
        message: str,
        prompt_kind: str,
        chip_id: str | None,
    ) -> dict:
        chip = (chip_id or "").strip().lower() or None
        if chip in {"exam", "plan"}:
            raise ValueError(
                "This chip is visible for the composer, but Practice exam and "
                "Make a study plan are not generated yet."
            )
        if chip in {"flashcards", "quiz"}:
            raise ValueError("Use /generate-study for flashcards and quizzes.")
        document = store.get_document(user.id, document_id)
        if not document:
            raise KeyError(f"Document not found: {document_id}")
        if document.get("extraction_status") != "ready":
            raise ValueError(
                "No extractable text in this file yet. PDFs, Word, PowerPoint, and "
                "text files with real text work best; photos are stored but OCR is "
                "not connected yet."
            )
        membership_service.assert_can_chat(user)

        question = message.strip()
        if prompt_kind == "chip" and chip in CHIP_PROMPTS:
            question = CHIP_PROMPTS[chip]
        if not question:
            raise ValueError("Write a question about this file.")

        retrieved, query_embedding, source_text = self._retrieve(
            user, [document_id], question
        )
        answer = llm_client.generate_answer(source_text, question)
        retrieval = {
            "mode": "pgvector" if query_embedding else "sequential",
            "chunk_count": len(retrieved),
            "document_count": 1,
        }
        display = message.strip()
        if prompt_kind == "chip" and chip in CHIP_LABELS:
            display = CHIP_LABELS[chip]
        user_row, assistant_row = self._record_turn(
            user_id=user.id,
            document_id=document_id,
            user_content=display,
            assistant_content=answer,
            prompt_kind=prompt_kind,
            chip_id=chip,
            retrieval=retrieval,
            quiz_session_id=None,
        )
        return {
            "message": self._message_payload(assistant_row),
            "user_message": self._message_payload(user_row),
            "provider": llm_client.provider_name,
            "retrieval": retrieval,
            "store": store.backend,
        }

    def get_quiz_session(self, user: CurrentUser, session_id: str) -> dict:
        row = store.get_quiz_session(user.id, session_id)
        if not row:
            raise KeyError("Quiz session not found.")
        return self._session_payload(row)

    def rate_flashcard(
        self,
        user: CurrentUser,
        session_id: str,
        card_id: str,
        rating: str,
    ) -> dict:
        row = store.get_quiz_session(user.id, session_id)
        if not row:
            raise KeyError("Quiz session not found.")
        cards = row.get("flashcards") or []
        if cards and not any(str(card.get("id")) == card_id for card in cards):
            raise ValueError("That card is not in this deck.")
        now = datetime.now(timezone.utc).isoformat()
        history = list(row.get("history") or [])
        history.append({"card_id": card_id, "rating": rating, "at": now})
        row["history"] = history
        row["updated_at"] = now
        saved = store.update_quiz_session(row)
        return self._session_payload(saved)

    def list_messages(self, user: CurrentUser, document_id: str) -> dict:
        if not store.get_document(user.id, document_id):
            raise KeyError(f"Document not found: {document_id}")
        rows = store.list_study_messages(user.id, document_id)
        messages = []
        for row in rows:
            payload = self._message_payload(row)
            session_id = row.get("quiz_session_id")
            if session_id:
                session = store.get_quiz_session(user.id, str(session_id))
                if session:
                    payload["quiz_session"] = self._session_payload(session)
            messages.append(payload)
        return {"messages": messages, "store": store.backend}

    def _retrieve(
        self,
        user: CurrentUser,
        document_ids: list[str],
        seed: str | None,
    ) -> tuple[list[dict], list[float] | None, str]:
        query_embedding = None
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
                "No extractable text in this file yet. PDFs, Word, PowerPoint, and "
                "text files with real text work best; photos are stored but OCR is "
                "not connected yet."
            )
        source_text = "\n\n".join(item.get("content") or "" for item in retrieved)
        return retrieved, query_embedding, source_text

    def _session_payload(
        self,
        row: dict,
        document_ids: list[str] | None = None,
        retrieval: dict | None = None,
        questions: list | None = None,
        flashcards: list | None = None,
    ) -> dict:
        document_id = row.get("document_id")
        ids = document_ids or ([document_id] if document_id else [])
        output_type = row.get("output_type") or "questions"
        if output_type == "quiz":
            output_type = "questions"
        history = row.get("history") or []
        return {
            "quiz_session_id": row.get("id"),
            "document_id": document_id,
            "document_ids": ids,
            "output_type": output_type,
            "provider": llm_client.provider_name,
            "retrieval": retrieval or {"mode": "stored", "chunk_count": 0},
            "questions": questions if questions is not None else row.get("questions") or [],
            "flashcards": flashcards if flashcards is not None else row.get("flashcards") or [],
            "history": history,
            "store": store.backend,
        }

    def _record_turn(
        self,
        user_id: str,
        document_id: str,
        user_content: str,
        assistant_content: str,
        prompt_kind: str,
        chip_id: str | None,
        retrieval: dict,
        quiz_session_id: str | None,
    ) -> tuple[dict, dict]:
        now = datetime.now(timezone.utc).isoformat()
        user_row = store.create_study_message(
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "document_id": document_id,
                "role": "user",
                "content": user_content,
                "prompt_kind": prompt_kind,
                "chip_id": chip_id,
                "retrieval": None,
                "quiz_session_id": None,
                "created_at": now,
            }
        )
        assistant_row = store.create_study_message(
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "document_id": document_id,
                "role": "assistant",
                "content": assistant_content,
                "prompt_kind": prompt_kind,
                "chip_id": chip_id,
                "retrieval": retrieval,
                "quiz_session_id": quiz_session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return user_row, assistant_row

    def _message_payload(self, row: dict) -> dict:
        created = row.get("created_at")
        if hasattr(created, "isoformat"):
            created = created.isoformat()
        return {
            "id": str(row.get("id")),
            "document_id": row.get("document_id"),
            "role": row.get("role"),
            "content": row.get("content") or "",
            "prompt_kind": row.get("prompt_kind"),
            "chip_id": row.get("chip_id"),
            "retrieval": row.get("retrieval"),
            "quiz_session_id": row.get("quiz_session_id"),
            "created_at": str(created or ""),
        }

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
