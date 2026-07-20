#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

PORT=9341
CREATE_LAUNCHERS="true"
LAUNCH_AFTER_INSTALL="true"
IN_PLACE="false"
CHECK_ONLY="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --no-launchers) CREATE_LAUNCHERS="false"; shift ;;
    --no-launch) LAUNCH_AFTER_INSTALL="false"; shift ;;
    --in-place) IN_PLACE="true"; shift ;;
    --check) CHECK_ONLY="true"; shift ;;
    *) fail "Unknown installer argument: $1" ;;
  esac
done
case "$PORT" in ''|*[!0-9]*) fail "Invalid port: $PORT" ;; esac
[ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ] || fail "Port must be between 1024 and 65535."

preflight_install() {
  local payload_theme="$PROJECT_ROOT/presets/preset-codex-1907-deep"
  if [ -e "$INSTALL_ROOT" ] && ! install_root_is_owned "$INSTALL_ROOT"; then
    fail "The install destination is not a verified QQ_agentshow installation: $INSTALL_ROOT. Move it aside manually before installing."
  fi
  discover_codex_app
  require_macos_runtime
  [ -e "$CONFIG_PATH" ] \
    || fail "Codex config was not found: $CONFIG_PATH. Open Codex once, quit it completely, and retry."
  [ -f "$CONFIG_PATH" ] && [ ! -L "$CONFIG_PATH" ] \
    || fail "Codex config must be a regular file, not a symbolic link: $CONFIG_PATH"
  any_official_codex_is_running \
    && fail "Codex is still running. Quit it completely before checking or installing QQ_agentshow."
  if [ -f "$THEME_DIR/theme.json" ]; then payload_theme="$THEME_DIR"; fi
  "$NODE" "$INJECTOR" --check-payload --theme-dir "$payload_theme" >/dev/null \
    || fail "The current QQ_agentshow theme cannot be loaded safely; installation was not changed."
  "$NODE" "$SCRIPT_DIR/theme-config.mjs" validate "$CONFIG_PATH" "$THEME_BACKUP_PATH" >/dev/null \
    || fail "The saved Codex theme backup is invalid; installation was not changed. Restore or remove the invalid backup after inspecting it."
  if [ "$CREATE_LAUNCHERS" = "true" ]; then
    local launcher=""
    if [ -e "$HOME/Desktop" ] || [ -L "$HOME/Desktop" ]; then
      [ -d "$HOME/Desktop" ] && [ ! -L "$HOME/Desktop" ] \
        || fail "Desktop must be a real directory, not a symbolic link: $HOME/Desktop"
    fi
    for launcher in \
      "$HOME/Desktop/Codex Dream Skin.command" \
      "$HOME/Desktop/Codex Dream Skin - Customize.command" \
      "$HOME/Desktop/Codex Dream Skin - Verify.command" \
      "$HOME/Desktop/Codex Dream Skin - Restore.command"
    do
      [ ! -L "$launcher" ] \
        || fail "Desktop launcher must not be a symbolic link: $launcher"
      if [ -e "$launcher" ] && ! /usr/bin/grep -q '^# CodexDreamSkinStudio launcher$' "$launcher" 2>/dev/null; then
        fail "Desktop launcher already belongs to another file: $launcher. Move it aside, or rerun with --no-launchers."
      fi
    done
  fi
}

if [ "$CHECK_ONLY" = "true" ]; then
  # A readiness check is intentionally read-only, including its failure path.
  START_ERROR_LOG=""
  preflight_install
  printf 'QQ_agentshow check passed: the official app, signed runtime, Codex config, current theme, and quit state are ready.\n'
  exit 0
fi

acquire_install_lock
trap release_install_lock EXIT INT TERM

# Validate every precondition before replacing an existing engine directory.
# The in-place invocation repeats this after the atomic deployment so a failed
# update leaves both the installed engine and the user's active theme intact.
preflight_install

