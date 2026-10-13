#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/VICE_OS_NETLIFY_SITE.zip dist/VICE_OS_FULL_SOURCE.zip
required=(index.html guide.html verify.html manifest.json manifest.webmanifest sw.js _headers _redirects netlify.toml version.json vice-mega.js vice-mega.css)
for f in "${required[@]}"; do
  test -s "$f" || { echo "RELEASE FAIL: required file missing: $f" >&2; exit 1; }
done
node tests/vice-release-safety.cjs
node tests/vice-1367-contracts.cjs
zip -X -q dist/VICE_OS_NETLIFY_SITE.zip "${required[@]}" -r netlify
zip -X -q dist/VICE_OS_FULL_SOURCE.zip "${required[@]}" -r .github docs netlify supabase tests scripts -x '*.pyc' '*/__pycache__/*' '.github/.DS_Store'
sha256sum dist/VICE_OS_NETLIFY_SITE.zip dist/VICE_OS_FULL_SOURCE.zip > dist/SHA256SUMS.txt
echo "Both complete release ZIPs built from the *same* GitHub commit."
cat dist/SHA256SUMS.txt
