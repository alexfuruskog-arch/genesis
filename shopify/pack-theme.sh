#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEME="$ROOT/shopify/theme"
OUT="$ROOT/shopify/arzive-theme.zip"

if [[ ! -d "$THEME/layout" ]]; then
  echo "Missing theme at $THEME" >&2
  exit 1
fi

rm -f "$OUT"
(
  cd "$THEME"
  zip -r "$OUT" \
    assets \
    config \
    layout \
    locales \
    sections \
    snippets \
    templates \
    -x "*.DS_Store" -x "**/.git*"
)

echo "Created $OUT"
unzip -l "$OUT" | head -40 || true