deploy_project() {
  local temporary="$INSTALL_ROOT.installing.$$"
  local previous="$INSTALL_ROOT.previous.$$"
  local previous_owned="false"
  [ ! -e "$temporary" ] || fail "Stale install staging path exists: $temporary"
  [ ! -e "$previous" ] || fail "Stale install rollback path exists: $previous"
  "$SCRIPT_DIR/stage-product-files.sh" "$PROJECT_ROOT" "$temporary"
  /bin/chmod 700 "$temporary"/*.command "$temporary"/scripts/*.sh 2>/dev/null || true
  if [ -e "$INSTALL_ROOT" ]; then
    install_root_is_owned "$INSTALL_ROOT" \
      || fail "Refusing to replace an unowned install destination: $INSTALL_ROOT"
    /bin/mv "$INSTALL_ROOT" "$previous"
    previous_owned="true"
  fi
  [ ! -e "$INSTALL_ROOT" ] || fail "Install destination was recreated during deployment: $INSTALL_ROOT"
  if ! /bin/mv "$temporary" "$INSTALL_ROOT"; then
    [ -e "$previous" ] && /bin/mv "$previous" "$INSTALL_ROOT"
    fail "Could not install the project at $INSTALL_ROOT"
  fi
  if ! install_marker_is_valid "$INSTALL_ROOT"; then
    /bin/rm -rf "$INSTALL_ROOT"
    [ "$previous_owned" = "false" ] || /bin/mv "$previous" "$INSTALL_ROOT"
    fail "The staged installation is missing its ownership marker; the previous engine was restored."
  fi
  if [ "$previous_owned" = "true" ]; then
    install_root_is_owned "$previous" \
      || fail "Rollback directory lost its ownership proof; it was preserved at $previous"
    /bin/rm -rf "$previous"
  fi
}

if [ "$IN_PLACE" = "false" ] && [ "$PROJECT_ROOT" != "$INSTALL_ROOT" ]; then
  /bin/mkdir -p "$(dirname "$INSTALL_ROOT")"
  deploy_project
  install_args=(--in-place --port "$PORT")
  [ "$CREATE_LAUNCHERS" = "true" ] || install_args+=(--no-launchers)
  [ "$LAUNCH_AFTER_INSTALL" = "true" ] || install_args+=(--no-launch)
  exec "$INSTALL_ROOT/scripts/install-dream-skin-macos.sh" "${install_args[@]}"
fi

ensure_state_root
seed_bundled_presets
migrate_removed_presets
if [ ! -f "$THEME_DIR/theme.json" ]; then
  "$SCRIPT_DIR/switch-theme-macos.sh" --id preset-codex-1907-deep --no-apply >/dev/null
fi
[ -f "$CONFIG_PATH" ] || fail "Codex config not found: $CONFIG_PATH. Launch Codex once, close it, and rerun the installer."
"$NODE" "$INJECTOR" --check-payload --theme-dir "$THEME_DIR" >/dev/null
"$NODE" "$SCRIPT_DIR/theme-config.mjs" install "$CONFIG_PATH" "$THEME_BACKUP_PATH"

shell_quote() {
  shell_single_quote "$1"
}

if [ "$CREATE_LAUNCHERS" = "true" ]; then
  if [ ! -e "$HOME/Desktop" ]; then /bin/mkdir "$HOME/Desktop"; fi
  start_script="$(shell_quote "$SCRIPT_DIR/start-dream-skin-macos.sh")"
  customize_script="$(shell_quote "$SCRIPT_DIR/customize-theme-macos.sh")"
  verify_script="$(shell_quote "$SCRIPT_DIR/verify-dream-skin-macos.sh")"
  restore_script="$(shell_quote "$SCRIPT_DIR/restore-dream-skin-macos.sh")"
  screenshot="$(shell_quote "$HOME/Desktop/Codex Dream Skin Verification.png")"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin.command" "exec $start_script --port $PORT --prompt-restart"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin - Customize.command" "exec $customize_script"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin - Verify.command" "$verify_script --screenshot $screenshot && /usr/bin/open $screenshot"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin - Restore.command" "exec $restore_script --restore-base-theme --restart-codex"
fi

printf 'Codex Dream Skin Studio %s installed at %s for Codex %s using its signed Node.js %s.\n' \
  "$SKIN_VERSION" "$PROJECT_ROOT" "$CODEX_VERSION" "$NODE_VERSION"
printf 'Use the Desktop launchers to customize, start, verify, or restore the official appearance.\n'
printf 'Bundled presets are ready in your theme library — pick one from the menu bar (已保存的主题) or switch-theme.\n'

if [ "$LAUNCH_AFTER_INSTALL" = "true" ]; then
  "$SCRIPT_DIR/start-dream-skin-macos.sh" --port "$PORT" --prompt-restart
fi
