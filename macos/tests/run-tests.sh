#!/bin/bash

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
NODE="${NODE:-/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node}"
[ -x "$NODE" ] || { printf 'Codex bundled Node.js was not found: %s\n' "$NODE" >&2; exit 1; }

ROOT_INSTALLER="$ROOT/../install.sh"
if [ -f "$ROOT_INSTALLER" ]; then
  if /usr/bin/grep -F -q \
    '"$engine/scripts/switch-theme-macos.sh" --id preset-codex-1907-deep' \
    "$ROOT_INSTALLER"; then
    printf 'Root installer still resets the active theme during every update.\n' >&2
    exit 1
  fi
else
  printf 'SKIP: repository-only root installer fixtures are not part of the standalone macOS package.\n'
fi
/usr/bin/grep -F -q 'preflight_install' "$ROOT/scripts/install-dream-skin-macos.sh"

while IFS= read -r file; do /bin/bash -n "$file"; done < <(
  /usr/bin/find "$ROOT" -type f \( -name '*.sh' -o -name '*.command' \) \
    ! -path '*/release/*' -print
)
while IFS= read -r file; do "$NODE" --check "$file" >/dev/null; done < <(
  /usr/bin/find "$ROOT/scripts" "$ROOT/assets" "$ROOT/presets" -type f \( -name '*.mjs' -o -name '*.js' \) -print
)

if /usr/bin/grep -R -n -E 'dream-skin-skin|DREAM_SKIN_SKIN|1\.0\.0-rc2' \
  "$ROOT/scripts" "$ROOT/assets" >/dev/null; then
  printf 'Legacy release-candidate identifiers remain in runtime files.\n' >&2
  exit 1
fi
if /usr/bin/grep -R -n -E '(writeFile|rename|copyFile|rm).*app\.asar' "$ROOT/scripts" >/dev/null; then
  printf 'A runtime script appears to mutate app.asar.\n' >&2
  exit 1
fi
if /usr/bin/grep -R -n --include='*.sh' -E '/usr/bin/python3|(^|[[:space:]])eval([[:space:]]|$)' \
  "$ROOT/scripts" "$ROOT/menubar" >/dev/null; then
  printf 'Runtime shell (scripts + menu bar) must parse JSON with bundled Node.js or plain shell, without python3 or eval.\n' >&2
  exit 1
fi
if /usr/bin/grep -R -n --include='*.sh' -E '/usr/bin/osascript[[:space:]]+-e[[:space:]]+"' \
  "$ROOT/scripts" "$ROOT/menubar" >/dev/null; then
  printf 'Dynamic AppleScript must be passed through argv, not interpolated into osascript -e.\n' >&2
  exit 1
fi
if ! /usr/bin/grep -F -q 'sfimage=paintpalette.fill' \
  "$ROOT/menubar/codex_dream_skin.10s.sh"; then
  printf 'SwiftBar menu title must retain the Dream Skin palette icon.\n' >&2
  exit 1
fi
if ! /usr/bin/grep -F -q 'flag: "wx"' "$ROOT/scripts/write-theme.mjs"; then
  printf 'Theme writes must create randomized temporary files exclusively.\n' >&2
  exit 1
fi

"$NODE" "$ROOT/scripts/injector.mjs" --check-payload >/dev/null
"$NODE" "$ROOT/tests/image-metadata.test.mjs"
"$NODE" "$ROOT/tests/injector-bootstrap.test.mjs"
"$NODE" "$ROOT/tests/renderer-inject.test.mjs"
"$NODE" "$ROOT/tests/qq-show-behavior.test.mjs"
"$NODE" "$ROOT/tests/composer-scroll-behavior.test.mjs"
"$NODE" "$ROOT/tests/notification-behavior.test.mjs"
"$NODE" "$ROOT/tests/multi-image-behavior.test.mjs"
"$NODE" "$ROOT/tests/release-matrix.test.mjs"
"$NODE" "$ROOT/tests/theme-stage.test.mjs"
"$NODE" "$ROOT/tests/privacy-gate.test.mjs"
"$NODE" "$ROOT/scripts/check-asset-provenance.mjs"

# Every bundled preset must be a valid, injectable theme pack with a preset-* id.
for preset in "$ROOT"/presets/preset-*/; do
  [ -d "$preset" ] || continue
  PRESET_CHECK="$("$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$preset")"
  "$NODE" -e '
    const v = JSON.parse(process.argv[1]);
    if (!v.pass || !String(v.themeId).startsWith("preset-") || v.imageBytes < 1) process.exit(1);
  ' "$PRESET_CHECK"
done

TMP="$(/usr/bin/mktemp -d /tmp/codex-dream-skin-tests.XXXXXX)"
TEST_INJECTOR_JOB_LABEL="com.openai.codex-dream-skin-studio.tests.$$"
DUMMY_PID=""
STATUS_PID=""
WATCH_PID=""
HOT_PID=""
cleanup_tests() {
  if [ -n "$DUMMY_PID" ]; then
    /bin/kill -TERM "$DUMMY_PID" 2>/dev/null || true
    wait "$DUMMY_PID" 2>/dev/null || true
  fi
  if [ -n "$STATUS_PID" ]; then
    /bin/kill -TERM "$STATUS_PID" 2>/dev/null || true
    wait "$STATUS_PID" 2>/dev/null || true
  fi
  if [ -n "$WATCH_PID" ]; then
    /bin/kill -TERM "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
  fi
  if [ -n "$HOT_PID" ]; then
    /bin/kill -TERM "$HOT_PID" 2>/dev/null || true
    wait "$HOT_PID" 2>/dev/null || true
  fi
  /bin/rm -rf "$TMP"
}
trap cleanup_tests EXIT

# Persistent state is a destructive-write boundary.  The engine must reject
# symlinked roots or managed children before seeding, switching, or cleaning a
# theme, and it must leave every external target untouched.
STATE_LINK_HOME="$TMP/state-link-home"
STATE_LINK_TARGET="$TMP/state-link-target"
/bin/mkdir -p "$STATE_LINK_HOME/Library/Application Support" "$STATE_LINK_TARGET"
/usr/bin/printf '%s\n' 'preserve-root-target' > "$STATE_LINK_TARGET/sentinel"
/bin/ln -s "$STATE_LINK_TARGET" \
  "$STATE_LINK_HOME/Library/Application Support/CodexDreamSkinStudio"
if /usr/bin/env HOME="$STATE_LINK_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  ensure_state_root
' _ "$ROOT" >/dev/null 2>&1; then
  printf 'State-root symlink was unexpectedly accepted.\n' >&2
  exit 1
fi
/usr/bin/grep -F -x -q 'preserve-root-target' "$STATE_LINK_TARGET/sentinel"

for child in themes theme images menubar; do
  CHILD_HOME="$TMP/state-child-$child-home"
  CHILD_ROOT="$CHILD_HOME/Library/Application Support/CodexDreamSkinStudio"
  CHILD_TARGET="$TMP/state-child-$child-target"
  /bin/mkdir -p "$CHILD_ROOT" "$CHILD_TARGET"
  /usr/bin/printf '%s\n' "preserve-$child-target" > "$CHILD_TARGET/sentinel"
  /bin/ln -s "$CHILD_TARGET" "$CHILD_ROOT/$child"
  if /usr/bin/env HOME="$CHILD_HOME" /bin/bash -c '
    . "$1/scripts/common-macos.sh"
    ensure_state_root
  ' _ "$ROOT" >/dev/null 2>&1; then
    printf 'Managed state child symlink was unexpectedly accepted: %s\n' "$child" >&2
    exit 1
  fi
  /usr/bin/grep -F -x -q "preserve-$child-target" "$CHILD_TARGET/sentinel"
done

# Launcher paths are emitted as one literal shell word.  Exercise spaces and
# every common substitution/metacharacter class and prove no marker command is
# executed when the generated command is parsed by macOS bash.
QUOTE_MARKER="$TMP/launcher-command-substitution-ran"
QUOTE_BACKTICK_MARKER="$TMP/launcher-backtick-ran"
QUOTE_VALUE="$TMP/space dir/\$(touch $QUOTE_MARKER)-\`touch $QUOTE_BACKTICK_MARKER\`-'quote'-\$HOME-!"
QUOTE_CAPTURE="$TMP/capture-launcher-argv.sh"
QUOTE_OUTPUT="$TMP/capture-launcher-argv.txt"
/usr/bin/printf '%s\n' '#!/bin/bash' 'printf "%s\n%s\n" "$#" "$1" > "$2"' > "$QUOTE_CAPTURE"
/bin/chmod 700 "$QUOTE_CAPTURE"
QUOTED_CAPTURE="$(/usr/bin/env HOME="$TMP/quote-home" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  shell_single_quote "$2"
' _ "$ROOT" "$QUOTE_CAPTURE")"
QUOTED_VALUE="$(/usr/bin/env HOME="$TMP/quote-home" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  shell_single_quote "$2"
' _ "$ROOT" "$QUOTE_VALUE")"
QUOTED_OUTPUT="$(/usr/bin/env HOME="$TMP/quote-home" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  shell_single_quote "$2"
' _ "$ROOT" "$QUOTE_OUTPUT")"
/bin/bash -c "exec $QUOTED_CAPTURE $QUOTED_VALUE $QUOTED_OUTPUT"
[ "$(/usr/bin/sed -n '1p' "$QUOTE_OUTPUT")" = "2" ]
[ "$(/usr/bin/sed -n '2p' "$QUOTE_OUTPUT")" = "$QUOTE_VALUE" ]
[ ! -e "$QUOTE_MARKER" ] && [ ! -e "$QUOTE_BACKTICK_MARKER" ]

LAUNCHER_HOME="$TMP/launcher-link-home"
/bin/mkdir -p "$LAUNCHER_HOME/Desktop"
LAUNCHER_SENTINEL="$TMP/launcher-link-sentinel"
/usr/bin/printf '%s\n' 'preserve-launcher-target' > "$LAUNCHER_SENTINEL"
/bin/ln -s "$LAUNCHER_SENTINEL" "$LAUNCHER_HOME/Desktop/Codex Dream Skin.command"
if /usr/bin/env HOME="$LAUNCHER_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin.command" "exec /usr/bin/true"
' _ "$ROOT" >/dev/null 2>&1; then
  printf 'Launcher writer unexpectedly followed an existing symlink.\n' >&2
  exit 1
fi
/usr/bin/grep -F -x -q 'preserve-launcher-target' "$LAUNCHER_SENTINEL"
/bin/rm "$LAUNCHER_HOME/Desktop/Codex Dream Skin.command"
DANGLING_TARGET="$TMP/dangling-launcher-created"
/bin/ln -s "$DANGLING_TARGET" "$LAUNCHER_HOME/Desktop/Codex Dream Skin.command"
if /usr/bin/env HOME="$LAUNCHER_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  write_managed_launcher "$HOME/Desktop/Codex Dream Skin.command" "exec /usr/bin/true"
' _ "$ROOT" >/dev/null 2>&1; then
  printf 'Launcher writer unexpectedly followed a dangling symlink.\n' >&2
  exit 1
