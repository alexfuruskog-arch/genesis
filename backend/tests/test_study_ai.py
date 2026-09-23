from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.membership import FREE_CHAT_CAP


client = TestClient(app)


def _auth(email: str = "study-ai@arzive.org") -> dict[str, str]:
    signup = client.post(
        "/auth/signup",
        json={"email": email, "password": "secret12"},
    )
    assert signup.status_code == 200, signup.text
    return {"Authorization": f"Bearer {signup.json()['token']}"}


def _upload(headers: dict[str, str], name: str = "mitosis.txt", body: bytes | None = None) -> str:
    payload = body or (
        b"Mitosis is cell division that produces two identical daughter cells. "
        b"Prophase, metaphase, anaphase, and telophase are the main stages. "
        b"DNA is replicated before mitosis begins during interphase."
    )
    upload = client.post(
        "/upload-document",
        headers=headers,
        files={"file": (name, payload, "text/plain")},
        data={"source_kind": "lecture"},
    )
    assert upload.status_code == 200, upload.text
    return upload.json()["id"]


def test_ask_is_grounded_on_one_file():
    headers = _auth()
    document_id = _upload(headers)
    response = client.post(
        "/ask",
        headers=headers,
        json={
            "document_id": document_id,
            "message": "What happens during mitosis?",
            "prompt_kind": "free_text",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "mock"
    assert body["retrieval"]["chunk_count"] >= 1
    assert "mitosis" in body["message"]["content"].lower()
    assert body["user_message"]["prompt_kind"] == "free_text"

    listed = client.get(f"/study-messages?document_id={document_id}", headers=headers)
    assert listed.status_code == 200
    messages = listed.json()["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_explain_and_summarize_chips():
    headers = _auth("chips@arzive.org")
    document_id = _upload(headers)
    explain = client.post(
        "/ask",
        headers=headers,
        json={
            "document_id": document_id,
            "message": "Explain this",
            "prompt_kind": "chip",
            "chip_id": "explain",
        },
    )
    assert explain.status_code == 200, explain.text
    assert explain.json()["user_message"]["chip_id"] == "explain"

    summarize = client.post(
        "/ask",
        headers=headers,
        json={
            "document_id": document_id,
            "message": "Summarize",
            "prompt_kind": "chip",
            "chip_id": "summarize",
        },
    )
    assert summarize.status_code == 200, summarize.text
    assert "file" in summarize.json()["message"]["content"].lower() or summarize.json()["provider"] == "mock"


def test_generate_study_questions_is_not_an_exam():
    headers = _auth("quiz@arzive.org")
    document_id = _upload(headers)
    response = client.post(
        "/generate-study",
        headers=headers,
        json={"document_id": document_id, "output_type": "questions", "question_count": 3},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["output_type"] == "questions"
    assert len(body["questions"]) == 3
    assert body["flashcards"] == []
    session = client.get(f"/quiz-sessions/{body['quiz_session_id']}", headers=headers)
    assert session.status_code == 200
    assert session.json()["output_type"] == "questions"


def test_flashcards_can_be_rated_and_resumed():
    headers = _auth("cards@arzive.org")
    document_id = _upload(headers)
    created = client.post(
        "/generate-study",
        headers=headers,
        json={"document_id": document_id, "output_type": "flashcards", "question_count": 4},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["output_type"] == "flashcards"
    assert len(body["flashcards"]) == 4
    card_id = body["flashcards"][0]["id"]
    rated = client.patch(
        f"/quiz-sessions/{body['quiz_session_id']}",
        headers=headers,
        json={"card_id": card_id, "rating": "still_learning"},
    )
    assert rated.status_code == 200, rated.text
    history = rated.json()["history"]
    assert history[-1]["card_id"] == card_id
    assert history[-1]["rating"] == "still_learning"


def test_image_without_text_returns_400():
    headers = _auth("photo@arzive.org")
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc```\x00\x00"
        b"\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    upload = client.post(
        "/upload-document",
        headers=headers,
        files={"file": ("board.png", png, "image/png")},
        data={"source_kind": "lecture"},
    )
    assert upload.status_code == 200, upload.text
    document_id = upload.json()["id"]
    ask = client.post(
        "/ask",
        headers=headers,
        json={"document_id": document_id, "message": "Explain this", "prompt_kind": "chip", "chip_id": "explain"},
    )
    assert ask.status_code == 400
    assert "extractable text" in ask.json()["detail"].lower() or "ocr" in ask.json()["detail"].lower()


def test_coming_soon_chips_are_not_generated():
    headers = _auth("later@arzive.org")
    document_id = _upload(headers)
    exam = client.post(
        "/ask",
        headers=headers,
        json={"document_id": document_id, "message": "Practice exam", "prompt_kind": "chip", "chip_id": "exam"},
    )
    assert exam.status_code == 400
    assert "not generated yet" in exam.json()["detail"].lower() or "practice exam" in exam.json()["detail"].lower()


def test_ask_counts_against_free_chat_cap():
    headers = _auth("cap@arzive.org")
    document_id = _upload(headers, "notes.txt")
    for index in range(FREE_CHAT_CAP):
        response = client.post(
            "/ask",
            headers=headers,
            json={"document_id": document_id, "message": f"Question {index}", "prompt_kind": "free_text"},
        )
        assert response.status_code == 200, response.text
    blocked = client.post(
        "/ask",
        headers=headers,
        json={"document_id": document_id, "message": "One more", "prompt_kind": "free_text"},
    )
    assert blocked.status_code == 403
    assert "3 chats" in blocked.json()["detail"]
    membership = client.get("/membership/me", headers=headers)
    assert membership.json()["chats_used"] == FREE_CHAT_CAP
    assert membership.json()["chats_remaining"] == 0
