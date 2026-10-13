/**
 * Convex wraps server errors as
 * "[CONVEX A(module:fn)] [Request ID: …] Server Error\nUncaught Error: <message>\n    at …".
 * Show people only the human-readable message.
 */
export function friendlyError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = /Uncaught Error: ([^\n]+?)(?:\s+at |\n|$)/.exec(err.message);
  const message = (match?.[1] ?? err.message).replace(/\s*Called by client$/, "").trim();
  if (!message || message.length > 220 || message.startsWith("[CONVEX")) return fallback;
  return message;
}
