"use client";

import { useState } from "react";

import { uploadDocument, type UploadedDocument } from "@/lib/api";

type Props = {
  disabled?: boolean;
  onUploaded: (document: UploadedDocument) => void;
};

export function DocumentUpload({ disabled, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Välj en fil först.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const document = await uploadDocument(file);
      onUploaded(document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uppladdningen misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-ink/80">Anteckningar</span>
        <input
          type="file"
          accept=".txt,.md,.csv,.pdf,text/plain,application/pdf"
          disabled={disabled || busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
          className="mt-2 block w-full cursor-pointer rounded-xl border border-ink/10 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-copper file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>
      {file ? (
        <p className="text-sm text-ink/70">
          {file.name} · {(file.size / 1024).toFixed(1)} kB
        </p>
      ) : (
        <p className="text-sm text-ink/55">
          Tomt just nu. TXT, Markdown och PDF fungerar. Andra filtyper får en
          extraktions-stub så att quiz-flödet ändå kan provas.
        </p>
      )}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || busy}
        className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Laddar upp…" : "Ladda upp dokument"}
      </button>
    </form>
  );
}