fi
[ ! -e "$DANGLING_TARGET" ]

LOG_LINK_HOME="$TMP/log-link-home"
LOG_LINK_ROOT="$LOG_LINK_HOME/Library/Application Support/CodexDreamSkinStudio"
LOG_SENTINEL="$TMP/log-link-sentinel"
/bin/mkdir -p "$LOG_LINK_ROOT"
/usr/bin/printf '%s\n' 'preserve-log-target' > "$LOG_SENTINEL"
/bin/ln -s "$LOG_SENTINEL" "$LOG_LINK_ROOT/injector.log"
if /usr/bin/env HOME="$LOG_LINK_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  safe_truncate_state_file "$INJECTOR_LOG"
' _ "$ROOT" >/dev/null 2>&1; then
  printf 'State log writer unexpectedly followed a symlink.\n' >&2
  exit 1
fi
/usr/bin/grep -F -x -q 'preserve-log-target' "$LOG_SENTINEL"

# The install mutex must reject concurrent owners without changing adjacent
# data, safely recover an exited owner, and reject malformed/symlink locks.
LOCK_HOME="$TMP/lock-home"
/bin/mkdir -p "$LOCK_HOME/.codex"
/usr/bin/printf '%s\n' 'preserve-me' > "$LOCK_HOME/.codex/payload.txt"
/usr/bin/env HOME="$LOCK_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  acquire_install_lock
  : > "$HOME/.codex/lock-ready"
  /bin/sleep 2
  release_install_lock
' _ "$ROOT" &
LOCK_HOLDER_PID=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ -f "$LOCK_HOME/.codex/lock-ready" ] && break
  /bin/sleep 0.1
done
[ -f "$LOCK_HOME/.codex/lock-ready" ] || { printf 'Install lock holder did not start.\n' >&2; exit 1; }
if /usr/bin/env HOME="$LOCK_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  acquire_install_lock
' _ "$ROOT" >/dev/null 2>&1; then
  printf 'A concurrent installer unexpectedly acquired the active lock.\n' >&2
  exit 1
fi
/usr/bin/grep -F -x -q 'preserve-me' "$LOCK_HOME/.codex/payload.txt"
wait "$LOCK_HOLDER_PID"
/bin/mkdir "$LOCK_HOME/.codex/.qq-agentshow-install.lock"
/usr/bin/printf '%s\n' '999999' > "$LOCK_HOME/.codex/.qq-agentshow-install.lock/owner.pid"
/usr/bin/env HOME="$LOCK_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  acquire_install_lock
  [ "$INSTALL_LOCK_OWNED" = "true" ]
  release_install_lock
  [ ! -e "$INSTALL_LOCK" ]
' _ "$ROOT"
/bin/mkdir "$LOCK_HOME/.codex/.qq-agentshow-install.lock"
/usr/bin/printf '%s\n' 'not-a-pid' > "$LOCK_HOME/.codex/.qq-agentshow-install.lock/owner.pid"
if /usr/bin/env HOME="$LOCK_HOME" /bin/bash -c '. "$1/scripts/common-macos.sh"; acquire_install_lock' \
  _ "$ROOT" >/dev/null 2>&1; then
  printf 'Install lock unexpectedly accepted a malformed owner.\n' >&2
  exit 1
fi
/bin/rm -rf "$LOCK_HOME/.codex/.qq-agentshow-install.lock"
/bin/ln -s "$LOCK_HOME/.codex/payload.txt" "$LOCK_HOME/.codex/.qq-agentshow-install.lock"
if /usr/bin/env HOME="$LOCK_HOME" /bin/bash -c '. "$1/scripts/common-macos.sh"; acquire_install_lock' \
  _ "$ROOT" >/dev/null 2>&1; then
  printf 'Install lock unexpectedly followed a symbolic link.\n' >&2
  exit 1
fi
/usr/bin/grep -F -x -q 'preserve-me' "$LOCK_HOME/.codex/payload.txt"

# An existing destination is replaceable only when it carries the project
# marker or the complete legacy signature. Unrelated files/directories/symlinks
# must be rejected and remain byte-for-byte present.
OWNERSHIP_HOME="$TMP/ownership-home"
/bin/mkdir -p "$OWNERSHIP_HOME/.codex"
/usr/bin/env HOME="$OWNERSHIP_HOME" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  unrelated="$HOME/.codex/unrelated"
  /bin/mkdir "$unrelated"
  /usr/bin/printf "%s\n" keep > "$unrelated/data.txt"
  ! install_root_is_owned "$unrelated"
  /usr/bin/grep -F -x -q keep "$unrelated/data.txt"
  /usr/bin/printf "%s\n" file > "$HOME/.codex/file-root"
  ! install_root_is_owned "$HOME/.codex/file-root"
  /bin/ln -s "$unrelated" "$HOME/.codex/link-root"
  ! install_root_is_owned "$HOME/.codex/link-root"
  marked="$HOME/.codex/marked"
  /bin/mkdir "$marked"
  /bin/cp "$1/.qq-agentshow-install" "$marked/.qq-agentshow-install"
  install_root_is_owned "$marked"
  legacy="$HOME/.codex/legacy"
  /bin/mkdir -p "$legacy/scripts"
  /usr/bin/printf "%s\n" "---" "name: QQ_agentshow" "---" > "$legacy/SKILL.md"
  /usr/bin/printf "%s\n" 2.1.0 > "$legacy/VERSION"
  /usr/bin/printf "%s\n" "{\"name\": \"qq-agentshow\"}" > "$legacy/package.json"
  : > "$legacy/scripts/install-dream-skin-macos.sh"
  install_root_is_owned "$legacy"
' _ "$ROOT"

if [ -f "$ROOT_INSTALLER" ]; then
  # Root installer checksum validation must reject malformed and mismatched
  # digests before extraction.
  ARCHIVE_FIXTURE="$TMP/archive-fixture.zip"
  /usr/bin/printf '%s\n' 'verified archive fixture' > "$ARCHIVE_FIXTURE"
  ARCHIVE_SHA="$(/usr/bin/shasum -a 256 "$ARCHIVE_FIXTURE" | /usr/bin/awk '{print $1}')"
  QQ_AGENTSHOW_INSTALL_LIBRARY_ONLY=true /bin/bash -c '
    . "$1"
    verify_archive "$2" "$3"
    ! verify_archive "$2" "${3%?}g" >/dev/null 2>&1
    mismatch="0${3#?}"
    [ "${3%${3#?}}" != "0" ] || mismatch="1${3#?}"
    ! verify_archive "$2" "$mismatch" >/dev/null 2>&1
  ' _ "$ROOT_INSTALLER" "$ARCHIVE_FIXTURE" "$ARCHIVE_SHA"
  REMOTE_INSTALL_FIXTURE="$TMP/remote-installer"
  /bin/mkdir "$REMOTE_INSTALL_FIXTURE"
  /bin/cp "$ROOT_INSTALLER" "$REMOTE_INSTALL_FIXTURE/install.sh"
  if QQ_AGENTSHOW_REF='v2.1.1evil' /bin/bash "$REMOTE_INSTALL_FIXTURE/install.sh" --check >/dev/null 2>&1; then
    printf 'Root installer unexpectedly accepted a non-semver release ref.\n' >&2
    exit 1
  fi

  # The root readiness check is strictly read-only even when an extracted ZIP
  # loses executable mode bits. The wrapper invokes the installer through bash
  # and must not chmod its source tree before a failed or successful check.
  CHECK_WRAPPER="$TMP/read-only-check-wrapper"
  CHECK_HOME="$TMP/read-only-check-home"
  /bin/mkdir -p "$CHECK_WRAPPER/macos/scripts" "$CHECK_HOME"
  /bin/cp "$ROOT_INSTALLER" "$CHECK_WRAPPER/install.sh"
  /bin/cp "$ROOT/scripts/install-dream-skin-macos.sh" \
    "$CHECK_WRAPPER/macos/scripts/install-dream-skin-macos.sh"
  /bin/cp "$ROOT/scripts/common-macos.sh" "$CHECK_WRAPPER/macos/scripts/common-macos.sh"
  /bin/cp "$ROOT/SKILL.md" "$CHECK_WRAPPER/macos/SKILL.md"
  /bin/chmod 600 "$CHECK_WRAPPER/macos/scripts/install-dream-skin-macos.sh"
  CHECK_SOURCE_HASH="$(/usr/bin/shasum -a 256 "$CHECK_WRAPPER/macos/scripts/install-dream-skin-macos.sh" | /usr/bin/awk '{print $1}')"
  /usr/bin/env HOME="$CHECK_HOME" /bin/bash "$CHECK_WRAPPER/install.sh" --check \
    >/dev/null 2>&1 || true
  [ "$(/usr/bin/stat -f '%Lp' "$CHECK_WRAPPER/macos/scripts/install-dream-skin-macos.sh")" = "600" ]
  [ "$(/usr/bin/shasum -a 256 "$CHECK_WRAPPER/macos/scripts/install-dream-skin-macos.sh" | /usr/bin/awk '{print $1}')" = "$CHECK_SOURCE_HASH" ]
fi

# The optional menu-bar helper never installs SwiftBar/Homebrew software
# unless the user explicitly passes --install-swiftbar.
/usr/bin/grep -F -q 'INSTALL_SWIFTBAR="false"' "$ROOT/scripts/install-menubar-macos.sh"
/usr/bin/grep -F -q -- '--install-swiftbar) INSTALL_SWIFTBAR="true"' "$ROOT/scripts/install-menubar-macos.sh"

"$NODE" "$ROOT/scripts/generate-qq2007-icons.mjs" --out "$TMP/qq2007-icons.png"
/usr/bin/cmp "$ROOT/assets/qq2007-icons.png" "$TMP/qq2007-icons.png"
"$NODE" "$ROOT/scripts/generate-notification-sounds.mjs" --out "$TMP/generated-sounds"
/usr/bin/cmp "$ROOT/assets/sounds/qq-task-complete.wav" "$TMP/generated-sounds/qq-task-complete.wav"
/usr/bin/cmp "$ROOT/assets/sounds/qq-needs-confirmation.wav" "$TMP/generated-sounds/qq-needs-confirmation.wav"

