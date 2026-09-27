"use node";

export type ExtractionResult = {
  text: string;
  status: "ready" | "stubbed" | "empty";
  chunkCount: number;
};

async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(/slide(\d+)/i.exec(a)?.[1] ?? 0);
      const nb = Number(/slide(\d+)/i.exec(b)?.[1] ?? 0);
      return na - nb;
    });
  const parts: string[] = [];
  for (const path of slidePaths) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const slideTexts: string[] = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let match = re.exec(xml);
    while (match) {
      const piece = match[1].replace(/\s+/g, " ").trim();
      if (piece) slideTexts.push(piece);
      match = re.exec(xml);
    }
    if (slideTexts.length) {
      parts.push(slideTexts.join(" "));
    }
  }
  return parts.join("\n\n").trim();
}

function chunkText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith("[ARZIVE stored")) return 0;
  const parts = trimmed.split(/\n\n+/).filter((p) => p.trim().length > 12);
  return Math.max(1, parts.length);
}

export async function extractTextFromBytes(
  filename: string,
  mimeType: string | undefined,
  bytes: ArrayBuffer,
): Promise<ExtractionResult> {
  const name = filename.toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv") || mime.startsWith("text/")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const status = text.trim() ? "ready" : "empty";
    return { text, status, chunkCount: chunkText(text) };
  }

  if (name.endsWith(".pdf") || mime === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: Buffer.from(bytes) });
      const textResult = await parser.getText();
      await parser.destroy();
      const text = (textResult.text || "").trim();
      if (text) {
        return { text, status: "ready", chunkCount: chunkText(text) };
      }
      const stub = `[PDF ${filename} has no extractable text. OCR can be added later. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    } catch {
      const stub = `[PDF extraction failed for ${filename}. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    }
  }

  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(bytes);
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      if (text) {
        return { text, status: "ready", chunkCount: chunkText(text) };
      }
      const stub = `[Word file ${filename} has no extractable text. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    } catch {
      const stub = `[Word extraction failed for ${filename}. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    }
  }

  if (name.endsWith(".pptx") || mime.includes("presentationml")) {
    try {
      const buffer = Buffer.from(bytes);
      const text = await extractPptxText(buffer);
      if (text) {
        return { text, status: "ready", chunkCount: chunkText(text) };
      }
      const stub = `[PowerPoint file ${filename} has no extractable text on its slides. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    } catch {
      const stub = `[PowerPoint extraction failed for ${filename}. The file is stored in your library.]`;
      return { text: stub, status: "stubbed", chunkCount: 0 };
    }
  }

  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    mime.startsWith("image/")
  ) {
    const stub = `[ARZIVE stored ${filename} in your library. Image OCR is not connected yet, so this photo has no searchable text.]`;
    return { text: stub, status: "stubbed", chunkCount: 0 };
  }

  const stub = `[ARZIVE stored ${filename} (${mime || "unknown type"}) without a text parser. The file is in your library; extraction can be added later.]`;
  return { text: stub, status: "stubbed", chunkCount: 0 };
}
