from __future__ import annotations

from io import BytesIO


def extract_text(filename: str, mime_type: str | None, data: bytes) -> tuple[str, str]:
    """Return (text, mode) where mode is extracted or stubbed."""
    name = filename.lower()
    mime = (mime_type or "").lower()
    if name.endswith((".txt", ".md", ".csv")) or mime.startswith("text/"):
        return data.decode("utf-8", errors="replace"), "extracted"
    if name.endswith(".pdf") or mime == "application/pdf":
        return _extract_pdf(filename, data)
    stub = (
        f"[Extraktion är inte kopplad för {filename} ({mime or 'okänd typ'}). "
        "Den här stubben låter upload → chunk → quiz-flödet köras lokalt. "
        "Byt ut mot en riktig parser/OCR när filtypen behövs.]"
    )
    return stub, "stubbed"


def _extract_pdf(filename: str, data: bytes) -> tuple[str, str]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n\n".join(part for part in pages if part)
        if text.strip():
            return text, "extracted"
        return (
            f"[PDF:en {filename} saknar extraherbar text. OCR kan läggas till senare.]",
            "stubbed",
        )
    except Exception as exc:  # pragma: no cover - defensive parser path
        return f"[PDF-extraktion misslyckades för {filename}: {exc}]", "stubbed"


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs or [normalized]:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(paragraph) <= max_chars:
            current = paragraph
            continue
        for start in range(0, len(paragraph), max_chars):
            piece = paragraph[start : start + max_chars].strip()
            if piece:
                chunks.append(piece)
        current = ""
    if current:
        chunks.append(current)
    return chunks or [normalized[:max_chars]]
