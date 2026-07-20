#!/bin/bash

# Install the SwiftBar plugin and optionally install SwiftBar itself.

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

INSTALL_SWIFTBAR="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-brew) INSTALL_SWIFTBAR="false"; shift ;;
    --install-swiftbar) INSTALL_SWIFTBAR="true"; shift ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

PLUGIN_SRC="$PROJECT_ROOT/menubar/codex_dream_skin.10s.sh"
[ -f "$PLUGIN_SRC" ] && [ ! -L "$PLUGIN_SRC" ] || fail "Plugin source missing or unsafe: $PLUGIN_SRC"

# Prefer installed engine when this tree is the repo and engine already exists.
ENGINE_ROOT="$PROJECT_ROOT"
if [ -e "$INSTALL_ROOT" ] || [ -L "$INSTALL_ROOT" ]; then
  install_root_is_owned "$INSTALL_ROOT" \
    || fail "Refusing unowned installed engine path: $INSTALL_ROOT"
  ENGINE_ROOT="$INSTALL_ROOT"
fi

PLUGIN_DIR="$STATE_ROOT/menubar"
ensure_state_root
ensure_managed_directory "$PLUGIN_DIR"

PLUGIN_DST="$PLUGIN_DIR/codex_dream_skin.10s.sh"
PLUGIN_TEMP="$(/usr/bin/mktemp "$PLUGIN_DIR/.codex_dream_skin.XXXXXX")"
cleanup_plugin_temp() { /bin/rm -f "$PLUGIN_TEMP"; }
trap cleanup_plugin_temp EXIT
[ ! -L "$PLUGIN_DST" ] || fail "Refusing symbolic-link menu plugin: $PLUGIN_DST"
if [ -e "$PLUGIN_DST" ]; then
  [ -f "$PLUGIN_DST" ] || fail "Menu plugin target is not a regular file: $PLUGIN_DST"
fi
{
  printf '%s\n' '#!/bin/bash'
  printf 'export CODEX_DREAM_SKIN_ENGINE=%q\n' "$ENGINE_ROOT"
  # Skip the original shebang line from the template.
  /usr/bin/tail -n +2 "$PLUGIN_SRC"
} > "$PLUGIN_TEMP"
/bin/chmod 755 "$PLUGIN_TEMP"
/bin/mv -f "$PLUGIN_TEMP" "$PLUGIN_DST"
trap - EXIT
[ -f "$PLUGIN_DST" ] && [ ! -L "$PLUGIN_DST" ] \
  || fail "Could not install a safe menu plugin: $PLUGIN_DST"

/bin/chmod 755 \
  "$PROJECT_ROOT/scripts/pause-dream-skin-macos.sh" \
  "$PROJECT_ROOT/scripts/status-dream-skin-macos.sh" \
  "$PROJECT_ROOT/scripts/apply-from-menubar-macos.sh" \
  "$PROJECT_ROOT/scripts/switch-theme-macos.sh" \
  "$PROJECT_ROOT/scripts/load-image-theme-macos.sh" \
  "$PROJECT_ROOT/scripts/personalize-codex-2007-macos.sh" \
  "$PROJECT_ROOT/scripts/set-codex-1907-status-macos.sh" \
  "$PROJECT_ROOT/scripts/replace-codex-1907-qq-show-macos.sh" \
  "$PROJECT_ROOT/scripts/install-menubar-macos.sh" \
  "$PROJECT_ROOT/Install Menu Bar.command" 2>/dev/null || true

SWIFTBAR_APP=""
for candidate in "/Applications/SwiftBar.app" "$HOME/Applications/SwiftBar.app"; do
  if [ -d "$candidate" ]; then SWIFTBAR_APP="$candidate"; break; fi
done

if [ -z "$SWIFTBAR_APP" ] && [ "$INSTALL_SWIFTBAR" = "true" ]; then
  if command -v brew >/dev/null 2>&1; then
    printf 'Installing SwiftBar via Homebrew…\n'
    brew install --cask swiftbar || fail "brew install --cask swiftbar failed. Install SwiftBar manually, then rerun with --no-brew."
  else
    fail "SwiftBar is not installed and Homebrew was not found. Install SwiftBar from https://github.com/swiftbar/SwiftBar/releases then rerun with --no-brew."
  fi
  for candidate in "/Applications/SwiftBar.app" "$HOME/Applications/SwiftBar.app"; do
    if [ -d "$candidate" ]; then SWIFTBAR_APP="$candidate"; break; fi
  done
fi

[ -n "$SWIFTBAR_APP" ] || fail "SwiftBar.app not found. Install it from https://github.com/swiftbar/SwiftBar/releases, or explicitly rerun with --install-swiftbar to use Homebrew."

/usr/bin/defaults write com.ameba.SwiftBar PluginDirectory -string "$PLUGIN_DIR" 2>/dev/null || true

/usr/bin/open -a "$SWIFTBAR_APP" || true
/bin/sleep 1
/usr/bin/open "swiftbar://refreshall" 2>/dev/null || true

printf '\n'
printf 'Menu bar plugin installed.\n'
printf '  Plugin folder: %s\n' "$PLUGIN_DIR"
printf '  Engine:        %s\n' "$ENGINE_ROOT"
printf '  SwiftBar:      %s\n' "$SWIFTBAR_APP"
printf '\n'
printf 'Look at the top-right menu bar for 🎨 Skin.\n'
printf 'If missing: SwiftBar → Preferences → Plugin Folder → %s\n' "$PLUGIN_DIR"
