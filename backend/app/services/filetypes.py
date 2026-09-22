from __future__ import annotations

from pathlib import Path

# Lecture files + notebook photos. Old .doc/.ppt are skipped — .docx/.pptx extract cheaply.
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".txt",
    ".md",
    ".docx",
    ".pptx",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
IMAGE_MIME_PREFIX = "image/"

SOURCE_SCAN = "scan"
SOURCE_LECTURE = "lecture"
SOURCE_KINDS = {SOURCE_SCAN, SOURCE_LECTURE}

ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.docx,.pptx,application/pdf,image/*"


class UnsupportedUploadError(ValueError):
    """Raised when the upload is not a supported lecture/scan type."""


def normalize_source_kind(value: str | None, notebook_model: str | None) -> str:
    raw = (value or "").strip().lower()
    if raw in SOURCE_KINDS:
        return raw
    if (notebook_model or "").strip():
        return SOURCE_SCAN
    return SOURCE_LECTURE


def extension_of(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def is_image(filename: str, mime_type: str | None) -> bool:
    mime = (mime_type or "").lower()
    return extension_of(filename) in IMAGE_EXTENSIONS or mime.startswith(IMAGE_MIME_PREFIX)


def kind_label(filename: str, mime_type: str | None) -> str:
    ext = extension_of(filename).lstrip(".")
    mime = (mime_type or "").lower()
    if ext == "pdf" or mime == "application/pdf":
        return "PDF"
    if ext == "docx" or mime.endswith("wordprocessingml.document"):
        return "Word"
    if ext == "pptx" or mime.endswith("presentationml.presentation"):
        return "PowerPoint"
    if is_image(filename, mime_type):
        return "Image"
    if ext in {"txt", "md"} or mime.startswith("text/"):
        return "Text"
    return ext.upper() or "File"


def assert_supported_upload(filename: str, mime_type: str | None) -> None:
    ext = extension_of(filename)
    mime = (mime_type or "").strip().lower()
    if ext in ALLOWED_EXTENSIONS:
        return
    if mime in ALLOWED_MIME_TYPES:
        return
    if mime.startswith("image/") and ext in IMAGE_EXTENSIONS | {""}:
        return
    raise UnsupportedUploadError(
        "Unsupported file. Upload a PDF, image, Word (.docx), PowerPoint (.pptx), or text file."
    )
