#!/bin/bash

set -euo pipefail

if [ -z "${HOME:-}" ]; then
  CURRENT_USER="$(/usr/bin/id -un)"
  HOME="$(/usr/bin/dscl . -read "/Users/$CURRENT_USER" NFSHomeDirectory 2>/dev/null | /usr/bin/awk '{print $2}')"
  [ -n "$HOME" ] || { printf 'Codex Dream Skin Studio: could not resolve the current macOS home directory.\n' >&2; exit 1; }
  export HOME
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
INJECTOR="$SCRIPT_DIR/injector.mjs"
INSTALL_ROOT="$HOME/.codex/codex-dream-skin-studio"
STATE_ROOT="$HOME/Library/Application Support/CodexDreamSkinStudio"
STATE_PATH="$STATE_ROOT/state.json"
THEME_BACKUP_PATH="$STATE_ROOT/theme-backup.json"
THEME_DIR="$STATE_ROOT/theme"
CONFIG_PATH="$HOME/.codex/config.toml"
INJECTOR_LOG="$STATE_ROOT/injector.log"
INJECTOR_ERROR_LOG="$STATE_ROOT/injector-error.log"
APP_LOG="$STATE_ROOT/codex-launch.log"
APP_ERROR_LOG="$STATE_ROOT/codex-launch-error.log"
START_ERROR_LOG="$STATE_ROOT/start-error.log"
CODEX_APP_JOB_LABEL="com.openai.codex-dream-skin-studio.app"
INJECTOR_JOB_LABEL="com.openai.codex-dream-skin-studio.injector"
# OpenAI's production signing identity is a product invariant, not a
# user-configurable setting.  Allowing an environment override would let an
# untrusted local app redefine what this project calls "official Codex".
EXPECTED_CODEX_TEAM_ID="2DC432GLL2"
SKIN_VERSION="2.1.1"

fail() {
  local message="$*"
  if [ -n "${START_ERROR_LOG:-}" ] && [ -n "${STATE_ROOT:-}" ] \
    && [ -d "$STATE_ROOT" ] && [ ! -L "$STATE_ROOT" ] \
    && [ -f "$START_ERROR_LOG" ] && [ ! -L "$START_ERROR_LOG" ]; then
    printf '%s %s\n' "$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')" "$message" >> "$START_ERROR_LOG" 2>/dev/null || true
  fi
  printf 'Codex Dream Skin Studio: %s\n' "$message" >&2
  exit 1
}

notify_user() {
  local message="$*"
  /usr/bin/osascript - "$message" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display notification (item 1 of argv) with title "Codex Dream Skin"
end run
APPLESCRIPT
}

shell_single_quote() {
  # Emit one literal POSIX-shell word.  The replacement sequence closes the
  # quote, emits one escaped apostrophe, then reopens the quote.
  printf "'"
  printf '%s' "$1" | /usr/bin/sed "s/'/'\\\\''/g"
  printf "'"
}

write_managed_launcher() {
  local target="$1"
  local command="$2"
  local parent temporary
  parent="$(/usr/bin/dirname "$target")"
  [ -d "$parent" ] && [ ! -L "$parent" ] \
    || fail "Launcher parent must be a real directory: $parent"
  [ ! -L "$target" ] || fail "Refusing symbolic-link Desktop launcher: $target"
  if [ -e "$target" ] && ! /usr/bin/grep -q '^# CodexDreamSkinStudio launcher$' "$target" 2>/dev/null; then
    fail "Refusing to overwrite an unrelated Desktop file: $target"
  fi
  temporary="$(/usr/bin/mktemp "$parent/.qq-agentshow-launcher.XXXXXX")"
  /usr/bin/printf '%s\n' \
    '#!/bin/bash' \
    '# CodexDreamSkinStudio launcher' \
    'set -e' \
    "$command" > "$temporary"
  /bin/chmod 700 "$temporary"
  /bin/mv -f "$temporary" "$target"
  [ -f "$target" ] && [ ! -L "$target" ] \
    || fail "Could not create safe Desktop launcher: $target"
}

alert_user() {
  local message="$*"
  /usr/bin/osascript - "$message" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display alert "Codex Dream Skin" message (item 1 of argv)
end run
APPLESCRIPT
}

ensure_state_root() {
  local parent
  parent="$(/usr/bin/dirname "$STATE_ROOT")"
  /bin/mkdir -p "$parent"
  [ ! -L "$STATE_ROOT" ] || fail "Unsafe symbolic-link state directory: $STATE_ROOT"
  if [ -e "$STATE_ROOT" ]; then
    [ -d "$STATE_ROOT" ] || fail "State path exists but is not a directory: $STATE_ROOT"
  else
    /bin/mkdir "$STATE_ROOT"
  fi
  [ -d "$STATE_ROOT" ] && [ ! -L "$STATE_ROOT" ] \
    || fail "Could not create a safe state directory: $STATE_ROOT"
  /bin/chmod 700 "$STATE_ROOT"

  # These are the only persistent subdirectories the product manages.  Check
  # all existing entries up front so no later theme/image/menu operation can
  # follow a user- or attacker-created symlink during a write or cleanup.
  local child
  for child in theme themes images menubar; do
    if [ -e "$STATE_ROOT/$child" ] || [ -L "$STATE_ROOT/$child" ]; then
      [ -d "$STATE_ROOT/$child" ] && [ ! -L "$STATE_ROOT/$child" ] \
        || fail "Unsafe managed state path: $STATE_ROOT/$child"
    fi
  done
}

