#!/bin/sh
# Publish the page, but only if it passes both sets of checks.
#
#   ./tools/publish.sh "Added the Nov 12 field trip"
#
# Refuses to push if anything fails, because a broken index.html means a blank
# page for every family until someone notices.

set -e
cd "$(dirname "$0")/.."

MSG="${1:-Update the Pre-K hub}"

echo "==> dropping anything already past"
python3 -I tools/prune_past.py

echo "==> fast checks"
node tools/verify.js

echo "==> full checks in a browser"
node tools/audit.js

if git diff --quiet && git diff --cached --quiet; then
  echo "==> nothing changed, nothing to publish"
  exit 0
fi

echo "==> publishing"
git add -A
git commit -m "$MSG"
git push

echo
echo "Done. GitHub Pages usually redeploys within a minute or two:"
echo "https://marysuefindlater-commits.github.io/bolton-prek-parent-made/"
