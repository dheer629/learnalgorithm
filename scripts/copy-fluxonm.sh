#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tools/FLUXONM"
mkdir -p "$TARGET_DIR"

if ! command -v FLUXONM >/dev/null 2>&1; then
  echo "FLUXONM was not found in PATH. Nothing was copied."
  exit 0
fi

SOURCE="$(command -v FLUXONM)"
if command -v readlink >/dev/null 2>&1; then
  SOURCE="$(readlink -f "$SOURCE" 2>/dev/null || echo "$SOURCE")"
fi

echo "Copying FLUXONM from $SOURCE to $TARGET_DIR/FLUXONM"
cp "$SOURCE" "$TARGET_DIR/FLUXONM"
chmod +x "$TARGET_DIR/FLUXONM" || true

cat >"$TARGET_DIR/README.md" <<INFO
# FLUXONM Local Copy

Discovered source:

\`\`\`text
$SOURCE
\`\`\`

Refresh this copy with:

\`\`\`bash
./scripts/copy-fluxonm.sh
\`\`\`

The original utility was not modified.
INFO

echo "FLUXONM copied successfully."
