#!/bin/bash

set -euo pipefail

restore="$HOME/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh"
if [ ! -x "$restore" ]; then
  printf 'QQ_agentshow is not installed at the expected location.\n' >&2
  exit 1
fi
exec "$restore" --restore-base-theme --restart-codex
