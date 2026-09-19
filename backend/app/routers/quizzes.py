from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, get_current_user
from app.schemas.quizzes import GenerateQuizRequest, GenerateQuizResponse
from app.services.documents import document_service

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
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
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
    """Alias for /generate-quiz — supports quiz (övningstenta) and flashcards."""
    return generate_quiz(payload, user)
