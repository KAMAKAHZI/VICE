#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Public deployment must contain only explicit client-safe assets. Neither
# SQL migrations, service role keys, archived bootstraps nor Github internals
# belong under the Netlify web root.
target="dist/site"
rm -rf "$target"
mkdir -p "$target"
assets=(
  index.html guide.html verify.html governance.html version.json
  vice4x-icon.svg vice4x-icon-192.png vice4x-icon-512.png apple-touch-icon.png
  manifest.json manifest.webmanifest sw.js vice-mega.js vice-mega.css vice4x-operations.js vice4x-operations.css vice-solace-system.js vice4x-comms.js vice4x-comms.css vice4x-institutional-core.js vice4x-institutional.js vice4x-institutional.css
  _headers _redirects
)
for f in "${assets[@]}"; do
  test -s "$f" || { echo "Missing required public asset: $f" >&2; exit 1; }
  cp "$f" "$target/$f"
done
# The legacy source embeds only the public anon identifier; make its published
# governance display count CEO/CFO authenticator and device approvals equally.
# Keep the transformation narrowly scoped to dist/site and fail closed on drift.
node scripts/vice-governance-publish.cjs
node scripts/vice-deployment-identity.cjs
find "$target" -mindepth 1 -maxdepth 1 -type f -printf '%f\n' | sort
echo "Netlify publishes whitelisted dist/site only."
