#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="$ROOT/docs/visuals/readme-showcase.html"
OUTPUT="$ROOT/docs/images"
PLAYWRIGHT_BIN="${PLAYWRIGHT_BIN:-$(command -v playwright || true)}"
FFMPEG_BIN="${FFMPEG_BIN:-$(command -v ffmpeg || true)}"

if [ -z "$PLAYWRIGHT_BIN" ]; then
  printf 'playwright CLI is required to render README visuals.\n' >&2
  exit 1
fi
if [ -z "$FFMPEG_BIN" ]; then
  printf 'ffmpeg is required to encode the README cover.\n' >&2
  exit 1
fi

mkdir -p "$OUTPUT"

render() {
  local view="$1"
  local target="$2"
  "$PLAYWRIGHT_BIN" screenshot \
    --browser chromium \
    --channel chrome \
    --viewport-size "1600,900" \
    --wait-for-selector "#ready" \
    "file://$SOURCE?view=$view" \
    "$OUTPUT/$target"
}

render cover .qq-agentshow-cover-source.png
"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$OUTPUT/.qq-agentshow-cover-source.png" \
  -threads 1 -q:v 2 -pix_fmt yuvj444p \
  "$OUTPUT/qq-agentshow-cover.jpg"
find "$OUTPUT/.qq-agentshow-cover-source.png" -type f -delete
render preview qq-agentshow-preview.png
render features qq-agentshow-features.png

printf 'Rendered README visuals in %s\n' "$OUTPUT"
