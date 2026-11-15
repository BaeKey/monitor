#!/bin/sh
# Usage: scripts/update-theme.sh [branch/tag/commit]; defaults to HEX main.
set -eu
cd "$(dirname "$0")/.."
REPO=BaeKey/monitor-theme-hex
REF=${1:-main}
REV=$(git ls-remote "https://github.com/$REPO.git" "$REF" "refs/heads/$REF" "refs/tags/$REF^{}" | tail -n 1 | cut -f1)
if [ -z "$REV" ] && [ "${#REF}" -eq 40 ]; then REV=$REF; fi
[ "${#REV}" -eq 40 ] || { echo "cannot resolve HEX ref: $REF" >&2; exit 1; }
case "$REV" in *[!0-9a-f]*) echo "invalid HEX commit" >&2; exit 1 ;; esac
mkdir -p target
ARCHIVE=$(mktemp "$(pwd)/target/theme-source.XXXXXX")
trap 'rm -f "$ARCHIVE"' EXIT HUP INT TERM
curl -fsSL --retry 3 -o "$ARCHIVE" "https://codeload.github.com/$REPO/tar.gz/$REV"
SHA=$(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)
printf '%s %s %s\n' "$REPO" "$REV" "$SHA" >web-theme.pin
echo "Pinned HEX to $REV. Run scripts/theme.sh to build and verify it."