# Standalone staging is an allowlist, not a recursive worktree copy. Ignored
# or unknown local files must not enter an install/release payload.
STAGE_SOURCE="$TMP/stage-source"
STAGE_OUTPUT="$TMP/stage-output"
/bin/mkdir -p "$STAGE_SOURCE/scripts" "$STAGE_SOURCE/assets" "$STAGE_SOURCE/runtime" "$STAGE_SOURCE/.scratch"
/bin/cp "$ROOT/scripts/stage-product-files.sh" "$STAGE_SOURCE/scripts/"
/usr/bin/printf '#!/bin/bash\nexit 0\n' > "$STAGE_SOURCE/scripts/install-dream-skin-macos.sh"
/usr/bin/printf '%s\n' '---' 'name: QQ_agentshow' '---' > "$STAGE_SOURCE/SKILL.md"
: > "$STAGE_SOURCE/assets/allowed.png"
: > "$STAGE_SOURCE/.qq-agentshow-install"
: > "$STAGE_SOURCE/runtime/private-token.txt"
: > "$STAGE_SOURCE/.scratch/private-path.txt"
: > "$STAGE_SOURCE/untracked-secret.txt"
"$ROOT/scripts/stage-product-files.sh" "$STAGE_SOURCE" "$STAGE_OUTPUT"
[ -f "$STAGE_OUTPUT/assets/allowed.png" ]
[ -f "$STAGE_OUTPUT/.qq-agentshow-install" ]
[ ! -e "$STAGE_OUTPUT/runtime" ]
[ ! -e "$STAGE_OUTPUT/.scratch" ]
[ ! -e "$STAGE_OUTPUT/untracked-secret.txt" ]

# The standalone product omits four repository README visuals, while every
# bundled asset must remain provenance-gated and self-verifiable.
STANDALONE_PRODUCT="$TMP/standalone-product"
"$ROOT/scripts/stage-product-files.sh" "$ROOT" "$STANDALONE_PRODUCT"
"$ROOT/scripts/prepare-standalone-docs.sh" "$STANDALONE_PRODUCT"
/usr/bin/cmp "$ROOT/assets/sounds/qq-task-complete.wav" \
  "$STANDALONE_PRODUCT/assets/sounds/qq-task-complete.wav"
/usr/bin/cmp "$ROOT/assets/sounds/qq-needs-confirmation.wav" \
  "$STANDALONE_PRODUCT/assets/sounds/qq-needs-confirmation.wav"
"$NODE" "$STANDALONE_PRODUCT/scripts/injector.mjs" --check-payload >/dev/null
/usr/bin/grep -F -q 'qq-task-complete.wav' "$STANDALONE_PRODUCT/scripts/injector.mjs"
/usr/bin/grep -F -q 'qq-needs-confirmation.wav' "$STANDALONE_PRODUCT/scripts/injector.mjs"
/usr/bin/grep -F -q 'playQqNotification("completion")' \
  "$STANDALONE_PRODUCT/assets/renderer-inject.js"
/usr/bin/grep -F -q 'playQqNotification("confirmation"' \
  "$STANDALONE_PRODUCT/assets/renderer-inject.js"
"$NODE" "$STANDALONE_PRODUCT/scripts/check-asset-provenance.mjs" \
  | /usr/bin/grep -F -q '16 present asset digests match; 4 repository-only documentation assets'

# A verified CDP listener must be bound only to a numeric loopback address;
# a Codex-owned wildcard or LAN listener is still unsafe.
/usr/bin/env HOME="$TMP/listener-home" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  pid_is_codex_descendant() { [ "$1" = "101" ] || [ "$1" = "102" ]; }
  listener_endpoints() { /usr/bin/printf "%s\n" "101|127.0.0.1:$1" "102|[::1]:$1"; }
  port_belongs_to_codex 19345
  listener_endpoints() { /usr/bin/printf "%s\n" "101|*:$1"; }
  ! port_belongs_to_codex 19345
  listener_endpoints() { /usr/bin/printf "%s\n" "101|192.168.1.5:$1"; }
  ! port_belongs_to_codex 19345
  listener_endpoints() { /usr/bin/printf "%s\n" "999|127.0.0.1:$1"; }
  ! port_belongs_to_codex 19345
' _ "$ROOT"

# Standalone archives flatten macos/ to their root. Prompt guides and NOTICE
# must describe that layout and must not claim that Windows assets are bundled.
STANDALONE_ROOT="$TMP/standalone-root"
STANDALONE_DOCS="$TMP/standalone-source-docs"
/bin/mkdir -p "$STANDALONE_ROOT" \
  "$STANDALONE_DOCS/images/gallery" "$STANDALONE_DOCS/images/presets"
/usr/bin/printf '%s\n' \
  'macos/presets/preset-romantic-rose/ macos/assets/portal-hero.png macos/NOTICE.md windows/assets/theme.json' \
  > "$STANDALONE_DOCS/reference-background-prompt-guide.md"
/bin/cp "$STANDALONE_DOCS/reference-background-prompt-guide.md" \
  "$STANDALONE_DOCS/reference-background-prompt-guide.en.md"
/bin/cp "$STANDALONE_DOCS/reference-background-prompt-guide.md" \
  "$STANDALONE_DOCS/background-generation-prompts.md"
: > "$STANDALONE_DOCS/images/gallery/skin-01.jpg"
: > "$STANDALONE_DOCS/images/presets/romantic-rose-source.png"
: > "$STANDALONE_DOCS/images/hero-banner-red-white.png"
/usr/bin/printf '%s\n' \
  '- `presets/preset-romantic-rose/background.jpg`' \
  '- `../windows/assets/dream-reference.jpg`' \
  '- `../docs/images/presets/romantic-rose-source.png`' \
  "They are included at the maintainer's direction as a local theme preset, source archive, and real runtime previews." \
  > "$STANDALONE_ROOT/NOTICE.md"
"$ROOT/scripts/prepare-standalone-docs.sh" "$STANDALONE_ROOT" "$STANDALONE_DOCS"
/usr/bin/grep -F -q 'presets/preset-romantic-rose/' \
  "$STANDALONE_ROOT/docs/reference-background-prompt-guide.md"
/usr/bin/grep -F -q 'assets/portal-hero.png' \
  "$STANDALONE_ROOT/docs/reference-background-prompt-guide.md"
/usr/bin/grep -F -q 'https://github.com/Fei-Away/Codex-Dream-Skin/blob/main/windows/assets/theme.json' \
  "$STANDALONE_ROOT/docs/reference-background-prompt-guide.md"
[ -f "$STANDALONE_ROOT/docs/images/hero-banner-red-white.png" ]
/usr/bin/grep -F -q '`docs/images/presets/romantic-rose-source.png`' \
  "$STANDALONE_ROOT/NOTICE.md"
/usr/bin/grep -F -q 'not included in this macOS archive' \
  "$STANDALONE_ROOT/NOTICE.md"

# A standalone studio can build another archive from its already-rewritten
# docs. Source discovery must stay inside that studio and URL rewriting must
# be idempotent.
STANDALONE_SOURCE="$TMP/standalone-source"
STANDALONE_REPACK="$TMP/standalone-repack"
/bin/mkdir -p "$STANDALONE_SOURCE/scripts" "$STANDALONE_REPACK"
/bin/cp "$ROOT/scripts/prepare-standalone-docs.sh" "$STANDALONE_SOURCE/scripts/"
/bin/cp -R "$STANDALONE_ROOT/docs" "$STANDALONE_SOURCE/docs"
/bin/cp "$STANDALONE_ROOT/NOTICE.md" "$STANDALONE_REPACK/NOTICE.md"
"$STANDALONE_SOURCE/scripts/prepare-standalone-docs.sh" "$STANDALONE_REPACK"
REPACK_GUIDE="$STANDALONE_REPACK/docs/reference-background-prompt-guide.md"
/usr/bin/grep -F -q \
  'https://github.com/Fei-Away/Codex-Dream-Skin/blob/main/windows/assets/theme.json' \
  "$REPACK_GUIDE"
if /usr/bin/grep -E -q 'tree/main/windows/assets|blob/main/https://' "$REPACK_GUIDE"; then
  printf 'Standalone prompt URL rewriting is not idempotent.\n' >&2
  exit 1
fi

# The compact QQ2007 repository ships only its product guide. It must flatten
# repository paths and remain repackable from inside the standalone archive.
COMPACT_SOURCE="$TMP/compact-source"
COMPACT_ROOT="$TMP/compact-root"
COMPACT_REPACK="$TMP/compact-repack"
/bin/mkdir -p "$COMPACT_SOURCE/scripts" "$COMPACT_SOURCE/docs" \
  "$COMPACT_ROOT" "$COMPACT_REPACK"
/bin/cp "$ROOT/scripts/prepare-standalone-docs.sh" "$COMPACT_SOURCE/scripts/"
CODEX_GUIDE_SOURCE="$ROOT/../docs/CODEX-1907.md"
[ -f "$CODEX_GUIDE_SOURCE" ] || CODEX_GUIDE_SOURCE="$ROOT/docs/CODEX-1907.md"
NOTICE_SOURCE="$ROOT/../NOTICE.md"
[ -f "$NOTICE_SOURCE" ] || NOTICE_SOURCE="$ROOT/NOTICE.md"
/bin/cp "$CODEX_GUIDE_SOURCE" "$COMPACT_SOURCE/docs/"
/bin/cp "$ROOT/docs/INSTALLATION.md" "$COMPACT_SOURCE/docs/"
/bin/cp "$NOTICE_SOURCE" "$COMPACT_SOURCE/NOTICE.md"
"$COMPACT_SOURCE/scripts/prepare-standalone-docs.sh" "$COMPACT_ROOT"
/usr/bin/grep -F -q './scripts/install-dream-skin-macos.sh --check' \
  "$COMPACT_ROOT/docs/INSTALLATION.md"
/usr/bin/grep -F -q 'scripts/personalize-codex-2007-macos.sh' \
  "$COMPACT_ROOT/docs/CODEX-1907.md"
if /usr/bin/grep -F -q 'macos/' "$COMPACT_ROOT/docs/CODEX-1907.md"; then
  printf 'Standalone QQ_agentshow guide retains a repository-only macOS prefix.\n' >&2
  exit 1
fi
/usr/bin/grep -F -q 'maintainer-supplied historical QQ-era nostalgia materials' \
  "$COMPACT_ROOT/NOTICE.md"
/usr/bin/grep -F -q '`assets/sounds/sources/`' "$COMPACT_ROOT/NOTICE.md"
/usr/bin/grep -F -q 'are not included in this standalone archive' "$COMPACT_ROOT/NOTICE.md"
/bin/mkdir -p "$COMPACT_ROOT/scripts"
/bin/cp "$ROOT/scripts/prepare-standalone-docs.sh" "$COMPACT_ROOT/scripts/"
"$COMPACT_ROOT/scripts/prepare-standalone-docs.sh" "$COMPACT_REPACK"
/usr/bin/cmp "$COMPACT_ROOT/docs/CODEX-1907.md" "$COMPACT_REPACK/docs/CODEX-1907.md"
/usr/bin/cmp "$COMPACT_ROOT/docs/INSTALLATION.md" "$COMPACT_REPACK/docs/INSTALLATION.md"
/usr/bin/cmp "$COMPACT_ROOT/NOTICE.md" "$COMPACT_REPACK/NOTICE.md"

