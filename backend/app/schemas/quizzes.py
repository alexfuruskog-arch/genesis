from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GenerateQuizRequest(BaseModel):
    """Generate study material from one or more scanned notes."""

    document_id: UUID | None = None
    document_ids: list[UUID] | None = None
    question_count: int = Field(default=5, ge=1, le=20)
    topic: str | None = None
    output_type: Literal["quiz", "flashcards", "ovningstenta"] = "quiz"

    @model_validator(mode="after")
    def require_documents(self) -> "GenerateQuizRequest":
        ids = list(self.document_ids or [])
        if self.document_id is not None:
            ids.append(self.document_id)
        # dedupe while preserving order
        seen: set[str] = set()
        unique: list[UUID] = []
        for item in ids:
            key = str(item)
            if key not in seen:
                seen.add(key)
                unique.append(item)
        if not unique:
            raise ValueError("Provide document_id or document_ids.")
        self.document_ids = unique
        return self

    @property
    def resolved_document_ids(self) -> list[str]:
        return [str(item) for item in (self.document_ids or [])]

    @property
    def resolved_output_type(self) -> Literal["quiz", "flashcards"]:
        if self.output_type in ("quiz", "ovningstenta"):
            return "quiz"
        return "flashcards"


class QuizQuestion(BaseModel):
    id: str
    question: str
    choices: list[str]
    correct_index: int
    explanation: str


class Flashcard(BaseModel):
    id: str
    front: str
    back: str


class GenerateQuizResponse(BaseModel):
    quiz_session_id: str
    document_id: str | None = None
    document_ids: list[str]
    output_type: Literal["quiz", "flashcards"] = "quiz"
    provider: str
    retrieval: dict
    questions: list[QuizQuestion] = Field(default_factory=list)
    flashcards: list[Flashcard] = Field(default_factory=list)
    store: str
