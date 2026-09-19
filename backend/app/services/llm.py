from __future__ import annotations

import json
import re
import httpx

from app.config import get_settings
from app.schemas.quizzes import Flashcard, QuizQuestion

QUIZ_JSON_INSTRUCTIONS = """You are a study coach for ARZIVE. Create practice-exam questions from the source notes.
Reply ONLY with valid JSON shaped like:
{"questions":[{"id":"q1","question":"...","choices":["A","B","C","D"],"correct_index":0,"explanation":"..."}]}
Rules:
- Questions in English unless the notes are clearly in another language.
- Exactly four answer choices.
- correct_index is 0-based.
- Explain briefly why the correct answer fits, grounded in the notes.
- Do not invent facts missing from the source text.
"""

FLASHCARD_JSON_INSTRUCTIONS = """You are a study coach for ARZIVE. Create flashcards from the source notes.
Reply ONLY with valid JSON shaped like:
{"flashcards":[{"id":"c1","front":"...","back":"..."}]}
Rules:
- Front is a short prompt or term; back is the answer or explanation.
- Stay faithful to the notes; do not invent facts.
- Prefer English unless the notes are clearly in another language.
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
            raw = self._openai_chat(
                QUIZ_JSON_INSTRUCTIONS,
                self._quiz_user_prompt(source_text, question_count, topic),
            )
            return _parse_questions(raw, question_count, source_text)
        if provider == "anthropic":
            raw = self._anthropic_chat(
                QUIZ_JSON_INSTRUCTIONS,
                self._quiz_user_prompt(source_text, question_count, topic),
            )
            return _parse_questions(raw, question_count, source_text)
        return _mock_questions(source_text, question_count)

    def generate_flashcards(
        self,
        source_text: str,
        card_count: int,
        topic: str | None = None,
    ) -> list[Flashcard]:
        provider = self.provider_name
        if provider == "openai":
            raw = self._openai_chat(
                FLASHCARD_JSON_INSTRUCTIONS,
                self._flashcard_user_prompt(source_text, card_count, topic),
            )
            return _parse_flashcards(raw, card_count, source_text)
        if provider == "anthropic":
            raw = self._anthropic_chat(
                FLASHCARD_JSON_INSTRUCTIONS,
                self._flashcard_user_prompt(source_text, card_count, topic),
            )
            return _parse_flashcards(raw, card_count, source_text)
        return _mock_flashcards(source_text, card_count)

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

    def _quiz_user_prompt(self, source_text: str, question_count: int, topic: str | None) -> str:
        focus = f"\nFocus on: {topic}" if topic else ""
        clipped = source_text[:12000]
        return f"Create {question_count} practice-exam questions.{focus}\n\nSource notes:\n{clipped}"

    def _flashcard_user_prompt(self, source_text: str, card_count: int, topic: str | None) -> str:
        focus = f"\nFocus on: {topic}" if topic else ""
        clipped = source_text[:12000]
        return f"Create {card_count} flashcards.{focus}\n\nSource notes:\n{clipped}"

    def _openai_chat(self, system: str, user: str) -> str:
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
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def _anthropic_chat(self, system: str, user: str) -> str:
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
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
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


def _parse_flashcards(raw: str, card_count: int, source_text: str) -> list[Flashcard]:
    try:
        payload = json.loads(_extract_json(raw))
        items = payload.get("flashcards") or payload
        cards: list[Flashcard] = []
        for index, item in enumerate(items[:card_count], start=1):
            front = str(item.get("front") or "").strip()
            back = str(item.get("back") or "").strip()
            if not front or not back:
                continue
            cards.append(
                Flashcard(
                    id=str(item.get("id") or f"c{index}"),
                    front=front,
                    back=back,
                )
            )
        if cards:
            return cards
    except Exception:
        pass
    return _mock_flashcards(source_text, card_count)


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
            "Upload notebook scans so ARZIVE can turn them into practice questions.",
        ]
    questions: list[QuizQuestion] = []
    for index in range(question_count):
        snippet = snippets[index % len(snippets)][:140]
        questions.append(
            QuizQuestion(
                id=f"q{index + 1}",
                question=f"Based on your notes, which statement best matches: “{snippet}”?",
                choices=[
                    snippet[:90] or "The claim in the notes",
                    "This is not mentioned in the material",
                    "The opposite of what the notes say",
                    "Only a definition without context",
                ],
                correct_index=0,
                explanation=(
                    "Mock mode: the first choice mirrors the excerpt. "
                    "Set OPENAI_API_KEY or ANTHROPIC_API_KEY for live questions."
                ),
            )
        )
    return questions


def _mock_flashcards(source_text: str, card_count: int) -> list[Flashcard]:
    snippets = [part.strip() for part in re.split(r"[.\n]+", source_text) if len(part.strip()) > 18]
    if not snippets:
        snippets = ["ARZIVE turns scanned notebook pages into study tools."]
    cards: list[Flashcard] = []
    for index in range(card_count):
        snippet = snippets[index % len(snippets)][:160]
        cards.append(
            Flashcard(
                id=f"c{index + 1}",
                front=f"Recall from your notes ({index + 1})",
                back=snippet,
            )
        )
    return cards


llm_client = LLMClient()
