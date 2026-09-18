from __future__ import annotations

import json
import re
import httpx

from app.config import get_settings
from app.schemas.quizzes import QuizQuestion

QUIZ_JSON_INSTRUCTIONS = """Du är en svensk studiecoach. Skapa quizfrågor utifrån källtexten.
Svara ENDAST med giltig JSON på formen:
{"questions":[{"id":"q1","question":"...","choices":["A","B","C","D"],"correct_index":0,"explanation":"..."}]}
Regler:
- Frågorna ska vara på svenska.
- Exakt fyra svarsalternativ.
- correct_index är 0-baserat.
- Förklara kort varför rätt svar stämmer, med stöd i texten.
- Hitta inte på fakta som saknas i källtexten.
"""


class LLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def provider_name(self) -> str:
        provider = (self.settings.llm_provider or "auto").lower()
        if provider == "mock":
            return "mock"
        if provider == "openai" and self.settings.openai_api_key:
            return "openai"
        if provider == "anthropic" and self.settings.anthropic_api_key:
            return "anthropic"
        if provider == "auto":
            if self.settings.openai_api_key:
                return "openai"
            if self.settings.anthropic_api_key:
                return "anthropic"
        return "mock"

    def generate_quiz(
        self,
        source_text: str,
        question_count: int,
        topic: str | None = None,
    ) -> list[QuizQuestion]:
        provider = self.provider_name
        if provider == "openai":
            raw = self._openai_chat(source_text, question_count, topic)
            return _parse_questions(raw, question_count, source_text)
        if provider == "anthropic":
            raw = self._anthropic_chat(source_text, question_count, topic)
            return _parse_questions(raw, question_count, source_text)
        return _mock_questions(source_text, question_count)

    def embed(self, texts: list[str]) -> list[list[float]] | None:
        if not texts or not self.settings.openai_api_key:
            return None
        try:
            with httpx.Client(timeout=30.0) as http:
                response = http.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "text-embedding-3-small",
                        "input": texts,
                    },
                )
            response.raise_for_status()
            data = response.json()["data"]
            data.sort(key=lambda item: item["index"])
            return [item["embedding"] for item in data]
        except Exception:
            return None

    def _user_prompt(self, source_text: str, question_count: int, topic: str | None) -> str:
        focus = f"\nFokusera på: {topic}" if topic else ""
        clipped = source_text[:12000]
        return (
            f"Skapa {question_count} quizfrågor.{focus}\n\nKälltext:\n{clipped}"
        )

    def _openai_chat(self, source_text: str, question_count: int, topic: str | None) -> str:
        model = self.settings.llm_model or "gpt-4.1-mini"
        with httpx.Client(timeout=45.0) as http:
            response = http.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": QUIZ_JSON_INSTRUCTIONS},
                        {
                            "role": "user",
                            "content": self._user_prompt(source_text, question_count, topic),
                        },
                    ],
                },
            )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def _anthropic_chat(self, source_text: str, question_count: int, topic: str | None) -> str:
        model = self.settings.llm_model or "claude-sonnet-4-5"
        with httpx.Client(timeout=45.0) as http:
            response = http.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.settings.anthropic_api_key or "",
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 2000,
                    "temperature": 0.2,
                    "system": QUIZ_JSON_INSTRUCTIONS,
                    "messages": [
                        {
                            "role": "user",
                            "content": self._user_prompt(source_text, question_count, topic),
                        }
                    ],
                },
            )
        response.raise_for_status()
        blocks = response.json().get("content") or []
        return "".join(block.get("text", "") for block in blocks if block.get("type") == "text")


def _parse_questions(raw: str, question_count: int, source_text: str) -> list[QuizQuestion]:
    try:
        payload = json.loads(_extract_json(raw))
        items = payload.get("questions") or payload
        questions: list[QuizQuestion] = []
        for index, item in enumerate(items[:question_count], start=1):
            choices = [str(choice) for choice in item.get("choices") or []]
            if len(choices) < 2:
                continue
            questions.append(
                QuizQuestion(
                    id=str(item.get("id") or f"q{index}"),
                    question=str(item.get("question") or "").strip(),
                    choices=choices[:4],
                    correct_index=int(item.get("correct_index") or 0),
                    explanation=str(item.get("explanation") or "").strip(),
                )
            )
        if questions:
            return questions
    except Exception:
        pass
    return _mock_questions(source_text, question_count)


def _extract_json(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("{") or raw.startswith("["):
        return raw
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError("No JSON object in model output")
    return match.group(0)


def _mock_questions(source_text: str, question_count: int) -> list[QuizQuestion]:
    snippets = [part.strip() for part in re.split(r"[.\n]+", source_text) if len(part.strip()) > 24]
    if not snippets:
        snippets = [
            "Ladda upp anteckningar så kan Plugga göra frågor av innehållet.",
        ]
    questions: list[QuizQuestion] = []
    for index in range(question_count):
        snippet = snippets[index % len(snippets)][:140]
        questions.append(
            QuizQuestion(
                id=f"q{index + 1}",
                question=f"Vad stämmer bäst utifrån anteckningarna kring: «{snippet}»?",
                choices=[
                    snippet[:90] or "Påståendet i texten",
                    "Detta nämns inte i materialet",
                    "Motsatsen till vad texten säger",
                    "Enbart en definition utan sammanhang",
                ],
                correct_index=0,
                explanation=(
                    "Mock-läge: första alternativet speglar utdraget. "
                    "Sätt OPENAI_API_KEY eller ANTHROPIC_API_KEY för riktiga frågor."
                ),
            )
        )
    return questions


llm_client = LLMClient()