# SwiftBar attributes are line-based; unsafe engine paths must never be emitted
# into bash= or param*= fields.
UNSAFE_ENGINE="$TMP/unsafe\"engine"
/bin/mkdir -p "$UNSAFE_ENGINE/scripts"
/usr/bin/printf '#!/bin/bash\ntrue\n' > "$UNSAFE_ENGINE/scripts/start-dream-skin-macos.sh"
/bin/chmod +x "$UNSAFE_ENGINE/scripts/start-dream-skin-macos.sh"
UNSAFE_MENU_OUTPUT="$(
  /usr/bin/env CODEX_DREAM_SKIN_ENGINE="$UNSAFE_ENGINE" \
    "$ROOT/menubar/codex_dream_skin.10s.sh"
)"
/usr/bin/printf '%s\n' "$UNSAFE_MENU_OUTPUT" | /usr/bin/grep -F -q \
  'Engine path contains unsupported SwiftBar characters'
if /usr/bin/printf '%s\n' "$UNSAFE_MENU_OUTPUT" | /usr/bin/grep -F -q 'bash='; then
  printf 'SwiftBar emitted command attributes for an unsafe engine path.\n' >&2
  exit 1
fi

MENU_HOME="$TMP/menu-home"
MENU_IMAGES="$MENU_HOME/Library/Application Support/CodexDreamSkinStudio/images"
/bin/mkdir -p "$MENU_IMAGES"
: > "$MENU_IMAGES/safe-image.png"
: > "$MENU_IMAGES/"$'bad\timage.png'
: > "$MENU_IMAGES/"$'bad\033image.png'
MENU_IMAGE_OUTPUT="$(
  /usr/bin/env HOME="$MENU_HOME" CODEX_DREAM_SKIN_ENGINE="$ROOT" \
    "$ROOT/menubar/codex_dream_skin.10s.sh"
)"
/usr/bin/printf '%s\n' "$MENU_IMAGE_OUTPUT" | /usr/bin/grep -F -q 'safe-image.png'
if /usr/bin/printf '%s\n' "$MENU_IMAGE_OUTPUT" | /usr/bin/grep -F -q 'bad'; then
  printf 'SwiftBar emitted a control-character image filename.\n' >&2
  exit 1
fi

# seed_bundled_presets is idempotent, must never touch user custom-* packs, and
# must preserve the user-owned personalizable Codex 2007 preset during updates.
/usr/bin/env HOME="$TMP/seed-home" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  ensure_state_root
  themes="$STATE_ROOT/themes"
  /bin/mkdir -p "$themes/custom-keepme" "$themes/preset-codex-1907-compatible" "$STATE_ROOT/theme"
  /bin/cp -R "$PROJECT_ROOT/presets/preset-codex-1907-deep" "$themes/preset-codex-1907-deep"
  "$NODE" -e '\''const fs=require("fs");const p=process.argv[1];const t=JSON.parse(fs.readFileSync(p));t.profile.nickname="保留的用户";fs.writeFileSync(p,JSON.stringify(t,null,2)+String.fromCharCode(10))'\'' \
    "$themes/preset-codex-1907-deep/theme.json"
  : > "$themes/custom-keepme/theme.json"
  : > "$themes/preset-codex-1907-compatible/theme.json"
  /usr/bin/printf "%s\n" "{\"id\":\"preset-codex-1907-compatible\"}" > "$STATE_ROOT/theme/theme.json"
  seed_bundled_presets
  seed_bundled_presets
  [ -f "$themes/preset-midnight-aurora/theme.json" ] || exit 1
  [ -f "$themes/preset-midnight-aurora/background.jpg" ] || exit 1
  [ -f "$themes/custom-keepme/theme.json" ] || exit 1
  "$NODE" -e '\''const t=JSON.parse(require("fs").readFileSync(process.argv[1]));if(t.profile.nickname!=="保留的用户")process.exit(1)'\'' \
    "$themes/preset-codex-1907-deep/theme.json"
  [ ! -e "$themes/preset-codex-1907-compatible" ] || exit 1
  migrate_removed_presets
  "$NODE" -e '\''const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(t.id!=="preset-codex-1907-deep")process.exit(1)'\'' "$STATE_ROOT/theme/theme.json"
  seeded="$(/usr/bin/find "$themes" -maxdepth 1 -type d -name "preset-*" | /usr/bin/wc -l | /usr/bin/tr -d " ")"
  [ "$seeded" -ge 4 ] || exit 1
' _ "$ROOT"

# Theme switches stage files and publish theme.json last, preserving a complete
# active pack while the watcher is running.
SWITCH_HOME="$TMP/switch-home"
SWITCH_STATE="$SWITCH_HOME/Library/Application Support/CodexDreamSkinStudio"
/bin/mkdir -p "$SWITCH_STATE/themes/preset-switch-fixture" "$SWITCH_STATE/theme"
/bin/cp "$ROOT/assets/portal-hero.png" "$SWITCH_STATE/themes/preset-switch-fixture/background.png"
/usr/bin/printf '%s\n' \
  '{"schemaVersion":1,"id":"preset-switch-fixture","name":"切换测试","image":"background.png"}' \
  > "$SWITCH_STATE/themes/preset-switch-fixture/theme.json"
/usr/bin/printf '%s\n' '{"schemaVersion":1,"id":"old","name":"旧主题","image":"old.png"}' \
  > "$SWITCH_STATE/theme/theme.json"
: > "$SWITCH_STATE/theme/old.png"
if /usr/bin/env HOME="$SWITCH_HOME" NODE="$NODE" \
  "$ROOT/scripts/switch-theme-macos.sh" --id '../escape' --no-apply >/dev/null 2>&1; then
  printf 'switch-theme unexpectedly accepted a path traversal theme id.\n' >&2
  exit 1
fi
/usr/bin/env HOME="$SWITCH_HOME" NODE="$NODE" \
  "$ROOT/scripts/switch-theme-macos.sh" --id preset-switch-fixture --no-apply >/dev/null
/usr/bin/cmp -s "$SWITCH_STATE/theme/background.png" \
  "$SWITCH_STATE/themes/preset-switch-fixture/background.png"
[ ! -e "$SWITCH_STATE/theme/old.png" ]
"$NODE" -e '
  const fs = require("fs");
  const theme = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (theme.id !== "preset-switch-fixture" || theme.name !== "切换测试") process.exit(1);
' "$SWITCH_STATE/theme/theme.json"
[ -z "$(/usr/bin/find "$SWITCH_STATE" -maxdepth 1 -name '.theme-switch.*' -print -quit)" ]

# Codex 2007 personalization updates the single deep preset and its replaceable art.
PERSONAL_HOME="$TMP/personal-home"
PERSONAL_STATE="$PERSONAL_HOME/Library/Application Support/CodexDreamSkinStudio"
PERSONAL_ASSISTANT="$TMP/personal-assistant.png"
/usr/bin/sips -Z 320 "$ROOT/presets/preset-codex-1907-deep/assistant.png" \
  --out "$PERSONAL_ASSISTANT" >/dev/null
/bin/mkdir -p "$PERSONAL_STATE/themes"
/bin/cp -R "$ROOT/presets/preset-codex-1907-deep" "$PERSONAL_STATE/themes/"
/usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/personalize-codex-2007-macos.sh" \
  --nickname '测试用户' \
  --signature '代码有问题？找我。' \
  --level 'LV09' \
  --status busy \
  --assistant "$PERSONAL_ASSISTANT" \
  --qq-show "$ROOT/assets/portal-hero.png" \
  --agent-layout workbench \
  --pet-motion playful \
  --conversation-preview masked \
  --completion-sound off \
  --no-apply >/dev/null
"$NODE" -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const theme = JSON.parse(fs.readFileSync(path.join(process.argv[1], "preset-codex-1907-deep", "theme.json"), "utf8"));
  if (theme.profile.nickname !== "测试用户" || theme.profile.signature !== "代码有问题？找我。" ||
      theme.profile.level !== "LV09" || theme.profile.status !== "busy") process.exit(1);
  if (theme.tagline !== "代码有问题？找我。" || theme.brandSubtitle !== "测试用户 · 忙碌" ||
      theme.statusText !== "测试用户 · 忙碌 · LV09") process.exit(1);
  if (theme.decorations.assistant !== "assistant.png" || theme.decorations.qqShow !== "qq-show.png") process.exit(1);
  if (theme.agentShow.layout !== "workbench" || theme.agentShow.petMotion !== "playful" ||
      theme.agentShow.conversationPreview !== "masked" ||
      theme.agentShow.completionSound !== false) process.exit(1);
' "$PERSONAL_STATE/themes"
/usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/switch-theme-macos.sh" --id preset-codex-1907-deep --no-apply >/dev/null
"$NODE" -e '
  const fs = require("node:fs");
  const theme = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (theme.id !== "preset-codex-1907-deep" || theme.profile.nickname !== "测试用户" ||
      theme.profile.signature !== "代码有问题？找我。" || theme.profile.level !== "LV09" ||
      theme.profile.status !== "busy") process.exit(1);
' "$PERSONAL_STATE/theme/theme.json"
/usr/bin/cmp -s "$PERSONAL_STATE/theme/assistant.png" \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep/assistant.png"
/usr/bin/cmp -s "$PERSONAL_STATE/theme/qq-show.png" \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png"
PERSONAL_STATUS_JSON="$(/usr/bin/env HOME="$PERSONAL_HOME" \
  "$ROOT/scripts/status-dream-skin-macos.sh" --json)"
"$NODE" -e '
  const value = JSON.parse(process.argv[1]);
  if (value.themeMode !== "deep" || value.profileNickname !== "测试用户" ||
      value.profileStatus !== "busy" || value.profileLevel !== "LV09") process.exit(1);
' "$PERSONAL_STATUS_JSON"
/bin/cp "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json" \
  "$PERSONAL_STATE/deep-theme.before"
/bin/cp "$PERSONAL_STATE/themes/preset-codex-1907-deep/assistant.png" \
  "$PERSONAL_STATE/deep-assistant.before"
/bin/mv "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png" \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.original"
/bin/mkdir "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png"
if /usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/personalize-codex-2007-macos.sh" --status offline \
  --assistant "$PERSONAL_ASSISTANT" --qq-show "$ROOT/assets/portal-hero.png" \
  --no-apply >/dev/null 2>&1; then
  printf 'Codex 2007 personalization unexpectedly published over an invalid deep-preset asset.\n' >&2
  exit 1
fi
/usr/bin/cmp -s "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json" \
  "$PERSONAL_STATE/deep-theme.before"
/usr/bin/cmp -s "$PERSONAL_STATE/themes/preset-codex-1907-deep/assistant.png" \
  "$PERSONAL_STATE/deep-assistant.before"
/bin/rmdir "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png"
/bin/mv "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.original" \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png"
/bin/cp "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json" \
  "$PERSONAL_STATE/preset-codex-1907-deep-theme.before"
/bin/cp "$PERSONAL_STATE/themes/preset-codex-1907-deep/assistant.png" \
  "$PERSONAL_STATE/preset-codex-1907-deep-assistant.before"