ensure_managed_directory() {
  local path="$1"
  local relative="${path#"$STATE_ROOT/"}"
  [ "$relative" != "$path" ] && [ -n "$relative" ] \
    && [[ "$relative" != */* ]] && [ "$relative" != "." ] && [ "$relative" != ".." ] \
    || fail "Refusing unmanaged state directory: $path"
  ensure_state_root
  [ ! -L "$path" ] || fail "Unsafe symbolic-link managed directory: $path"
  if [ -e "$path" ]; then
    [ -d "$path" ] || fail "Managed state path is not a directory: $path"
  else
    /bin/mkdir "$path"
  fi
  [ -d "$path" ] && [ ! -L "$path" ] \
    || fail "Could not create a safe managed directory: $path"
  /bin/chmod 700 "$path"
}

validate_direct_state_file() {
  local path="$1"
  local relative="${path#"$STATE_ROOT/"}"
  [ "$relative" != "$path" ] && [ -n "$relative" ] && [[ "$relative" != */* ]] \
    || fail "Refusing unmanaged state file: $path"
  ensure_state_root
  [ ! -L "$path" ] || fail "Unsafe symbolic-link state file: $path"
  if [ -e "$path" ]; then
    [ -f "$path" ] || fail "State file path is not a regular file: $path"
  fi
}

safe_truncate_state_file() {
  local path="$1"
  local temporary
  validate_direct_state_file "$path"
  temporary="$(/usr/bin/mktemp "$STATE_ROOT/.state-file.XXXXXX")"
  /bin/chmod 600 "$temporary"
  /bin/mv -f "$temporary" "$path"
  [ -f "$path" ] && [ ! -L "$path" ] || fail "Could not create safe state file: $path"
}

safe_append_state_log() {
  local path="$1"
  shift
  validate_direct_state_file "$path"
  if [ ! -e "$path" ]; then
    safe_truncate_state_file "$path"
  fi
  printf '%s\n' "$*" >> "$path"
  /bin/chmod 600 "$path"
}

INSTALL_LOCK="$HOME/.codex/.qq-agentshow-install.lock"
INSTALL_LOCK_OWNED="false"

install_marker_is_valid() {
  local candidate="$1"
  [ -f "$candidate/.qq-agentshow-install" ] && [ ! -L "$candidate/.qq-agentshow-install" ] \
    || return 1
  /usr/bin/grep -F -x -q 'QQ_agentshow managed installation' "$candidate/.qq-agentshow-install" \
    && /usr/bin/grep -F -x -q 'schema=1' "$candidate/.qq-agentshow-install"
}

install_root_is_owned() {
  local candidate="$1"
  [ -d "$candidate" ] && [ ! -L "$candidate" ] || return 1
  install_marker_is_valid "$candidate" && return 0
  # One-time migration path for releases before the ownership marker existed.
  [ -f "$candidate/SKILL.md" ] && [ ! -L "$candidate/SKILL.md" ] \
    && [ -f "$candidate/VERSION" ] && [ ! -L "$candidate/VERSION" ] \
    && [ -f "$candidate/package.json" ] && [ ! -L "$candidate/package.json" ] \
    && [ -f "$candidate/scripts/install-dream-skin-macos.sh" ] \
    && [ ! -L "$candidate/scripts/install-dream-skin-macos.sh" ] \
    && /usr/bin/grep -F -q 'name: QQ_agentshow' "$candidate/SKILL.md" \
    && /usr/bin/grep -F -q '"name": "qq-agentshow"' "$candidate/package.json"
}
release_install_lock() {
  [ "$INSTALL_LOCK_OWNED" = "true" ] || return 0
  local owner=""
  owner="$(/bin/cat "$INSTALL_LOCK/owner.pid" 2>/dev/null || true)"
  if [ "$owner" = "$$" ]; then
    /bin/rm -f "$INSTALL_LOCK/owner.pid"
    /bin/rmdir "$INSTALL_LOCK" 2>/dev/null || true
  fi
  INSTALL_LOCK_OWNED="false"
}

