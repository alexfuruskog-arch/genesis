from uuid import UUID

from pydantic import BaseModel, Field


class GenerateQuizRequest(BaseModel):
    document_id: UUID
    question_count: int = Field(default=5, ge=1, le=15)
    topic: str | None = None


class QuizQuestion(BaseModel):
    id: str
    question: str
    choices: list[str]
    correct_index: int
    explanation: str


class GenerateQuizResponse(BaseModel):
    quiz_session_id: str
    document_id: str
    provider: str
    retrieval: dict
    questions: list[QuizQuestion]
    store: str
