#!/bin/sh
# Build the default theme from our independently maintained HEX repository.
# Pin source bytes, not a moving branch, so a hub commit is reproducible.
set -eu
cd "$(dirname "$0")/.."
read -r REPO REV SHA EXTRA <web-theme.pin || true
[ "$REPO" = "BaeKey/monitor-theme-hex" ] && [ "${#REV}" -eq 40 ] && [ "${#SHA}" -eq 64 ] && [ -z "${EXTRA:-}" ] ||
  { echo "web-theme.pin must hold 'BaeKey/monitor-theme-hex <commit> <source-sha256>'" >&2; exit 1; }
case "$REV$SHA" in *[!0-9a-f]*) echo "invalid theme pin" >&2; exit 1 ;; esac
DEST=target/theme
PIN="$REPO $REV $SHA"
if [ -f "$DEST/.pin" ] && [ "$(cat "$DEST/.pin")" = "$PIN" ] &&
   [ -f "$DEST/dist/index.html" ] && [ -f "$DEST/theme.json" ]; then
  exit 0
fi
mkdir -p target
WORK=$(mktemp -d "$(pwd)/target/theme-build.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
curl -fsSL --retry 3 -o "$WORK/source.tar.gz" "https://codeload.github.com/$REPO/tar.gz/$REV"
GOT=$(shasum -a 256 "$WORK/source.tar.gz" | cut -d' ' -f1)
[ "$GOT" = "$SHA" ] || { echo "theme source checksum mismatch: $GOT, expected $SHA" >&2; exit 1; }
mkdir "$WORK/source"
tar xzf "$WORK/source.tar.gz" --strip-components=1 -C "$WORK/source"
(cd "$WORK/source" && npm ci --no-audit --no-fund && npm run build)
[ -f "$WORK/source/dist/index.html" ] && [ -f "$WORK/source/theme.json" ] ||
  { echo "theme build has no dist/index.html or theme.json" >&2; exit 1; }
mkdir "$WORK/theme"
cp -R "$WORK/source/dist" "$WORK/source/theme.json" "$WORK/theme/"
# Preserve HEX's identity: its client reads /api/themes/hex/config. The hub
# derives its built-in short name from this manifest instead of renaming it.
node -e 'const fs = require("node:fs"); const p = process.argv[1]; const t = JSON.parse(fs.readFileSync(p)); if(t.short !== "hex") throw Error("expected HEX manifest"); t.url = "https://github.com/BaeKey/monitor-theme-hex"; fs.writeFileSync(p, JSON.stringify(t, null, 2) + "\n")' "$WORK/theme/theme.json"
for FILE in preview.png LICENSE LICENSE.komari-next LICENSE.three NOTICE.md; do
  if [ -f "$WORK/source/$FILE" ]; then cp "$WORK/source/$FILE" "$WORK/theme/"; fi
done
printf '%s\n' "$PIN" >"$WORK/theme/.pin"
rm -rf "$DEST"
mv "$WORK/theme" "$DEST"
echo "default HEX theme $REV built into $DEST"
