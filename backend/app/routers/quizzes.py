from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, get_current_user
from app.schemas.quizzes import (
    AskRequest,
    AskResponse,
    GenerateQuizRequest,
    GenerateQuizResponse,
    RateFlashcardRequest,
    StudyMessageListResponse,
)
from app.services.documents import document_service
from app.services.membership import PlanLimitError

router = APIRouter(tags=["quizzes"])


@router.post("/generate-quiz", response_model=GenerateQuizResponse)
def generate_quiz(
    payload: GenerateQuizRequest,
    user: CurrentUser = Depends(get_current_user),
) -> GenerateQuizResponse:
    try:
        result = document_service.generate_study(
            user=user,
            document_ids=payload.resolved_document_ids,
            question_count=payload.question_count,
            topic=payload.topic,
            output_type=payload.resolved_output_type,
            chip_id="flashcards" if payload.resolved_output_type == "flashcards" else "quiz",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PlanLimitError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return GenerateQuizResponse(**result)


@router.post("/generate-study", response_model=GenerateQuizResponse)
def generate_study(
    payload: GenerateQuizRequest,
    user: CurrentUser = Depends(get_current_user),
) -> GenerateQuizResponse:
    """Make flashcards or a short quiz from one library file."""
    return generate_quiz(payload, user)


@router.post("/ask", response_model=AskResponse)
def ask_about_file(
    payload: AskRequest,
    user: CurrentUser = Depends(get_current_user),
) -> AskResponse:
    try:
        result = document_service.ask(
            user=user,
            document_id=str(payload.document_id),
            message=payload.message,
            prompt_kind=payload.prompt_kind,
            chip_id=payload.chip_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PlanLimitError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return AskResponse(**result)


@router.get("/study-messages", response_model=StudyMessageListResponse)
def list_study_messages(
    document_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> StudyMessageListResponse:
    try:
        result = document_service.list_messages(user, document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StudyMessageListResponse(**result)


@router.get("/quiz-sessions/{session_id}", response_model=GenerateQuizResponse)
def get_quiz_session(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> GenerateQuizResponse:
    try:
        result = document_service.get_quiz_session(user, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GenerateQuizResponse(**result)


@router.patch("/quiz-sessions/{session_id}", response_model=GenerateQuizResponse)
def rate_quiz_session(
    session_id: str,
    payload: RateFlashcardRequest,
    user: CurrentUser = Depends(get_current_user),
) -> GenerateQuizResponse:
    try:
        result = document_service.rate_flashcard(
            user=user,
            session_id=session_id,
            card_id=payload.card_id,
            rating=payload.rating,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GenerateQuizResponse(**result)
