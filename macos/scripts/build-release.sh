#!/bin/bash

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
NODE_BIN="${NODE:-$(command -v node 2>/dev/null || true)}"
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] \
  || { printf 'Node.js is required to build a release.\n' >&2; exit 1; }
VERSION="$(/usr/bin/tr -d '[:space:]' < "$ROOT/VERSION")"
RELEASE_DIR="$ROOT/release"
ARCHIVE="$RELEASE_DIR/QQ_agentshow-macos-v$VERSION.zip"
TMP="$(/usr/bin/mktemp -d /tmp/qq-agentshow-release.XXXXXX)"
trap '/bin/rm -rf "$TMP"' EXIT

if [ "${1:-}" != "--skip-tests" ]; then "$ROOT/tests/run-tests.sh"; fi

/bin/mkdir -p "$RELEASE_DIR"
"$ROOT/scripts/stage-product-files.sh" "$ROOT" "$TMP/QQ_agentshow-macos"

# The macOS tree is also published as a standalone ZIP. Bundle prompt guides
# and their referenced images, then translate repository paths for this root.
"$ROOT/scripts/prepare-standalone-docs.sh" "$TMP/QQ_agentshow-macos"
rewrite_standalone_links() {
  local file="$1"
  local temporary="${file}.standalone"
  /usr/bin/sed \
    -e 's#\.\./docs/#docs/#g' \
    -e 's#\.\./windows/#https://github.com/Fei-Away/Codex-Dream-Skin/tree/main/windows/#g' \
    "$file" > "$temporary"
  /bin/mv "$temporary" "$file"
}
rewrite_standalone_links "$TMP/QQ_agentshow-macos/README.md"
PRESET_README="$TMP/QQ_agentshow-macos/presets/README.md"
if [ -f "$PRESET_README" ]; then
  temporary="${PRESET_README}.standalone"
  /usr/bin/sed -e 's#\.\./\.\./docs/#../docs/#g' "$PRESET_README" > "$temporary"
  /bin/mv "$temporary" "$PRESET_README"
fi
/usr/bin/find "$TMP/QQ_agentshow-macos" -type f \( -name '.DS_Store' -o -name '._*' \) -delete
"$NODE_BIN" "$ROOT/scripts/check-public-privacy.mjs" --root "$TMP/QQ_agentshow-macos" >/dev/null
"$NODE_BIN" "$TMP/QQ_agentshow-macos/scripts/check-asset-provenance.mjs" >/dev/null
/bin/chmod 755 "$TMP/QQ_agentshow-macos"/*.command
/bin/chmod 755 "$TMP/QQ_agentshow-macos"/scripts/*.sh "$TMP/QQ_agentshow-macos"/tests/*.sh
/usr/bin/find "$TMP/QQ_agentshow-macos" -type d -exec /bin/chmod 755 {} +
# Freeze entry mtimes so rebuilding the same staged tree produces the same ZIP
# digest instead of changing only because the build ran at a different time.
/usr/bin/find "$TMP/QQ_agentshow-macos" -exec /usr/bin/touch -t 200001010000 {} +
/bin/rm -f "$ARCHIVE"
# `ditto` writes uid/gid extra fields, so the same commit built from a `staff`
# checkout and a `wheel` temporary directory gets different bytes. `zip -X`
# omits those host-specific fields; a sorted manifest fixes entry order too.
(
  cd "$TMP"
  /usr/bin/find QQ_agentshow-macos -print \
    | LC_ALL=C /usr/bin/sort \
    | /usr/bin/zip -X -q "$ARCHIVE" -@
)
SHA256="$(/usr/bin/shasum -a 256 "$ARCHIVE" | /usr/bin/awk '{print $1}')"
/usr/bin/printf '%s  %s\n' "$SHA256" "$(basename "$ARCHIVE")" > "$RELEASE_DIR/SHA256SUMS.txt"
/usr/bin/printf 'Created %s\nSHA-256 %s\n' "$ARCHIVE" "$SHA256"
