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
node tests/vice-1369-integrity.cjs && node tests/vice-1378-audit-turn.cjs && node tests/vice-1379-membership-signature.cjs && node tests/vice-token-certificates.cjs
# The manual Netlify Drop ZIP contains only public files. Cloud functions
# require the separately configured GitHub/CLI production workflow.
bash scripts/vice-publish-netlify.sh
node tests/vice-deploy-privacy.cjs
(cd dist/site && zip -X -q ../VICE_OS_NETLIFY_SITE.zip ./*)
# Preserve every tracked frontend, backend, documentation, test, release and
# security file, including superseded-reference safeguards and hidden workflows.
git archive --format=zip --output=dist/VICE_OS_FULL_SOURCE.zip HEAD
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
unzip -q dist/VICE_OS_FULL_SOURCE.zip -d "$work"
(cd "$work" && node tests/vice-release-safety.cjs && node tests/vice-1367-contracts.cjs && node tests/vice-1369-integrity.cjs && node tests/vice-1378-audit-turn.cjs && node tests/vice-1379-membership-signature.cjs && node tests/vice-token-certificates.cjs)
sha256sum dist/VICE_OS_NETLIFY_SITE.zip dist/VICE_OS_FULL_SOURCE.zip > dist/SHA256SUMS.txt
echo "Both ZIPs built from the same GitHub commit: $(git rev-parse --verify HEAD)"
cat dist/SHA256SUMS.txt
