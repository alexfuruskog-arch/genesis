export const LIBRARY_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.docx,.pptx,application/pdf,image/*";

export const CAMERA_ACCEPT = "image/*";

const ALLOWED_EXTENSIONS = new Set([
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
]);

export type SourceKind = "scan" | "lecture";

export function extensionOf(name: string) {
  const match = /\.[^.]+$/.exec(name.toLowerCase());
  return match ? match[0] : "";
}

export function isAllowedLibraryFile(file: File) {
  const ext = extensionOf(file.name);
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  return false;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageLibraryFile(filename: string, mimeType?: string | null) {
  const name = filename.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  );
}

export function isStructuredDocumentFile(filename: string, mimeType?: string | null) {
  const name = filename.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".pptx") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    mime === "application/pdf" ||
    mime.includes("wordprocessingml") ||
    mime.includes("presentationml") ||
    mime.startsWith("text/")
  );
}

/** User-facing message when Study chips cannot run on a library file. */
export function studyTextBlockedMessage(filename: string, mimeType?: string | null) {
  if (isImageLibraryFile(filename, mimeType)) {
    return "This photo is in your library, but OCR is not connected yet — Study cannot read text from images. Upload a PDF, Word, or PowerPoint file with selectable text instead.";
  }
  if (isStructuredDocumentFile(filename, mimeType)) {
    return "We could not extract text from this file. It may be empty, image-only slides, or in a layout we could not parse. Try re-exporting from PowerPoint or Word, or upload a PDF with selectable text.";
  }
  return "This file has no extractable text for Study yet. Upload a PDF, Word, PowerPoint, or plain text file.";
}

export function sourceLabel(kind: string | null | undefined, notebookModel?: string | null) {
  if (kind === "lecture") return "Lecture";
  if (notebookModel === "math") return "Scan · Math";
  if (notebookModel === "cornell") return "Scan · Cornell";
  return "Scan";
}