/bin/cp "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png" \
  "$PERSONAL_STATE/preset-codex-1907-deep-qq-show.before"
ROLLBACK_IMAGE="$ROOT/presets/preset-codex-1907-deep/assistant.png"
if /usr/bin/cmp -s "$ROLLBACK_IMAGE" "$PERSONAL_STATE/preset-codex-1907-deep-assistant.before" ||
   /usr/bin/cmp -s "$ROLLBACK_IMAGE" "$PERSONAL_STATE/preset-codex-1907-deep-qq-show.before"; then
  printf 'Rollback fixture image must differ from the currently personalized assets.\n' >&2
  exit 1
fi
/usr/bin/chflags uchg "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json"
if /usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/personalize-codex-2007-macos.sh" --status offline \
  --assistant "$ROLLBACK_IMAGE" --qq-show "$ROLLBACK_IMAGE" \
  --no-apply >/dev/null 2>&1; then
  /usr/bin/chflags nouchg "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json"
  printf 'Codex 2007 personalization unexpectedly completed with an immutable config.\n' >&2
  exit 1
fi
/usr/bin/chflags nouchg "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json"
/usr/bin/cmp -s "$PERSONAL_STATE/themes/preset-codex-1907-deep/theme.json" \
  "$PERSONAL_STATE/preset-codex-1907-deep-theme.before"
/usr/bin/cmp -s "$PERSONAL_STATE/themes/preset-codex-1907-deep/assistant.png" \
  "$PERSONAL_STATE/preset-codex-1907-deep-assistant.before"
/usr/bin/cmp -s "$PERSONAL_STATE/themes/preset-codex-1907-deep/qq-show.png" \
  "$PERSONAL_STATE/preset-codex-1907-deep-qq-show.before"
"$NODE" "$ROOT/scripts/codex-2007-personalization.mjs" \
  --themes-root "$PERSONAL_STATE/themes" --status online >/dev/null &
PERSONAL_PID_ONE="$!"
"$NODE" "$ROOT/scripts/codex-2007-personalization.mjs" \
  --themes-root "$PERSONAL_STATE/themes" --status busy >/dev/null &
PERSONAL_PID_TWO="$!"
wait "$PERSONAL_PID_ONE"
wait "$PERSONAL_PID_TWO"
"$NODE" -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const profile = JSON.parse(fs.readFileSync(path.join(process.argv[1], "preset-codex-1907-deep", "theme.json"), "utf8")).profile;
  if (!["online", "busy"].includes(profile.status)) process.exit(1);
' "$PERSONAL_STATE/themes"
[ ! -e "$PERSONAL_STATE/themes/.codex-2007-personalization.lock" ]
[ -z "$(/usr/bin/find "$PERSONAL_STATE/themes" -type f \( -name '*.tmp' -o -name '*.rollback-*' \) -print -quit)" ]
/bin/ln -s "$ROOT/assets/portal-hero.png" "$PERSONAL_STATE/linked-assistant.png"
if "$NODE" "$ROOT/scripts/codex-2007-personalization.mjs" \
  --themes-root "$PERSONAL_STATE/themes" --assistant "$PERSONAL_STATE/linked-assistant.png" \
  >/dev/null 2>&1; then
  printf 'Codex 2007 personalization unexpectedly followed a symlinked input image.\n' >&2
  exit 1
fi
if /usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/personalize-codex-2007-macos.sh" --signature '' --no-apply >/dev/null 2>&1; then
  printf 'Codex 2007 personalization unexpectedly accepted an empty signature.\n' >&2
  exit 1
fi
/bin/mv "$PERSONAL_STATE/themes/preset-codex-1907-deep" \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep-real"
/bin/ln -s preset-codex-1907-deep-real \
  "$PERSONAL_STATE/themes/preset-codex-1907-deep"
if /usr/bin/env HOME="$PERSONAL_HOME" NODE="$NODE" \
  "$ROOT/scripts/personalize-codex-2007-macos.sh" --status online --no-apply >/dev/null 2>&1; then
  printf 'Codex 2007 personalization unexpectedly followed a symlinked preset directory.\n' >&2
  exit 1
fi

RUNTIME_HOME="$TMP/runtime-home"
RUNTIME_STATE_ROOT="$RUNTIME_HOME/Library/Application Support/CodexDreamSkinStudio"
RUNTIME_STATE="$RUNTIME_STATE_ROOT/state.json"
UNSIGNED_NODE="$TMP/unsigned-node"
UNSIGNED_MARKER="$TMP/unsigned-node-ran"
TAMPERED_BUNDLE="$TMP/evil-root/Fake Codex.app"
TAMPERED_EXE="$TAMPERED_BUNDLE/Contents/MacOS/FakeCodex"
/bin/mkdir -p "$RUNTIME_STATE_ROOT" "$TAMPERED_BUNDLE/Contents/MacOS"
/usr/bin/printf '#!/bin/bash\ntouch "$1"\n' > "$UNSIGNED_NODE"
/usr/bin/printf '#!/bin/bash\ntrue\n' > "$TAMPERED_EXE"
/bin/chmod +x "$UNSIGNED_NODE" "$TAMPERED_EXE"
"$NODE" -e '
  const fs = require("node:fs");
  const [file, codexBundle, codexExe, codexVersion, codexTeamId] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({ codexBundle, codexExe, codexVersion, codexTeamId })}\n`);
' "$RUNTIME_STATE" "$TAMPERED_BUNDLE" "$TAMPERED_EXE" "999.0.0" "ATTACKERTEAM"
/usr/bin/env HOME="$RUNTIME_HOME" NODE="$UNSIGNED_NODE" \
  CODEX_EXPECTED_TEAM_ID="ATTACKERTEAM" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  ensure_node_runtime
  [ "$NODE" != "$2" ]
  [ "$CODEX_BUNDLE" != "$3" ]
  [ "$CODEX_EXE" != "$4" ]
  [ "$CODEX_TEAM_ID" = "2DC432GLL2" ]
  [ "$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$CODEX_BUNDLE/Contents/Info.plist")" = "com.openai.codex" ]
' _ "$ROOT" "$UNSIGNED_NODE" "$TAMPERED_BUNDLE" "$TAMPERED_EXE"
[ ! -e "$UNSIGNED_MARKER" ] || {
  printf 'An inherited unsigned Node runtime was executed.\n' >&2
  exit 1
}
/usr/bin/grep -F -x -q 'EXPECTED_CODEX_TEAM_ID="2DC432GLL2"' "$ROOT/scripts/common-macos.sh"
if /usr/bin/grep -F -q 'CODEX_EXPECTED_TEAM_ID' "$ROOT/scripts/common-macos.sh"; then
  printf 'Production runtime still exposes a configurable signing-team override.\n' >&2
  exit 1
fi

# A reused live PID must never be killed or treated as a successfully stopped
# injector when its command identity does not match the recorded watcher.
STOP_HOME="$TMP/stop-home"
STOP_STATE_ROOT="$STOP_HOME/Library/Application Support/CodexDreamSkinStudio"
/bin/mkdir -p "$STOP_STATE_ROOT"
"$NODE" -e 'process.on("SIGTERM", () => process.exit(0)); setTimeout(() => {}, 30000);' &
DUMMY_PID="$!"
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid, node, injector] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({
    port: 9341,
    injectorPid: Number(pid),
    injectorStartedAt: "not-the-real-start-time",
    nodePath: node,
    injectorPath: injector,
  })}\n`);
' "$STOP_STATE_ROOT/state.json" "$DUMMY_PID" "$NODE" "$ROOT/scripts/injector.mjs"
/usr/bin/env HOME="$STOP_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR_JOB_LABEL="$3"
  if stop_recorded_injector 2>/dev/null; then exit 1; fi
  /bin/kill -0 "$2"
' _ "$ROOT" "$DUMMY_PID" "$TEST_INJECTOR_JOB_LABEL"

# An incomplete live identity (even with a valid PID and port) must also fail
# closed before any signal is sent.
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({ port: 9341, injectorPid: Number(pid) })}\n`);
' "$STOP_STATE_ROOT/state.json" "$DUMMY_PID"
/usr/bin/env HOME="$STOP_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR_JOB_LABEL="$3"
  if stop_recorded_injector 2>/dev/null; then exit 1; fi
  /bin/kill -0 "$2"
' _ "$ROOT" "$DUMMY_PID" "$TEST_INJECTOR_JOB_LABEL"

# Restore a complete (but still intentionally mismatched) record before
# ending the fixture so the dead-PID cleanup path remains testable.
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid, node, injector] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({
    port: 9341,
    injectorPid: Number(pid),
    injectorStartedAt: "not-the-real-start-time",
    nodePath: node,
    injectorPath: injector,
  })}\n`);
' "$STOP_STATE_ROOT/state.json" "$DUMMY_PID" "$NODE" "$ROOT/scripts/injector.mjs"
/bin/kill -TERM "$DUMMY_PID" 2>/dev/null || true
wait "$DUMMY_PID" 2>/dev/null || true
DUMMY_PID=""

# A genuinely dead recorded PID is safe to discard (and must not block a
# subsequent start/restore operation).
/usr/bin/env HOME="$STOP_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR_JOB_LABEL="$2"
  stop_recorded_injector
' _ "$ROOT" "$TEST_INJECTOR_JOB_LABEL"