acquire_install_lock() {
  /bin/mkdir -p "$HOME/.codex"
  if /bin/mkdir "$INSTALL_LOCK" 2>/dev/null; then
    /usr/bin/printf '%s\n' "$$" > "$INSTALL_LOCK/owner.pid"
    /bin/chmod 700 "$INSTALL_LOCK"
    /bin/chmod 600 "$INSTALL_LOCK/owner.pid"
    INSTALL_LOCK_OWNED="true"
    return 0
  fi
  [ -d "$INSTALL_LOCK" ] && [ ! -L "$INSTALL_LOCK" ] \
    || fail "Unsafe installation lock path: $INSTALL_LOCK"
  local owner=""
  owner="$(/bin/cat "$INSTALL_LOCK/owner.pid" 2>/dev/null || true)"
  if [ "$owner" = "$$" ]; then
    INSTALL_LOCK_OWNED="true"
    return 0
  fi
  case "$owner" in
    ''|*[!0-9]*) fail "Another installation may be running (invalid lock owner); inspect $INSTALL_LOCK" ;;
  esac
  if /bin/kill -0 "$owner" 2>/dev/null; then
    fail "Another QQ_agentshow installation is already running (PID $owner)."
  fi
  [ -f "$INSTALL_LOCK/owner.pid" ] && [ ! -L "$INSTALL_LOCK/owner.pid" ] \
    || fail "Unsafe stale installation lock: $INSTALL_LOCK"
  /bin/rm -f "$INSTALL_LOCK/owner.pid"
  /bin/rmdir "$INSTALL_LOCK" 2>/dev/null \
    || fail "Could not clear stale installation lock: $INSTALL_LOCK"
  /bin/mkdir "$INSTALL_LOCK"
  /usr/bin/printf '%s\n' "$$" > "$INSTALL_LOCK/owner.pid"
  /bin/chmod 700 "$INSTALL_LOCK"
  /bin/chmod 600 "$INSTALL_LOCK/owner.pid"
  INSTALL_LOCK_OWNED="true"
}

