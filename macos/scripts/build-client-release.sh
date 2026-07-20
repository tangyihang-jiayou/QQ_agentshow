#!/bin/bash

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
VERSION="$(/usr/bin/tr -d '[:space:]' < "$ROOT/VERSION")"
NODE_BIN="${NODE:-$(command -v node 2>/dev/null || true)}"
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] \
  || { printf 'Node.js is required to build a client release.\n' >&2; exit 1; }
OUTPUT="${1:-$HOME/Desktop/QQ_agentshow 安装包.zip}"
TMP="$(/usr/bin/mktemp -d /tmp/qq-agentshow-client.XXXXXX)"
CLIENT_ROOT="$TMP/QQ_agentshow 安装包"
ENGINE="$CLIENT_ROOT/.codex-dream-skin-studio"
trap '/bin/rm -rf "$TMP"' EXIT

"$ROOT/tests/run-tests.sh"
"$ROOT/scripts/stage-product-files.sh" "$ROOT" "$ENGINE"

# Keep the customer ZIP self-contained: bundle prompt docs and referenced
# images, then translate repository paths for the hidden standalone engine.
"$ROOT/scripts/prepare-standalone-docs.sh" "$ENGINE"
STANDALONE_README="$ENGINE/README.md"
if [ -f "$STANDALONE_README" ]; then
  temporary="${STANDALONE_README}.standalone"
  /usr/bin/sed \
    -e 's#\.\./docs/#docs/#g' \
    -e 's#\.\./windows/#https://github.com/Fei-Away/Codex-Dream-Skin/tree/main/windows/#g' \
    "$STANDALONE_README" > "$temporary"
  /bin/mv "$temporary" "$STANDALONE_README"
fi
PRESET_README="$ENGINE/presets/README.md"
if [ -f "$PRESET_README" ]; then
  temporary="${PRESET_README}.standalone"
  /usr/bin/sed -e 's#\.\./\.\./docs/#../docs/#g' "$PRESET_README" > "$temporary"
  /bin/mv "$temporary" "$PRESET_README"
fi

/usr/bin/printf '%s\n' \
  '#!/bin/bash' \
  'set -euo pipefail' \
  'ROOT="$(cd "$(dirname "$0")" && pwd -P)"' \
  'exec "$ROOT/.codex-dream-skin-studio/scripts/install-dream-skin-macos.sh"' \
  > "$CLIENT_ROOT/安装 QQ_agentshow.command"

/usr/bin/printf '%s\n' \
  "QQ_agentshow $VERSION" \
  '' \
  '推荐方式：把这个完整 ZIP、你喜欢的图片和“给 Codex 的部署提示词.md”一起发给自己的 Codex。' \
  '' \
  '手动方式：双击“安装 QQ_agentshow.command”。安装完成后，桌面会出现启动、定制、验证和恢复四个入口。' \
  '' \
  '不要只复制图片或 CSS。隐藏目录 .codex-dream-skin-studio 是完整运行引擎，请勿删除。' \
  > "$CLIENT_ROOT/使用说明.txt"

/bin/cp "$ROOT/CLIENT_DEPLOY_PROMPT.md" "$CLIENT_ROOT/给 Codex 的部署提示词.md"
/bin/chmod 755 "$CLIENT_ROOT/安装 QQ_agentshow.command"
/bin/chmod 755 "$ENGINE"/*.command "$ENGINE"/scripts/*.sh "$ENGINE"/tests/*.sh
/usr/bin/xattr -cr "$CLIENT_ROOT"
/usr/bin/find "$CLIENT_ROOT" -type f \( -name '.DS_Store' -o -name '._*' \) -delete
"$NODE_BIN" "$ROOT/scripts/check-public-privacy.mjs" --root "$CLIENT_ROOT" >/dev/null
/bin/mkdir -p "$(dirname "$OUTPUT")"
/bin/rm -f "$OUTPUT"
COPYFILE_DISABLE=1 /usr/bin/ditto -c -k --keepParent --norsrc --noextattr "$CLIENT_ROOT" "$OUTPUT"
SHA256="$(/usr/bin/shasum -a 256 "$OUTPUT" | /usr/bin/awk '{print $1}')"
/usr/bin/printf 'Created %s\nSHA-256 %s\n' "$OUTPUT" "$SHA256"