# SwiftBar status must not call a live, reused PID "active" merely because
# kill -0 succeeds.  A watcher state needs matching command/path/start data.
STATUS_HOME="$TMP/status-home"
STATUS_STATE_ROOT="$STATUS_HOME/Library/Application Support/CodexDreamSkinStudio"
/bin/mkdir -p "$STATUS_STATE_ROOT"
"$NODE" -e 'process.on("SIGTERM", () => process.exit(0)); setTimeout(() => {}, 30000);' &
STATUS_PID="$!"
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({
    schemaVersion: 4,
    session: "active",
    port: 9341,
    injectorPid: Number(pid),
    injectorStartedAt: "not-the-real-start-time",
    injectorPath: "/tmp/not-the-dream-skin-injector.mjs",
    nodePath: "/tmp/not-the-codex-node",
  })}\n`);
' "$STATUS_STATE_ROOT/state.json" "$STATUS_PID"
STATUS_JSON="$(/usr/bin/env HOME="$STATUS_HOME" "$ROOT/scripts/status-dream-skin-macos.sh" --json)"
"$NODE" -e '
  const value = JSON.parse(process.argv[1]);
  if (value.session !== "stale" || value.injectorAlive !== false) process.exit(1);
' "$STATUS_JSON"
/bin/kill -TERM "$STATUS_PID" 2>/dev/null || true
wait "$STATUS_PID" 2>/dev/null || true
STATUS_PID=""

# A hot re-apply may reuse only the exact current injector build. It must
# refresh state.json with the watcher's real identity, while a version/hash
# mismatch must stop and replace the watcher instead of serving stale assets.
HOT_FAKE_INJECTOR="$TMP/hot-fake-injector.mjs"
/usr/bin/printf 'if (process.argv.includes("--watch")) setTimeout(() => {}, 30000);\n' > "$HOT_FAKE_INJECTOR"
"$NODE" "$HOT_FAKE_INJECTOR" --watch --port 19342 --theme-dir "$TMP" &
HOT_PID="$!"
/bin/sleep 0.08
HOT_RESULT="$TMP/hot-reapply-state.txt"
/usr/bin/env HOME="$STATUS_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR="$2"
  THEME_DIR="$3"
  STATE_PATH="$4"
  HOT_RESULT="$5"
  verified_cdp_endpoint() { return 0; }
  ensure_node_runtime() { return 0; }
  CURRENT_SHA="$(file_sha256 "$INJECTOR")"
  HOT_PID_VALUE="$6"
  HOT_START_VALUE="$(process_started_at "$HOT_PID_VALUE")"
  state_field() {
    case "$1" in
      injectorProtocol) printf "2" ;;
      skinVersion) printf "%s" "$SKIN_VERSION" ;;
      injectorPid) printf "%s" "$HOT_PID_VALUE" ;;
      injectorStartedAt) printf "%s" "$HOT_START_VALUE" ;;
      injectorPath) printf "%s" "$INJECTOR" ;;
      injectorSha256) printf "%s" "$CURRENT_SHA" ;;
      nodePath) printf "%s" "$NODE" ;;
    esac
  }
  codex_main_pids() { printf "4242\n"; }
  write_state() { printf "%s|%s|%s|%s\n" "$1" "$2" "$3" "$4" > "$HOT_RESULT"; }
  hot_reapply_theme 19342 1000
' _ "$ROOT" "$HOT_FAKE_INJECTOR" "$TMP" "$STATUS_STATE_ROOT/state.json" "$HOT_RESULT" "$HOT_PID"
HOT_EXPECTED_START="$(/bin/ps -p "$HOT_PID" -o lstart= 2>/dev/null | /usr/bin/awk '{$1=$1; print}')"
[ "$(/usr/bin/cut -d '|' -f 1 "$HOT_RESULT")" = "19342" ]
[ "$(/usr/bin/cut -d '|' -f 2 "$HOT_RESULT")" = "$HOT_PID" ]
[ "$(/usr/bin/cut -d '|' -f 3 "$HOT_RESULT")" = "$HOT_EXPECTED_START" ]
[ "$(/usr/bin/cut -d '|' -f 4 "$HOT_RESULT")" = "4242" ]
HOT_RESTART_RESULT="$TMP/hot-reapply-restart.txt"
/usr/bin/env HOME="$STATUS_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR="$2"
  THEME_DIR="$3"
  STATE_PATH="$4"
  HOT_RESULT="$5"
  HOT_PID_VALUE="$6"
  verified_cdp_endpoint() { return 0; }
  ensure_node_runtime() { return 0; }
  state_field() {
    case "$1" in
      injectorProtocol) printf "2" ;;
      skinVersion) printf "2.1.0" ;;
      injectorPid) printf "%s" "$HOT_PID_VALUE" ;;
      injectorStartedAt) process_started_at "$HOT_PID_VALUE" ;;
      injectorPath) printf "%s" "$INJECTOR" ;;
      injectorSha256) file_sha256 "$INJECTOR" ;;
      nodePath) printf "%s" "$NODE" ;;
    esac
  }
  stop_recorded_injector() { printf "stopped\n" >> "$HOT_RESULT"; }
  launch_injector_daemon() { printf "launched\n" >> "$HOT_RESULT"; printf "%s\n" "$HOT_PID_VALUE"; }
  codex_main_pids() { printf "4242\n"; }
  write_state() { printf "state=%s|%s|%s|%s\n" "$1" "$2" "$3" "$4" >> "$HOT_RESULT"; }
  hot_reapply_theme 19342 1000
' _ "$ROOT" "$HOT_FAKE_INJECTOR" "$TMP" "$STATUS_STATE_ROOT/state.json" "$HOT_RESTART_RESULT" "$HOT_PID"
/usr/bin/grep -F -x -q 'stopped' "$HOT_RESTART_RESULT"
/usr/bin/grep -F -x -q 'launched' "$HOT_RESTART_RESULT"
/usr/bin/grep -F -q "state=19342|$HOT_PID|" "$HOT_RESTART_RESULT"
/bin/kill -TERM "$HOT_PID" 2>/dev/null || true
wait "$HOT_PID" 2>/dev/null || true
HOT_PID=""

# A near-prefix port (93410) must not satisfy the saved 9341 identity.  Use a
# real bundled Node process so command/path/start checks pass and only the
# token boundary distinguishes this case.
STATUS_FAKE_INJECTOR="$TMP/status-fake-injector.mjs"
/usr/bin/printf 'setTimeout(() => {}, 30000);\n' > "$STATUS_FAKE_INJECTOR"
"$NODE" "$STATUS_FAKE_INJECTOR" --watch --port 93410 --theme-dir "$TMP" &
STATUS_PID="$!"
/bin/sleep 0.08
STATUS_START="$(/bin/ps -p "$STATUS_PID" -o lstart= 2>/dev/null | /usr/bin/awk '{$1=$1; print}')"
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid, node, injector, startedAt] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({
    schemaVersion: 4,
    session: "active",
    port: 9341,
    injectorPid: Number(pid),
    injectorStartedAt: startedAt,
    injectorPath: injector,
    nodePath: node,
  })}\n`);
' "$STATUS_STATE_ROOT/state.json" "$STATUS_PID" "$NODE" "$STATUS_FAKE_INJECTOR" "$STATUS_START"
STATUS_JSON="$(/usr/bin/env HOME="$STATUS_HOME" "$ROOT/scripts/status-dream-skin-macos.sh" --json)"
"$NODE" -e '
  const value = JSON.parse(process.argv[1]);
  if (value.session !== "stale" || value.injectorAlive !== false) process.exit(1);
' "$STATUS_JSON"
/bin/kill -TERM "$STATUS_PID" 2>/dev/null || true
wait "$STATUS_PID" 2>/dev/null || true
STATUS_PID=""

# The common stop path must reject a real watcher running on 19341 when the
# saved state claims 1934, even though nodePath/injectorPath/start-time all
# match. This exercises the signal gate directly (status has its own matcher).
"$NODE" "$ROOT/scripts/injector.mjs" --watch --port 19341 --theme-dir "$ROOT/presets/preset-midnight-aurora" \
  >"$TMP/near-prefix-injector.out" 2>&1 &
WATCH_PID="$!"
/bin/sleep 0.2
WATCH_START="$(/bin/ps -p "$WATCH_PID" -o lstart= 2>/dev/null | /usr/bin/awk '{$1=$1; print}')"
[ -n "$WATCH_START" ] || { printf 'Could not record near-prefix watcher start time.\n' >&2; exit 1; }
"$NODE" -e '
  const fs = require("node:fs");
  const [file, pid, node, injector, startedAt] = process.argv.slice(1);
  fs.writeFileSync(file, `${JSON.stringify({
    schemaVersion: 4,
    session: "active",
    port: 1934,
    injectorPid: Number(pid),
    injectorStartedAt: startedAt,
    injectorPath: injector,
    nodePath: node,
  })}\n`);
' "$STOP_STATE_ROOT/state.json" "$WATCH_PID" "$NODE" "$ROOT/scripts/injector.mjs" "$WATCH_START"
if /usr/bin/env HOME="$STOP_HOME" NODE="$NODE" /bin/bash -c '
  . "$1/scripts/common-macos.sh"
  INJECTOR_JOB_LABEL="$2"
  stop_recorded_injector 2>/dev/null
' _ "$ROOT" "$TEST_INJECTOR_JOB_LABEL"; then
  printf 'common stop unexpectedly accepted a near-prefix watcher port.\n' >&2
  exit 1
fi
/bin/kill -0 "$WATCH_PID"
/bin/kill -TERM "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
WATCH_PID=""

# A failed start must prove the recorded watcher stopped before deleting its
# state; this static guard prevents the old launchctl-short-circuit cleanup.
/usr/bin/grep -F -q 'set -Eeuo pipefail' "$ROOT/scripts/start-dream-skin-macos.sh"
/usr/bin/grep -F -q 'if "$NODE" "$INJECTOR" --verify' \
  "$ROOT/scripts/start-dream-skin-macos.sh"
if /usr/bin/grep -F -q 'set +e' "$ROOT/scripts/start-dream-skin-macos.sh"; then
  printf 'start script still disables errexit around expected verify retries.\n' >&2
  exit 1
fi
/usr/bin/grep -F -q 'if ! stop_recorded_injector; then' \
  "$ROOT/scripts/start-dream-skin-macos.sh"
if /usr/bin/grep -F -q 'launchctl remove "$INJECTOR_JOB_LABEL" >/dev/null 2>&1 || /bin/kill -TERM "$INJECTOR_PID"' \
  "$ROOT/scripts/start-dream-skin-macos.sh"; then
  printf 'start script still deletes state without identity-bound injector cleanup.\n' >&2
  exit 1
fi
if /usr/bin/grep -F -q 'index($0, "--port " port)' "$ROOT/scripts/common-macos.sh"; then
  printf 'injector discovery still accepts a near-prefix port.\n' >&2
  exit 1
fi

# Corrupt or structurally incomplete state must be preserved and fail closed;
# otherwise pause/restore could overwrite evidence while a watcher survives.
for state_payload in '{' '{}'; do
  /usr/bin/printf '%s\n' "$state_payload" > "$STOP_STATE_ROOT/state.json"
  /bin/cp "$STOP_STATE_ROOT/state.json" "$STOP_STATE_ROOT/state.original"
  /usr/bin/env HOME="$STOP_HOME" NODE="$NODE" /bin/bash -c '
    . "$1/scripts/common-macos.sh"
    INJECTOR_JOB_LABEL="$2"
    if stop_recorded_injector 2>/dev/null; then exit 1; fi
  ' _ "$ROOT" "$TEST_INJECTOR_JOB_LABEL"
  /usr/bin/cmp -s "$STOP_STATE_ROOT/state.json" "$STOP_STATE_ROOT/state.original"
done

/bin/mkdir -p "$TMP/theme"
/bin/cp "$ROOT/assets/portal-hero.png" "$TMP/theme/background.png"
"$NODE" "$ROOT/scripts/write-theme.mjs" custom --output-dir "$TMP/theme" \
  --image background.png --name '测试主题' --tagline '测试口号' --quote 'TEST' \
  --accent '#11aa55' --secondary '#22bbcc' --highlight '#663399' >/dev/null
PAYLOAD_JSON="$("$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$TMP/theme")"
"$NODE" -e '
  const theme = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (theme.appearance !== "auto") process.exit(1);
  if (theme.art?.safeArea !== "auto" || theme.art?.taskMode !== "auto") process.exit(1);
  if (Object.hasOwn(theme.art, "focusX") || Object.hasOwn(theme.art, "focusY")) process.exit(1);
