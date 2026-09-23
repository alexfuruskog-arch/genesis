from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field, model_validator


OutputType = Literal["quiz", "flashcards", "ovningstenta", "questions"]
CanonicalOutputType = Literal["questions", "flashcards"]
PromptKind = Literal["chip", "free_text"]
CardRating = Literal["know", "still_learning"]


class GenerateQuizRequest(BaseModel):
    """Generate study material from one library file (document_ids kept for older clients)."""

    document_id: UUID | None = None
    document_ids: list[UUID] | None = None
    question_count: int = Field(default=5, ge=1, le=20)
    topic: str | None = None
    output_type: OutputType = "questions"

    @model_validator(mode="after")
    def require_documents(self) -> "GenerateQuizRequest":
        ids = list(self.document_ids or [])
        if self.document_id is not None:
            ids.append(self.document_id)
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
        self.document_id = unique[0]
        return self

    @property
    def resolved_document_ids(self) -> list[str]:
        return [str(item) for item in (self.document_ids or [])]

    @property
    def resolved_output_type(self) -> CanonicalOutputType:
        if self.output_type in ("quiz", "ovningstenta", "questions"):
            return "questions"
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


class FlashcardRating(BaseModel):
    card_id: str
    rating: CardRating
    at: str | None = None


class GenerateQuizResponse(BaseModel):
    quiz_session_id: str
    document_id: str | None = None
    document_ids: list[str]
    output_type: CanonicalOutputType = "questions"
    provider: str
    retrieval: dict
    questions: list[QuizQuestion] = Field(default_factory=list)
    flashcards: list[Flashcard] = Field(default_factory=list)
    history: list[FlashcardRating] = Field(default_factory=list)
    store: str


class AskRequest(BaseModel):
    document_id: UUID
    message: str = Field(min_length=1, max_length=4000)
    prompt_kind: PromptKind = "free_text"
    chip_id: str | None = None


class StudyMessage(BaseModel):
    id: str
    document_id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    prompt_kind: PromptKind | None = None
    chip_id: str | None = None
    retrieval: dict | None = None
    quiz_session_id: str | None = None
    created_at: str
    quiz_session: GenerateQuizResponse | None = None


class AskResponse(BaseModel):
    message: StudyMessage
    user_message: StudyMessage
    provider: str
    retrieval: dict
    store: str


class StudyMessageListResponse(BaseModel):
    messages: list[StudyMessage]
    store: str


class RateFlashcardRequest(BaseModel):
    card_id: str
    rating: CardRating
