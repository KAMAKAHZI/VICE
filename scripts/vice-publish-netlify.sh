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
  index.html guide.html verify.html version.json
  manifest.json manifest.webmanifest sw.js vice-mega.js vice-mega.css
  _headers _redirects
)
for f in "${assets[@]}"; do
  test -s "$f" || { echo "Missing required public asset: $f" >&2; exit 1; }
  cp "$f" "$target/$f"
done
find "$target" -mindepth 1 -maxdepth 1 -type f -printf '%f\n' | sort
echo "Netlify publishes whitelisted dist/site only."