' "$TMP/theme/theme.json"
"$NODE" -e '
  const value = JSON.parse(process.argv[1]);
  if (!value.pass || value.themeName !== "测试主题" || value.imageBytes < 1) process.exit(1);
  if (value.artMetadata?.width !== 2168 || value.artMetadata?.height !== 725) process.exit(1);
  if (!value.artMetadata.wide || value.artMetadata.aspect !== "ultrawide") process.exit(1);
  if (!Number.isFinite(value.timings?.buildMs) || value.timings.buildMs < 0) process.exit(1);
' "$PAYLOAD_JSON"

/bin/mkdir -p "$TMP/explicit-theme"
/bin/cp "$ROOT/assets/portal-hero.png" "$TMP/explicit-theme/background.png"
"$NODE" "$ROOT/scripts/write-theme.mjs" custom --output-dir "$TMP/explicit-theme" \
  --image background.png --name '显式自适应主题' --appearance dark \
  --focus-x 0.12 --focus-y 0.88 --safe-area none --task-mode off >/dev/null
EXPLICIT_PAYLOAD_JSON="$(
  "$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$TMP/explicit-theme"
)"
"$NODE" -e '
  const fs = require("fs");
  const theme = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const payload = JSON.parse(process.argv[2]);
  if (theme.appearance !== "dark") process.exit(1);
  if (theme.art?.focusX !== 0.12 || theme.art?.focusY !== 0.88) process.exit(1);
  if (theme.art?.safeArea !== "none" || theme.art?.taskMode !== "off") process.exit(1);
  if (!payload.pass || payload.themeName !== "显式自适应主题") process.exit(1);
' "$TMP/explicit-theme/theme.json" "$EXPLICIT_PAYLOAD_JSON"

assert_write_theme_rejected() {
  local label="$1"
  shift
  if "$NODE" "$ROOT/scripts/write-theme.mjs" custom --output-dir "$TMP/explicit-theme" \
    --image background.png "$@" >/dev/null 2>&1; then
    printf 'write-theme unexpectedly accepted invalid %s.\n' "$label" >&2
    exit 1
  fi
}
assert_write_theme_rejected appearance --appearance sepia
assert_write_theme_rejected safe-area --safe-area edge
assert_write_theme_rejected task-mode --task-mode fullscreen
assert_write_theme_rejected focus-x --focus-x -0.01
assert_write_theme_rejected focus-y --focus-y 1.01
assert_write_theme_rejected name-control --name $'unsafe\nname'
assert_write_theme_rejected tagline-control --tagline $'unsafe\rtagline'
assert_write_theme_rejected quote-control --quote $'unsafe\033quote'
CONTROL_IMAGE=$'unsafe\nimage.jpg'
/bin/cp "$TMP/explicit-theme/background.png" "$TMP/explicit-theme/$CONTROL_IMAGE"
if "$NODE" "$ROOT/scripts/write-theme.mjs" custom --output-dir "$TMP/explicit-theme" \
  --image "$CONTROL_IMAGE" >/dev/null 2>&1; then
  printf 'write-theme unexpectedly accepted a control-character image filename.\n' >&2
  exit 1
fi
/bin/rm -f "$TMP/explicit-theme/$CONTROL_IMAGE"

"$NODE" -e '
  const fs = require("fs");
  const path = require("path");
  const [source, root] = process.argv.slice(1);
  const cases = {
    appearance: (theme) => { theme.appearance = "sepia"; },
    "safe-area": (theme) => { theme.art.safeArea = "edge"; },
    "task-mode": (theme) => { theme.art.taskMode = "fullscreen"; },
    "focus-x": (theme) => { theme.art.focusX = -0.01; },
    "focus-y": (theme) => { theme.art.focusY = 1.01; },
    "name-control": (theme) => { theme.name = "unsafe\nname"; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const target = path.join(root, name);
    fs.cpSync(source, target, { recursive: true });
    const configPath = path.join(target, "theme.json");
    const theme = JSON.parse(fs.readFileSync(configPath, "utf8"));
    mutate(theme);
    fs.writeFileSync(configPath, `${JSON.stringify(theme, null, 2)}\n`);
  }
' "$TMP/explicit-theme" "$TMP/invalid-payloads"
for invalid_case in appearance safe-area task-mode focus-x focus-y name-control; do
  if INVALID_OUTPUT="$(
    "$NODE" "$ROOT/scripts/injector.mjs" --check-payload \
      --theme-dir "$TMP/invalid-payloads/$invalid_case" 2>&1
  )"; then
    printf 'injector unexpectedly accepted invalid %s.\n' "$invalid_case" >&2
    exit 1
  fi
  case "$invalid_case" in
    appearance) EXPECTED_INVALID_FIELD='appearance' ;;
    safe-area) EXPECTED_INVALID_FIELD='art.safeArea' ;;
    task-mode) EXPECTED_INVALID_FIELD='art.taskMode' ;;
    focus-x) EXPECTED_INVALID_FIELD='art.focusX' ;;
    focus-y) EXPECTED_INVALID_FIELD='art.focusY' ;;
    name-control) EXPECTED_INVALID_FIELD='name' ;;
  esac
  /usr/bin/printf '%s\n' "$INVALID_OUTPUT" | /usr/bin/grep -F -q \
    "invalid $EXPECTED_INVALID_FIELD field"
done

/bin/mkdir -p "$TMP/missing-theme"
if MISSING_THEME_OUTPUT="$(
  "$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$TMP/missing-theme" 2>&1
)"; then
  printf 'Explicit theme directory without theme.json unexpectedly passed.\n' >&2
  exit 1
fi
/usr/bin/printf '%s\n' "$MISSING_THEME_OUTPUT" | /usr/bin/grep -F -q \
  "Explicit theme directory is missing theme.json: $TMP/missing-theme/theme.json"

# A theme config or image symlink may resolve only inside its own theme root.
/bin/mkdir -p "$TMP/symlink-outside" "$TMP/symlink-image-theme" "$TMP/symlink-config-theme"
/bin/cp "$ROOT/assets/portal-hero.png" "$TMP/symlink-outside/background.png"
/usr/bin/printf '%s\n' \
  '{"schemaVersion":1,"id":"symlink-image","name":"Symlink image","image":"background.png"}' \
  > "$TMP/symlink-image-theme/theme.json"
/bin/ln -s "$TMP/symlink-outside/background.png" "$TMP/symlink-image-theme/background.png"
if SYMLINK_IMAGE_OUTPUT="$(
  "$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$TMP/symlink-image-theme" 2>&1
)"; then
  printf 'Injector unexpectedly accepted a theme image symlink escaping its theme directory.\n' >&2
  exit 1
fi
/usr/bin/printf '%s\n' "$SYMLINK_IMAGE_OUTPUT" | /usr/bin/grep -F -q \
  'Theme image must stay inside its theme directory'
/usr/bin/printf '%s\n' \
  '{"schemaVersion":1,"id":"symlink-config","name":"Symlink config","image":"background.png"}' \
  > "$TMP/symlink-outside/theme.json"
/bin/ln -s "$TMP/symlink-outside/theme.json" "$TMP/symlink-config-theme/theme.json"
if SYMLINK_CONFIG_OUTPUT="$(
  "$NODE" "$ROOT/scripts/injector.mjs" --check-payload --theme-dir "$TMP/symlink-config-theme" 2>&1
)"; then
  printf 'Injector unexpectedly accepted a theme config symlink escaping its theme directory.\n' >&2
  exit 1
fi
/usr/bin/printf '%s\n' "$SYMLINK_CONFIG_OUTPUT" | /usr/bin/grep -F -q \
  'Theme config must stay inside its theme directory'

# Exercise the dimension limit through the complete payload loader, not only
# through the standalone metadata parser.
OVERSIZED_DIMENSION_THEME="$TMP/oversized-dimension-theme"
/bin/mkdir -p "$OVERSIZED_DIMENSION_THEME"
"$NODE" -e '
  const fs = require("node:fs");
  const file = process.argv[1];
  const value = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(value);
  value.writeUInt32BE(13, 8);
  value.write("IHDR", 12, "ascii");
  value.writeUInt32BE(16385, 16);
  value.writeUInt32BE(1, 20);
  fs.writeFileSync(file, value);
' "$OVERSIZED_DIMENSION_THEME/oversized.png"
/usr/bin/printf '%s\n' \
  '{"schemaVersion":1,"id":"oversized","name":"Oversized","image":"oversized.png"}' \
  > "$OVERSIZED_DIMENSION_THEME/theme.json"
if OVERSIZED_DIMENSION_OUTPUT="$(
  "$NODE" "$ROOT/scripts/injector.mjs" --check-payload \
    --theme-dir "$OVERSIZED_DIMENSION_THEME" 2>&1
)"; then
  printf 'Injector unexpectedly accepted an image over the dimension limit.\n' >&2
  exit 1
fi
/usr/bin/printf '%s\n' "$OVERSIZED_DIMENSION_OUTPUT" | /usr/bin/grep -F -q \
  'invalid or exceeds the 16384px / 50MP safety limit'

# reset-demo may delete only the exact managed theme directory beneath HOME.
RESET_FIXTURE="$TMP/Reset-Project"
/bin/mkdir -p "$RESET_FIXTURE/scripts"
/bin/cp "$ROOT/scripts/write-theme.mjs" "$RESET_FIXTURE/scripts/write-theme.mjs"
: > "$RESET_FIXTURE/keep-me"
/bin/ln -s "$RESET_FIXTURE" "$TMP/reset-project-link"
if "$NODE" "$RESET_FIXTURE/scripts/write-theme.mjs" reset-demo \
  --output-dir "$TMP/reset-project-link" >/dev/null 2>&1; then
  printf 'reset-demo unexpectedly accepted a realpath alias to its project.\n' >&2
  exit 1
fi
[ -f "$RESET_FIXTURE/keep-me" ]
[ -L "$TMP/reset-project-link" ]
RESET_HOME="$TMP/reset-home"
RESET_THEME="$RESET_HOME/Library/Application Support/CodexDreamSkinStudio/theme"
/bin/mkdir -p "$RESET_THEME" "$RESET_HOME/Documents"
: > "$RESET_THEME/theme.json"
: > "$RESET_HOME/Documents/keep-me"
for unsafe in "$RESET_HOME" "$RESET_HOME/Documents" / "$TMP/theme"; do
  if /usr/bin/env HOME="$RESET_HOME" "$NODE" "$ROOT/scripts/write-theme.mjs" reset-demo \
    --output-dir "$unsafe" >/dev/null 2>&1; then
    printf 'reset-demo unexpectedly accepted unsafe broad directory: %s\n' "$unsafe" >&2
    exit 1
  fi
done
[ -f "$RESET_HOME/Documents/keep-me" ]
/usr/bin/env HOME="$RESET_HOME" "$NODE" "$ROOT/scripts/write-theme.mjs" reset-demo \
  --output-dir "$RESET_THEME" >/dev/null
