#!/bin/bash

set -euo pipefail

REPOSITORY="tangyihang-jiayou/QQ_agentshow"
DEFAULT_REF="v2.1.1"
DEFAULT_SHA256="61101432becfbbf76fa2c43e0e8eb2c6693cdfbe4aa82841e05e1e550272ad54"
REF="${QQ_AGENTSHOW_REF:-$DEFAULT_REF}"
CHECK_ONLY="false"
NO_LAUNCH="false"
NO_LAUNCHERS="false"
SOURCE_ROOT="$(cd "$(dirname "$0")" 2>/dev/null && pwd -P || true)"
DOWNLOAD_ROOT=""

cleanup() {
  if [ -n "$DOWNLOAD_ROOT" ] && [ -d "$DOWNLOAD_ROOT" ]; then
    case "$DOWNLOAD_ROOT" in
      "${TMPDIR:-/tmp}"/*|/private/tmp/*|/tmp/*) /bin/rm -rf "$DOWNLOAD_ROOT" ;;
    esac
  fi
}
trap cleanup EXIT

verify_archive() {
  local archive_path="$1"
  local expected="$2"
  local actual=""
  case "$expected" in
    ''|*[!0-9a-fA-F]*) printf 'QQ_agentshow: expected SHA-256 is invalid.\n' >&2; return 1 ;;
  esac
  [ "${#expected}" -eq 64 ] || { printf 'QQ_agentshow: expected SHA-256 must contain 64 hex digits.\n' >&2; return 1; }
  actual="$(/usr/bin/shasum -a 256 "$archive_path" | /usr/bin/awk '{print $1}')"
  [ "$(printf '%s' "$actual" | /usr/bin/tr '[:upper:]' '[:lower:]')" = \
    "$(printf '%s' "$expected" | /usr/bin/tr '[:upper:]' '[:lower:]')" ] || {
    printf 'QQ_agentshow: release archive SHA-256 mismatch; nothing was extracted or installed.\n' >&2
    return 1
  }
}

if [ "${QQ_AGENTSHOW_INSTALL_LIBRARY_ONLY:-false}" = "true" ]; then
  return 0 2>/dev/null || exit 0
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY="true"; shift ;;
    --no-launch) NO_LAUNCH="true"; shift ;;
    --no-launchers) NO_LAUNCHERS="true"; shift ;;
    --help|-h)
      printf 'Usage: ./install.sh [--check] [--no-launch] [--no-launchers]\n'
      exit 0
      ;;
    *) printf 'QQ_agentshow: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ "$(/usr/bin/uname -s)" != "Darwin" ]; then
  printf 'QQ_agentshow currently supports macOS only.\n' >&2
  exit 1
fi

if [ ! -f "$SOURCE_ROOT/macos/scripts/install-dream-skin-macos.sh" ]; then
  command -v curl >/dev/null 2>&1 || { printf 'curl is required.\n' >&2; exit 1; }
  if [[ ! "$REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    printf 'QQ_agentshow: only immutable vX.Y.Z release tags are accepted.\n' >&2
    exit 1
  fi
  if [ "$REF" = "$DEFAULT_REF" ]; then
    expected_sha256="$DEFAULT_SHA256"
  else
    expected_sha256="${QQ_AGENTSHOW_SHA256:-}"
    [ -n "$expected_sha256" ] || {
      printf 'QQ_agentshow: QQ_AGENTSHOW_SHA256 is required when overriding QQ_AGENTSHOW_REF.\n' >&2
      exit 1
    }
  fi
  DOWNLOAD_ROOT="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/qq-agentshow.XXXXXX")"
  archive="$DOWNLOAD_ROOT/QQ_agentshow-macos-${REF}.zip"
  archive_url="https://github.com/${REPOSITORY}/releases/download/${REF}/QQ_agentshow-macos-${REF}.zip"
  /usr/bin/curl --fail --silent --show-error --location "$archive_url" --output "$archive"
  verify_archive "$archive" "$expected_sha256"
  /usr/bin/ditto -x -k "$archive" "$DOWNLOAD_ROOT/extracted"
  installer_path="$(/usr/bin/find "$DOWNLOAD_ROOT/extracted" -type f -path '*/scripts/install-dream-skin-macos.sh' -print | /usr/bin/awk 'NR == 1 { value = $0 } END { print value }')"
  [ -n "$installer_path" ] || { printf 'QQ_agentshow: verified release is missing its macOS installer.\n' >&2; exit 1; }
  SOURCE_ROOT="$(cd "$(/usr/bin/dirname "$installer_path")/.." && pwd -P)"
fi

[ -f "$SOURCE_ROOT/SKILL.md" ] || { printf 'QQ_agentshow Skill entry is missing.\n' >&2; exit 1; }
if [ -f "$SOURCE_ROOT/macos/scripts/install-dream-skin-macos.sh" ]; then
  PRODUCT_ROOT="$SOURCE_ROOT/macos"
else
  PRODUCT_ROOT="$SOURCE_ROOT"
fi
[ -f "$PRODUCT_ROOT/scripts/install-dream-skin-macos.sh" ] || { printf 'QQ_agentshow macOS engine is missing.\n' >&2; exit 1; }

if [ "$CHECK_ONLY" = "true" ]; then
  [ ! -f "$SOURCE_ROOT/install.sh" ] || /bin/bash -n "$SOURCE_ROOT/install.sh"
  /bin/bash -n "$PRODUCT_ROOT/scripts/install-dream-skin-macos.sh"
  check_args=(--check)
  [ "$NO_LAUNCHERS" = "true" ] && check_args+=(--no-launchers)
  /bin/bash "$PRODUCT_ROOT/scripts/install-dream-skin-macos.sh" "${check_args[@]}"
  exit 0
fi

installer_args=(--no-launch)
[ "$NO_LAUNCHERS" = "true" ] && installer_args+=(--no-launchers)
/bin/bash "$PRODUCT_ROOT/scripts/install-dream-skin-macos.sh" "${installer_args[@]}"
engine="$HOME/.codex/codex-dream-skin-studio"

if [ "$NO_LAUNCH" = "true" ]; then
  printf 'QQ_agentshow installed. Start it with ~/.codex/codex-dream-skin-studio/scripts/start-dream-skin-macos.sh --prompt-restart\n'
else
  "$engine/scripts/start-dream-skin-macos.sh" --prompt-restart
fi