# Seed bundled preset packs into the user's themes/ library so a fresh install
# ships with ready-to-use skins. The personalizable Codex 2007 preset is owned
# by the user after first installation and is never overwritten by an update;
# other bundled presets are refreshed in place. custom-* packs are untouched.
seed_bundled_presets() {
  local presets_root="$PROJECT_ROOT/presets"
  [ -d "$presets_root" ] || return 0
  local themes_root="$STATE_ROOT/themes"
  ensure_managed_directory "$themes_root"
  if [ -e "$themes_root/preset-codex-1907-compatible" ] \
    || [ -L "$themes_root/preset-codex-1907-compatible" ]; then
    [ -d "$themes_root/preset-codex-1907-compatible" ] \
      && [ ! -L "$themes_root/preset-codex-1907-compatible" ] \
      || fail "Unsafe bundled preset destination: $themes_root/preset-codex-1907-compatible"
  fi
  /bin/rm -rf "$themes_root/preset-codex-1907-compatible"
  local src id dest entry
  for src in "$presets_root"/preset-*/; do
    [ -d "$src" ] || continue
    [ -f "${src}theme.json" ] || continue
    id="$(/usr/bin/basename "$src")"
    dest="$themes_root/$id"
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      [ -d "$dest" ] && [ ! -L "$dest" ] \
        || fail "Unsafe bundled preset destination: $dest"
    fi
    if [ "$id" = "preset-codex-1907-deep" ] && [ -f "$dest/theme.json" ] \
      && [ ! -L "$dest" ] && [ ! -L "$dest/theme.json" ]; then
      continue
    fi
    /bin/rm -rf "$dest"
    /bin/mkdir -p "$dest"
    /bin/chmod 700 "$dest"
    for entry in "$src"*; do
      [ -f "$entry" ] || continue
      /bin/cp "$entry" "$dest/"
    done
    /bin/chmod 600 "$dest"/* 2>/dev/null || true
  done
}

migrate_removed_presets() {
  [ -f "$THEME_DIR/theme.json" ] || return 0
  ensure_node_runtime
  local active_id
  active_id="$("$NODE" -e 'try{const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(t.id||"")}catch{}' "$THEME_DIR/theme.json")"
  [ "$active_id" = "preset-codex-1907-compatible" ] || return 0
  "$SCRIPT_DIR/switch-theme-macos.sh" --id preset-codex-1907-deep --no-apply >/dev/null
}

discover_codex_app() {
  local candidate=""
  local identifier=""
  local executable_name=""
  local configured="${CODEX_APP_BUNDLE:-}"

  for candidate in "$configured" \
    "/Applications/ChatGPT.app" "$HOME/Applications/ChatGPT.app" \
    "/Applications/Codex.app" "$HOME/Applications/Codex.app"; do
    [ -n "$candidate" ] || continue
    [ -f "$candidate/Contents/Info.plist" ] || continue
    identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
    if [ "$identifier" = "com.openai.codex" ]; then
      CODEX_BUNDLE="$candidate"
      break
    fi
  done

  if [ -z "${CODEX_BUNDLE:-}" ]; then
    candidate="$(/usr/bin/mdfind 'kMDItemCFBundleIdentifier == "com.openai.codex"' | /usr/bin/head -n 1)"
    if [ -n "$candidate" ] && [ -f "$candidate/Contents/Info.plist" ]; then
      identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
      [ "$identifier" = "com.openai.codex" ] && CODEX_BUNDLE="$candidate"
    fi
  fi

  [ -n "${CODEX_BUNDLE:-}" ] || fail "Could not find the official Codex app bundle (com.openai.codex)."
  executable_name="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$CODEX_BUNDLE/Contents/Info.plist")"
  CODEX_EXE="$CODEX_BUNDLE/Contents/MacOS/$executable_name"
  CODEX_VERSION="$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$CODEX_BUNDLE/Contents/Info.plist")"
  [ -x "$CODEX_EXE" ] || fail "Codex executable is missing: $CODEX_EXE"
  export CODEX_BUNDLE CODEX_EXE CODEX_VERSION
}

codesign_team_id() {
  /usr/bin/codesign -dv --verbose=4 "$1" 2>&1 \
    | /usr/bin/awk -F= '/^TeamIdentifier=/{print $2; exit}'
}

require_macos_runtime() {
  [ "$(/usr/bin/uname -s)" = "Darwin" ] || fail "This launcher requires macOS."
  [ -n "${CODEX_BUNDLE:-}" ] || fail "Discover the Codex app before validating its runtime."

  RUNTIME_NODE="$CODEX_BUNDLE/Contents/Resources/cua_node/bin/node"
  [ -x "$RUNTIME_NODE" ] || fail "The signed Node.js runtime bundled with Codex was not found: $RUNTIME_NODE"
  /usr/bin/codesign --verify --deep --strict "$CODEX_BUNDLE" >/dev/null 2>&1 \
    || fail "The Codex app signature is not valid. Restore or reinstall the official app before continuing."
  /usr/bin/codesign --verify --strict "$RUNTIME_NODE" >/dev/null 2>&1 \
    || fail "The Node.js runtime bundled with Codex failed code-signature validation."

  CODEX_TEAM_ID="$(codesign_team_id "$CODEX_BUNDLE")"
  NODE_TEAM_ID="$(codesign_team_id "$RUNTIME_NODE")"
  [ "$CODEX_TEAM_ID" = "$EXPECTED_CODEX_TEAM_ID" ] \
    || fail "Unexpected Codex signing team: ${CODEX_TEAM_ID:-missing}."
  [ "$NODE_TEAM_ID" = "$CODEX_TEAM_ID" ] \
    || fail "The bundled Node.js signer does not match the Codex app signer."

  local machine_arch
  local node_major
  machine_arch="$(/usr/bin/uname -m)"
  /usr/bin/file "$RUNTIME_NODE" | /usr/bin/grep -q "$machine_arch" \
    || fail "The Codex Node.js runtime does not match this Mac architecture ($machine_arch)."
  NODE_VERSION="$($RUNTIME_NODE --version)"
  node_major="${NODE_VERSION#v}"
  node_major="${node_major%%.*}"
  case "$node_major" in ''|*[!0-9]*) fail "Could not parse bundled Node.js version: $NODE_VERSION" ;; esac
  [ "$node_major" -ge 20 ] || fail "Codex bundled Node.js $NODE_VERSION is too old; version 20 or newer is required."

  NODE="$RUNTIME_NODE"
  export NODE RUNTIME_NODE NODE_VERSION CODEX_TEAM_ID NODE_TEAM_ID
}

codex_main_pids() {
  local pid
  local command_line
  while read -r pid command_line; do
    [ -n "$pid" ] || continue
    case "$command_line" in
      "$CODEX_EXE"*) printf '%s\n' "$pid" ;;
    esac
  done < <(/bin/ps -axo pid=,command=)
}

codex_is_running() {
  [ -n "$(codex_main_pids)" ]
}

any_official_codex_is_running() {
  local candidate=""
  local identifier=""
  local executable_name=""
  local executable=""
  local team_id=""
  local pid=""
  local command_line=""
  local candidates="${CODEX_APP_BUNDLE:-}
/Applications/ChatGPT.app
$HOME/Applications/ChatGPT.app
/Applications/Codex.app
$HOME/Applications/Codex.app"
  candidates="$candidates
$(/usr/bin/mdfind 'kMDItemCFBundleIdentifier == "com.openai.codex"' 2>/dev/null || true)"
  while IFS= read -r candidate; do
    [ -n "$candidate" ] && [ -f "$candidate/Contents/Info.plist" ] || continue
    identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
    [ "$identifier" = "com.openai.codex" ] || continue
    team_id="$(codesign_team_id "$candidate")"
    [ "$team_id" = "$EXPECTED_CODEX_TEAM_ID" ] || continue
    executable_name="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
    executable="$candidate/Contents/MacOS/$executable_name"
    [ -x "$executable" ] || continue
    while read -r pid command_line; do
      [ -n "$pid" ] || continue
      case "$command_line" in "$executable"*) return 0 ;; esac
    done < <(/bin/ps -axo pid=,command=)
  done <<< "$candidates"
  return 1
}

process_started_at() {
  /bin/ps -p "$1" -o lstart= 2>/dev/null | /usr/bin/awk '{$1=$1; print}'
}

recorded_injector_process_matches() {
  local pid="$1"
  local expected_start="${2:-}"
  local expected_node="${3:-}"
  local expected_injector="${4:-}"
  local expected_port="${5:-}"
  local command_line=""
  local command_lower=""
  local node_lower=""
  local injector_lower=""
  local actual_start=""

  # A recorded PID is only safe to signal when the complete launch identity
  # was persisted.  Do not fall back to the current process paths: a stale or
  # hand-edited state file must fail closed instead of authorizing a reused PID.
  [ -n "$expected_start" ] && [ -n "$expected_node" ] && [ -n "$expected_injector" ] || return 1
  case "$expected_port" in
    ''|*[!0-9]*) return 1 ;;
  esac
  /bin/kill -0 "$pid" 2>/dev/null || return 1
  command_line="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
  [ -n "$command_line" ] || return 1
  command_lower="$(printf '%s' "$command_line" | /usr/bin/tr '[:upper:]' '[:lower:]')"
  injector_lower="$(printf '%s' "$expected_injector" | /usr/bin/tr '[:upper:]' '[:lower:]')"
  node_lower="$(printf '%s' "$expected_node" | /usr/bin/tr '[:upper:]' '[:lower:]')"
  case "$command_lower" in "$node_lower "*) ;; *) return 1 ;; esac
  # The watcher launch shape is deliberately matched as tokens.  In
  # particular, `--port 93410` must never satisfy a saved `9341` identity.
  case "$command_lower" in
    *"$injector_lower --watch --port $expected_port --theme-dir "*) ;;
    *) return 1 ;;
  esac
  actual_start="$(process_started_at "$pid")"
  [ -n "$actual_start" ] && [ "$actual_start" = "$expected_start" ] || return 1
  return 0
}

stop_codex() {
  local allow_force="${1:-false}"
  local deadline
  local pid

  release_codex_launchd_job
  codex_is_running || return 0
  /usr/bin/osascript -e 'tell application id "com.openai.codex" to quit' >/dev/null 2>&1 || true
  deadline=$((SECONDS + 15))
  while codex_is_running && [ "$SECONDS" -lt "$deadline" ]; do /bin/sleep 0.25; done
  codex_is_running || return 0

  [ "$allow_force" = "true" ] || fail "Codex did not close within 15 seconds; explicit restart authorization is required for a forced stop."
  while IFS= read -r pid; do
    [ -n "$pid" ] && /bin/kill -TERM "$pid" 2>/dev/null || true
  done < <(codex_main_pids)
  deadline=$((SECONDS + 5))
  while codex_is_running && [ "$SECONDS" -lt "$deadline" ]; do /bin/sleep 0.25; done
  if codex_is_running; then
    while IFS= read -r pid; do
      [ -n "$pid" ] && /bin/kill -KILL "$pid" 2>/dev/null || true
    done < <(codex_main_pids)
  fi
  /bin/sleep 0.5
  codex_is_running && fail "Codex could not be stopped safely."
  return 0
}

listener_endpoints() {
  local port="$1"
  /usr/sbin/lsof -nP -a -iTCP:"$port" -sTCP:LISTEN -Fpn 2>/dev/null \
    | /usr/bin/awk '
      /^p[0-9]+$/ { pid=substr($0,2); next }
      /^n/ && pid { print pid "|" substr($0,2) }
    ' || true
}

listener_pids() {
  listener_endpoints "$1" | /usr/bin/awk -F'|' '!seen[$1]++ { print $1 }' || true
}

port_is_available() {
  [ -z "$(listener_pids "$1")" ]
}

pid_is_codex_descendant() {
  local current="$1"
  local command_line=""
  local parent=""
  local depth=0
  while [ "$current" -gt 1 ] 2>/dev/null && [ "$depth" -lt 32 ]; do
    command_line="$(/bin/ps -p "$current" -o command= 2>/dev/null || true)"
    case "$command_line" in "$CODEX_EXE"*) return 0 ;; esac
    parent="$(/bin/ps -p "$current" -o ppid= 2>/dev/null | /usr/bin/awk '{$1=$1; print}')"
    case "$parent" in ''|*[!0-9]*) return 1 ;; esac
    [ "$parent" -ne "$current" ] || return 1
    current="$parent"
    depth=$((depth + 1))
  done
  return 1
}

port_belongs_to_codex() {
  local port="$1"
  local found="false"
  local pid endpoint
  while IFS='|' read -r pid endpoint; do
    [ -n "$pid" ] && [ -n "$endpoint" ] || continue
    found="true"
    case "$endpoint" in
      "127.0.0.1:$port"|"[::1]:$port") ;;
      *) return 1 ;;
    esac
    pid_is_codex_descendant "$pid" || return 1
  done < <(listener_endpoints "$port")
  [ "$found" = "true" ]
}

# Cheap: can we talk to a loopback DevTools HTTP endpoint?
cdp_http_ready() {
  local port="$1"
  /usr/bin/curl --noproxy '*' --silent --fail --max-time 1 \
    "http://127.0.0.1:${port}/json/version" >/dev/null 2>&1
}

verified_cdp_endpoint() {
  local port="$1"
  port_belongs_to_codex "$port" || return 1
  cdp_http_ready "$port"
}

select_available_port() {
  local preferred="$1"
  local candidate="$preferred"
  local last=$((preferred + 100))
  [ "$last" -le 65535 ] || last=65535
  while [ "$candidate" -le "$last" ]; do
    if port_is_available "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
  done
  fail "No free loopback port was found between $preferred and $last."
}

wait_for_cdp() {
  local port="$1"
  local deadline=$((SECONDS + 45))
  local last_note=0
  while [ "$SECONDS" -lt "$deadline" ]; do
    verified_cdp_endpoint "$port" && return 0
    if [ $((SECONDS - last_note)) -ge 8 ]; then
      last_note=$SECONDS
      printf 'Waiting for Codex debug port %s… (%ss)\n' "$port" "$SECONDS" >&2
    fi
    /bin/sleep 0.35
  done
  return 1
}

state_field() {
  local key="$1"
  "$NODE" -e '
    const fs = require("node:fs");
    const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))[process.argv[2]];
    if (value !== undefined && value !== null) process.stdout.write(String(value));
  ' "$STATE_PATH" "$key"
}

file_sha256() {
  [ -f "$1" ] && [ ! -L "$1" ] || return 1
  /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'
}

write_state() {
  local port="$1"
  local injector_pid="$2"
  local injector_started_at="$3"
  local codex_pid="$4"
  local node_ver="${NODE_VERSION:-unknown}"
  local bundle="${CODEX_BUNDLE:-}"
  local exe="${CODEX_EXE:-}"
  local app_ver="${CODEX_VERSION:-}"
  local team="${CODEX_TEAM_ID:-}"
  local injector_sha=""
  local temporary=""
  ensure_state_root
  validate_direct_state_file "$STATE_PATH"
  injector_sha="$(file_sha256 "$INJECTOR")" \
    || fail "Could not hash the installed injector before saving its identity."
  temporary="$(/usr/bin/mktemp "$STATE_ROOT/.state.XXXXXX")"
  /bin/chmod 600 "$temporary"
  "$NODE" -e '
    const fs = require("node:fs");
    const [file, version, port, pid, startedAt, injector, injectorSha256, node, nodeVersion, bundle, exe, appVersion, teamId, root, themeDir, codexPid, arch] = process.argv.slice(1);
    const state = {
      schemaVersion: 5,
      platform: `darwin-${arch}`,
      skinVersion: version,
      injectorProtocol: 2,
      port: Number(port),
      injectorPid: Number(pid),
      injectorStartedAt: startedAt,
      injectorPath: injector,
      injectorSha256,
      nodePath: node,
      nodeVersion,
      codexBundle: bundle,
      codexExe: exe,
      codexVersion: appVersion,
      codexTeamId: teamId,
      codexPid: Number(codexPid || 0),
      projectRoot: root,
      themeDir,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  ' "$temporary" "$SKIN_VERSION" "$port" "$injector_pid" "$injector_started_at" "$INJECTOR" "$injector_sha" "$NODE" "$node_ver" "$bundle" "$exe" "$app_ver" "$team" "$PROJECT_ROOT" "$THEME_DIR" "$codex_pid" "$(/usr/bin/uname -m)"
  /bin/mv -f "$temporary" "$STATE_PATH"
  [ -f "$STATE_PATH" ] && [ ! -L "$STATE_PATH" ] \
    || fail "Could not save safe Dream Skin state."
}

stop_recorded_injector() {
  [ -f "$STATE_PATH" ] || return 0
  local pid
  local saved_port
  local saved_start
  local saved_node
  local saved_injector
  if ! pid="$(state_field injectorPid 2>/dev/null)" || [ -z "${pid:-}" ]; then
    printf 'Dream Skin state is damaged or missing its injector PID; state was preserved.\n' >&2
    return 1
  fi
  # Already paused / no daemon
  if [ "$pid" = "0" ]; then
    /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
    return 0
  fi
  case "$pid" in
    *[!0-9]*|??????????*)
      printf 'Recorded Dream Skin injector PID is invalid; state was preserved.\n' >&2
      return 1
      ;;
  esac
  while [ "${pid#0}" != "$pid" ]; do pid="${pid#0}"; done
  if [ -z "$pid" ]; then
    /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
    return 0
  fi

  # Load and validate every recorded identity field before probing or
  # signalling the PID.  Missing fields are not treated as a harmless legacy
  # state: preserving the evidence is safer than guessing which process is
  # allowed to receive TERM/KILL.
  saved_port="$(state_field port 2>/dev/null || true)"
  saved_start="$(state_field injectorStartedAt 2>/dev/null || true)"
  saved_node="$(state_field nodePath 2>/dev/null || true)"
  saved_injector="$(state_field injectorPath 2>/dev/null || true)"
  case "$saved_port" in
    ''|*[!0-9]*)
      printf 'Recorded Dream Skin injector port is missing or invalid; state was preserved.\n' >&2
      return 1
      ;;
  esac
  [ "$saved_port" -ge 1024 ] && [ "$saved_port" -le 65535 ] || {
    printf 'Recorded Dream Skin injector port is out of range; state was preserved.\n' >&2
    return 1
  }
  if [ -z "$saved_start" ] || [ -z "$saved_node" ] || [ -z "$saved_injector" ]; then
    printf 'Recorded Dream Skin injector identity is incomplete; state was preserved.\n' >&2
    return 1
  fi
  /bin/kill -0 "$pid" 2>/dev/null || {
    /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
    return 0
  }
  if ! recorded_injector_process_matches "$pid" "$saved_start" "$saved_node" "$saved_injector" "$saved_port"; then
    # The process may have exited between the initial kill -0 probe and the
    # identity check. A dead (or already reaped) recorded PID is safe to
    # forget; a live PID with mismatched identity is never signalled.
    if ! /bin/kill -0 "$pid" 2>/dev/null || [ -z "$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)" ]; then
      /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
      return 0
    fi
    printf 'Recorded injector PID %s is live but its identity does not match; refusing to signal it.\n' "$pid" >&2
    return 1
  fi
  /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
  /bin/kill -TERM "$pid" 2>/dev/null || true
  local deadline=$((SECONDS + 6))
  while /bin/kill -0 "$pid" 2>/dev/null && [ "$SECONDS" -lt "$deadline" ]; do /bin/sleep 0.2; done
  if recorded_injector_process_matches "$pid" "$saved_start" "$saved_node" "$saved_injector" "$saved_port"; then
    /bin/kill -KILL "$pid" 2>/dev/null || true
  fi
  deadline=$((SECONDS + 2))
  while recorded_injector_process_matches "$pid" "$saved_start" "$saved_node" "$saved_injector" "$saved_port" \
    && [ "$SECONDS" -lt "$deadline" ]; do
    /bin/sleep 0.1
  done
  if recorded_injector_process_matches "$pid" "$saved_start" "$saved_node" "$saved_injector" "$saved_port"; then
    printf 'Could not stop the recorded Dream Skin injector (PID %s).\n' "$pid" >&2
    return 1
  fi
  return 0
}

launch_injector_daemon() {
  local port="$1"
  local pid=""
  local deadline=$((SECONDS + 10))
  safe_truncate_state_file "$INJECTOR_LOG"
  safe_truncate_state_file "$INJECTOR_ERROR_LOG"
  /bin/launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true

  # Prefer launchctl for the long-running watcher.  A plain nohup child can
  # survive the initial PID probe yet exit right after its parent shell goes
  # away on some Codex/Electron launches, leaving a stale state file.
  /bin/launchctl submit -l "$INJECTOR_JOB_LABEL" -o "$INJECTOR_LOG" -e "$INJECTOR_ERROR_LOG" -- \
    "$NODE" "$INJECTOR" --watch --port "$port" --theme-dir "$THEME_DIR" >/dev/null 2>&1 || true
  /bin/launchctl kickstart -k "gui/$(/usr/bin/id -u)/$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || true
  while [ "$SECONDS" -lt "$deadline" ]; do
    pid="$(/bin/ps -axo pid=,command= | /usr/bin/awk -v node="$NODE" -v inj="$INJECTOR" -v port="$port" '
      $2 == node && index($0, inj) && index($0, "--watch") && index($0, "--port " port " --theme-dir ") && !found { found=$1 }
      END { if (found) print found }
    ')"
    if [ -n "$pid" ] && /bin/kill -0 "$pid" 2>/dev/null; then
      printf '%s\n' "$pid"
      return 0
    fi
    pid="$(/bin/launchctl print "gui/$(/usr/bin/id -u)/$INJECTOR_JOB_LABEL" 2>/dev/null \
      | /usr/bin/awk '/^[[:space:]]*pid = [0-9]+/{print $3; exit}')"
    if [ -n "$pid" ] && /bin/kill -0 "$pid" 2>/dev/null; then
      printf '%s\n' "$pid"
      return 0
    fi
    /bin/sleep 0.2
  done

  # Fallback: direct background process if launchctl is unavailable.
  /usr/bin/nohup "$NODE" "$INJECTOR" --watch --port "$port" --theme-dir "$THEME_DIR" \
    >>"$INJECTOR_LOG" 2>>"$INJECTOR_ERROR_LOG" &
  pid="$!"
  /bin/sleep 1
  if [ -n "$pid" ] && /bin/kill -0 "$pid" 2>/dev/null; then
    printf '%s\n' "$pid"
    return 0
  fi
  fail "The injector did not start. See $INJECTOR_ERROR_LOG and $INJECTOR_LOG"
}

# Resolve Node from the currently installed, signed official Codex bundle on
# every invocation.  state.json and inherited environment variables are hints
# at most; neither may authorize an executable or signing identity.
ensure_node_runtime() {
  unset NODE NODE_VERSION RUNTIME_NODE NODE_TEAM_ID CODEX_BUNDLE CODEX_EXE CODEX_VERSION CODEX_TEAM_ID
  discover_codex_app
  require_macos_runtime
}

# Fast path when CDP is already open: restart injector + one-shot inject.
# Returns 0 on success, 1 if CDP is not ready (caller should full-start).
hot_reapply_theme() {
  local port="${1:-9341}"
  local timeout_ms="${2:-8000}"
  local inj_pid=""
  local injector_protocol=""
  local saved_skin_version=""
  local saved_injector_pid=""
  local saved_injector_start=""
  local saved_injector=""
  local saved_injector_sha=""
  local saved_node=""
  local current_injector_sha=""
  local started_at=""
  local codex_pid=""

  # A generic HTTP listener is not enough for a hot re-apply: only use the
  # endpoint already verified as belonging to the official Codex process.
  verified_cdp_endpoint "$port" || return 1
  ensure_node_runtime || return 1

  injector_protocol="$(state_field injectorProtocol 2>/dev/null || true)"
  saved_skin_version="$(state_field skinVersion 2>/dev/null || true)"
  saved_injector_pid="$(state_field injectorPid 2>/dev/null || true)"
  saved_injector_start="$(state_field injectorStartedAt 2>/dev/null || true)"
  saved_injector="$(state_field injectorPath 2>/dev/null || true)"
  saved_injector_sha="$(state_field injectorSha256 2>/dev/null || true)"
  saved_node="$(state_field nodePath 2>/dev/null || true)"
  current_injector_sha="$(file_sha256 "$INJECTOR" 2>/dev/null || true)"
  if [ "$injector_protocol" = "2" ] \
    && [ "$saved_skin_version" = "$SKIN_VERSION" ] \
    && [ "$saved_injector" = "$INJECTOR" ] \
    && [ "$saved_injector_sha" = "$current_injector_sha" ] \
    && [ -n "$current_injector_sha" ] \
    && [ "$saved_node" = "$NODE" ] \
    && recorded_injector_process_matches "$saved_injector_pid" "$saved_injector_start" \
      "$saved_node" "$saved_injector" "$port"; then
    inj_pid="$saved_injector_pid"
  fi
  if ! "$NODE" "$INJECTOR" --once --port "$port" --theme-dir "$THEME_DIR" \
    --timeout-ms "$timeout_ms" >/dev/null 2>&1; then
    return 1
  fi

  # Only an exact build-and-process identity may be reused.  In particular,
  # an older watcher cannot be promoted to a new skin version merely because
  # it is still alive: that kept serving the previous embedded sound bytes.
  if [ -n "$inj_pid" ] && /bin/kill -0 "$inj_pid" 2>/dev/null; then
    # Theme switches and in-place upgrades can reuse a healthy watcher. Keep
    # state.json in sync with that process instead of leaving the previous PID
    # and skin version behind (which makes status report a false "stale").
    started_at="$(process_started_at "$inj_pid")"
    codex_pid="$(codex_main_pids 2>/dev/null | /usr/bin/head -n 1)"
    [ -n "$started_at" ] || return 1
    write_state "$port" "$inj_pid" "$started_at" "${codex_pid:-0}"
    return 0
  fi
  stop_recorded_injector 2>/dev/null || return 1
  inj_pid="$(launch_injector_daemon "$port")"
  /bin/kill -0 "$inj_pid" 2>/dev/null || return 1
  started_at="$(process_started_at "$inj_pid")"
  codex_pid="$(codex_main_pids 2>/dev/null | /usr/bin/head -n 1)"
  [ -n "$started_at" ] || started_at="$(/bin/date)"
  write_state "$port" "$inj_pid" "$started_at" "${codex_pid:-0}"
  return 0
}

# Always tear down any leftover launchd babysitter for the themed Codex process.
# Older builds used `launchctl submit` which can relaunch Codex after the user quits
# or after SwiftBar exits — that is unexpected and unwanted.
release_codex_launchd_job() {
  /bin/launchctl remove "gui/$(/usr/bin/id -u)/$CODEX_APP_JOB_LABEL" >/dev/null 2>&1 || true
  /bin/launchctl remove "$CODEX_APP_JOB_LABEL" >/dev/null 2>&1 || true
}

launch_codex_with_cdp() {
  local port="$1"
  safe_truncate_state_file "$APP_LOG"
  safe_truncate_state_file "$APP_ERROR_LOG"
  release_codex_launchd_job
  # Start as a normal user process (NOT launchctl submit). submit keeps a job
  # that will restart Codex when the window is closed.
  /usr/bin/open -na "$CODEX_BUNDLE" --args \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$port" \
    >>"$APP_LOG" 2>>"$APP_ERROR_LOG" || true
  # Fallback if open failed to pass args on some builds
  if ! codex_is_running; then
    /usr/bin/nohup "$CODEX_EXE" \
      --remote-debugging-address=127.0.0.1 \
      --remote-debugging-port="$port" \
      >>"$APP_LOG" 2>>"$APP_ERROR_LOG" &
  fi
}

launch_codex_normally() {
  release_codex_launchd_job
  /usr/bin/open -na "$CODEX_BUNDLE"
}
