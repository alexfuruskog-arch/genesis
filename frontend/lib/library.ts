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

export function sourceLabel(kind: string | null | undefined, notebookModel?: string | null) {
  if (kind === "lecture") return "Lecture";
  if (notebookModel === "math") return "Scan · Math";
  if (notebookModel === "cornell") return "Scan · Cornell";
  return "Scan";
}
