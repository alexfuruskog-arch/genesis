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
        result = document_service.generate_quiz(
            user=user,
            document_id=str(payload.document_id),
            question_count=payload.question_count,
            topic=payload.topic,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return GenerateQuizResponse(**result)