[ ! -e "$RESET_THEME" ]
/bin/mkdir -p "$(/usr/bin/dirname "$RESET_THEME")" "$TMP/reset-symlink-target"
/bin/ln -s "$TMP/reset-symlink-target" "$RESET_THEME"
if /usr/bin/env HOME="$RESET_HOME" "$NODE" "$ROOT/scripts/write-theme.mjs" reset-demo \
  --output-dir "$RESET_THEME" >/dev/null 2>&1; then
  printf 'reset-demo unexpectedly accepted a symbolic-link theme directory.\n' >&2
  exit 1
fi
[ -L "$RESET_THEME" ]

CONFIG="$TMP/config.toml"
BACKUP="$TMP/theme-backup.json"
/usr/bin/printf '%s\n' \
  'model = "gpt-5"' \
  'project = "中文项目"' \
  '' \
  '[desktop]' \
  'appearanceTheme = "system"' \
  'appearanceDarkCodeThemeId = "vscode-dark"' \
  'keepMe = true' > "$CONFIG"
/bin/cp "$CONFIG" "$TMP/original.toml"
"$NODE" "$ROOT/scripts/theme-config.mjs" install "$CONFIG" "$BACKUP" >/dev/null
/usr/bin/cmp -s "$CONFIG" "$TMP/original.toml"
"$NODE" -e '
  const backup = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (backup.values.appearanceTheme !== `appearanceTheme = "system"`) process.exit(1);
  if (backup.values.appearanceDarkCodeThemeId !== `appearanceDarkCodeThemeId = "vscode-dark"`) process.exit(1);
' "$BACKUP"
"$NODE" "$ROOT/scripts/theme-config.mjs" restore "$CONFIG" "$BACKUP" >/dev/null
/usr/bin/cmp -s "$CONFIG" "$TMP/original.toml"

BROKEN_EXISTING_BACKUP="$TMP/theme-backup-broken-existing.json"
/usr/bin/printf '%s\n' '{"broken":true}' > "$BROKEN_EXISTING_BACKUP"
/bin/cp "$CONFIG" "$TMP/config-before-broken-backup.toml"
if "$NODE" "$ROOT/scripts/theme-config.mjs" validate "$CONFIG" "$BROKEN_EXISTING_BACKUP" >/dev/null 2>&1; then
  printf 'theme-config validate unexpectedly accepted a broken existing backup.\n' >&2
  exit 1
fi
if "$NODE" "$ROOT/scripts/theme-config.mjs" install "$CONFIG" "$BROKEN_EXISTING_BACKUP" >/dev/null 2>&1; then
  printf 'theme-config install unexpectedly trusted a broken existing backup.\n' >&2
  exit 1
fi
/usr/bin/cmp -s "$CONFIG" "$TMP/config-before-broken-backup.toml"
[ ! -e "$CONFIG.dream-skin.lock" ]

assert_theme_config_restore_rejected() {
  local label="$1"
  local config="$2"
  local backup="$3"
  /bin/cp "$config" "$config.original"
  if "$NODE" "$ROOT/scripts/theme-config.mjs" restore "$config" "$backup" >/dev/null 2>&1; then
    printf 'theme-config unexpectedly accepted invalid %s backup.\n' "$label" >&2
    exit 1
  fi
  /usr/bin/cmp -s "$config" "$config.original"
  [ -e "$backup" ]
  [ ! -e "$config.dream-skin.lock" ]
}

MALICIOUS_BACKUP_CONFIG="$TMP/config-malicious-backup.toml"
/usr/bin/printf '%s\n' '[desktop]' 'keepMe = true' > "$MALICIOUS_BACKUP_CONFIG"
for backup_case in newline wrong-key unknown-key; do
  MALICIOUS_BACKUP="$TMP/theme-backup-$backup_case.json"
  "$NODE" -e '
    const fs = require("node:fs");
    const [file, configPath, kind] = process.argv.slice(1);
    const values = { appearanceTheme: null, appearanceDarkCodeThemeId: null };
    if (kind === "newline") values.appearanceTheme = `appearanceTheme = "dark"\nmodel = "unsafe"`;
    if (kind === "wrong-key") values.appearanceTheme = `model = "unsafe"`;
    if (kind === "unknown-key") values.unexpected = `unexpected = true`;
    fs.writeFileSync(file, `${JSON.stringify({
      schemaVersion: 1,
      platform: "darwin",
      configPath,
      values,
    }, null, 2)}\n`);
  ' "$MALICIOUS_BACKUP" "$MALICIOUS_BACKUP_CONFIG" "$backup_case"
  assert_theme_config_restore_rejected "$backup_case" \
    "$MALICIOUS_BACKUP_CONFIG" "$MALICIOUS_BACKUP"
  /bin/rm -f "$MALICIOUS_BACKUP"
done

NO_DESKTOP_CONFIG="$TMP/config-without-desktop.toml"
NO_DESKTOP_BACKUP="$TMP/theme-backup-without-desktop.json"
/usr/bin/printf '%s\n' 'model = "gpt-5"' 'keepMe = true' > "$NO_DESKTOP_CONFIG"
/bin/cp "$NO_DESKTOP_CONFIG" "$TMP/original-without-desktop.toml"
"$NODE" "$ROOT/scripts/theme-config.mjs" install "$NO_DESKTOP_CONFIG" "$NO_DESKTOP_BACKUP" >/dev/null
"$NODE" "$ROOT/scripts/theme-config.mjs" restore "$NO_DESKTOP_CONFIG" "$NO_DESKTOP_BACKUP" >/dev/null
/usr/bin/cmp -s "$NO_DESKTOP_CONFIG" "$TMP/original-without-desktop.toml"

INVALID_UTF_CONFIG="$TMP/config-invalid-utf8.toml"
INVALID_UTF_BACKUP="$TMP/config-invalid-utf8-backup.json"
/usr/bin/printf 'model = "gpt-5"\n# invalid: ' > "$INVALID_UTF_CONFIG"
/usr/bin/printf '\377\n' >> "$INVALID_UTF_CONFIG"
/bin/cp "$INVALID_UTF_CONFIG" "$TMP/original-invalid-utf8.toml"
if "$NODE" "$ROOT/scripts/theme-config.mjs" install \
  "$INVALID_UTF_CONFIG" "$INVALID_UTF_BACKUP" >/dev/null 2>&1; then
  printf 'theme-config unexpectedly accepted invalid UTF-8.\n' >&2
  exit 1
fi
/usr/bin/cmp -s "$INVALID_UTF_CONFIG" "$TMP/original-invalid-utf8.toml"
[ ! -e "$INVALID_UTF_BACKUP" ]
[ ! -e "$INVALID_UTF_CONFIG.dream-skin.lock" ]

assert_theme_config_install_rejected() {
  local label="$1"
  local config="$2"
  local backup="$3"
  /bin/cp "$config" "$config.original"
  if "$NODE" "$ROOT/scripts/theme-config.mjs" install "$config" "$backup" >/dev/null 2>&1; then
    printf 'theme-config unexpectedly accepted invalid %s config.\n' "$label" >&2
    exit 1
  fi
  /usr/bin/cmp -s "$config" "$config.original"
  [ ! -e "$backup" ]
  [ ! -e "$config.dream-skin.lock" ]
}

SYMLINK_CONFIG_TARGET="$TMP/config-symlink-target.toml"
SYMLINK_CONFIG_PATH="$TMP/config-symlink.toml"
/usr/bin/printf '%s\n' '[desktop]' 'appearanceTheme = "system"' > "$SYMLINK_CONFIG_TARGET"
/bin/cp "$SYMLINK_CONFIG_TARGET" "$SYMLINK_CONFIG_TARGET.original"
/bin/ln -s "$SYMLINK_CONFIG_TARGET" "$SYMLINK_CONFIG_PATH"
assert_theme_config_install_rejected config-symlink "$SYMLINK_CONFIG_PATH" \
  "$TMP/config-symlink-backup.json"
[ -L "$SYMLINK_CONFIG_PATH" ]
/usr/bin/cmp -s "$SYMLINK_CONFIG_TARGET" "$SYMLINK_CONFIG_TARGET.original"

NUL_CONFIG="$TMP/config-nul.toml"
/usr/bin/printf 'model = "gpt-5"\n\000' > "$NUL_CONFIG"
assert_theme_config_install_rejected nul "$NUL_CONFIG" "$TMP/config-nul-backup.json"

DUPLICATE_DESKTOP_CONFIG="$TMP/config-duplicate-desktop.toml"
/usr/bin/printf '%s\n' '[desktop]' 'keep = 1' '[desktop]' 'keep = 2' \
  > "$DUPLICATE_DESKTOP_CONFIG"
assert_theme_config_install_rejected duplicate-desktop "$DUPLICATE_DESKTOP_CONFIG" \
  "$TMP/config-duplicate-desktop-backup.json"

MULTILINE_CONFIG="$TMP/config-multiline.toml"
/usr/bin/printf '%s\n' 'note = """value' 'continued"""' '[desktop]' 'keep = true' \
  > "$MULTILINE_CONFIG"
assert_theme_config_install_rejected multiline "$MULTILINE_CONFIG" \
  "$TMP/config-multiline-backup.json"

MULTILINE_ARRAY_CONFIG="$TMP/config-multiline-array.toml"
/usr/bin/printf '%s\n' '[desktop]' 'rows = [' '  ["one", "two"],' ']' \
  'appearanceTheme = "system"' > "$MULTILINE_ARRAY_CONFIG"
assert_theme_config_install_rejected multiline-array "$MULTILINE_ARRAY_CONFIG" \
  "$TMP/config-multiline-array-backup.json"

CRLF_CONFIG="$TMP/config-crlf.toml"
CRLF_BACKUP="$TMP/config-crlf-backup.json"
/usr/bin/printf '\357\273\277model = "gpt-5"\r\nproject = "中文项目"\r\n\r\n[desktop]\r\nappearanceTheme = "system"\r\n' \
  > "$CRLF_CONFIG"
/bin/cp "$CRLF_CONFIG" "$TMP/original-crlf.toml"
"$NODE" "$ROOT/scripts/theme-config.mjs" install "$CRLF_CONFIG" "$CRLF_BACKUP" >/dev/null
"$NODE" "$ROOT/scripts/theme-config.mjs" restore "$CRLF_CONFIG" "$CRLF_BACKUP" >/dev/null
/usr/bin/cmp -s "$CRLF_CONFIG" "$TMP/original-crlf.toml"

/usr/bin/env -u HOME /bin/bash -c '. "$1/scripts/common-macos.sh"; [ -n "$HOME" ] && [ "$SKIN_VERSION" = "2.1.1" ]' _ "$ROOT"
"$ROOT/scripts/doctor-macos.sh" >/dev/null

printf 'PASS: syntax, payload, bundled presets, preset seeding, runtime-state safety, custom-theme, config round-trips, HOME recovery, signature, and doctor checks.\n'
