#!/bin/bash

set -euo pipefail

[ "$#" -eq 2 ] || { printf 'Usage: %s <product-root> <destination>\n' "$0" >&2; exit 2; }
SOURCE_ROOT="$(cd "$1" && pwd -P)"
DESTINATION="$2"
[ ! -e "$DESTINATION" ] || { printf 'Stage destination already exists: %s\n' "$DESTINATION" >&2; exit 1; }
/bin/mkdir -p "$DESTINATION"

copy_regular_file() {
  local source="$1"
  local relative="$2"
  [ -f "$source" ] && [ ! -L "$source" ] \
    || { printf 'Refusing to stage a missing, non-regular, or symbolic-link file: %s\n' "$source" >&2; exit 1; }
  /bin/mkdir -p "$DESTINATION/$(/usr/bin/dirname "$relative")"
  /bin/cp -p "$source" "$DESTINATION/$relative"
}

REPOSITORY_ROOT=""
if [ -e "$SOURCE_ROOT/../.git" ]; then
  REPOSITORY_ROOT="$(/usr/bin/git -C "$SOURCE_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -n "$REPOSITORY_ROOT" ] && [ "$SOURCE_ROOT" = "$REPOSITORY_ROOT/macos" ]; then
  # A source checkout is staged exclusively from Git's tracked manifest. This
  # makes ignored logs, scratch files, local runtime state, and untracked
  # screenshots impossible to smuggle into an install or release archive.
  while IFS= read -r -d '' tracked; do
    relative="${tracked#macos/}"
    [ "$relative" != "$tracked" ] || continue
    copy_regular_file "$REPOSITORY_ROOT/$tracked" "$relative"
  done < <(/usr/bin/git -C "$REPOSITORY_ROOT" ls-files -z -- macos)
else
  # A downloaded standalone release has no .git directory. Copy only the
  # audited product surface; never recursively mirror arbitrary root entries.
  for relative in \
    .gitignore .qq-agentshow-install CHANGELOG.md CLIENT_DEPLOY_PROMPT.md LICENSE NOTICE.md README.md \
    SKILL.md VERSION package.json \
    "Customize Codex Dream Skin.command" "Install Codex Dream Skin.command" \
    "Install Menu Bar.command" "Restore Codex Dream Skin.command" \
    "Start Codex Dream Skin.command" "Verify Codex Dream Skin.command"
  do
    [ ! -e "$SOURCE_ROOT/$relative" ] || copy_regular_file "$SOURCE_ROOT/$relative" "$relative"
  done
  for directory in agents assets docs menubar presets references scripts tests; do
    [ ! -d "$SOURCE_ROOT/$directory" ] || {
      [ ! -L "$SOURCE_ROOT/$directory" ] \
        || { printf 'Refusing to stage a symbolic-link directory: %s\n' "$SOURCE_ROOT/$directory" >&2; exit 1; }
      while IFS= read -r -d '' source; do
        relative="${source#"$SOURCE_ROOT/"}"
        copy_regular_file "$source" "$relative"
      done < <(/usr/bin/find -P "$SOURCE_ROOT/$directory" -type f -print0)
    }
  done
fi

[ -f "$DESTINATION/scripts/install-dream-skin-macos.sh" ] \
  || { printf 'Staged product is missing the installer.\n' >&2; exit 1; }
[ -f "$DESTINATION/SKILL.md" ] \
  || { printf 'Staged product is missing SKILL.md.\n' >&2; exit 1; }
