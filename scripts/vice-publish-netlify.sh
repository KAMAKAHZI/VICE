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
  vice-ouv-final-deploy.js
  _headers _redirects
)
for f in "${assets[@]}"; do
  test -s "$f" || { echo "Missing required public asset: $f" >&2; exit 1; }
  cp "$f" "$target/$f"
done
python3 - <<'PY'
from pathlib import Path
p=Path('dist/site/index.html')
s=p.read_text()
# Inject only at the actual final document body close. JavaScript templates
# also contain literal </body> strings; global replacement corrupts them and
# terminates the main script early with a spurious </script> tag.
close=s.rfind('</body>')
if close<0:
    raise SystemExit('Missing closing </body> in index.html')
s=s[:close]+'<script defer src="/vice-ouv-final-deploy.js"></script>\\n'+s[close:]
# Both MODEL_ONLY and AUTO_ACTIVE are truthful issuer policy states. The
# signed-in member snapshot must not disappear when automation is activated.
s=s.replace("c.data=!error&&data?.policy_status==='MODEL_ONLY'?data:null;", "c.data=!error&&['MODEL_ONLY','AUTO_ACTIVE'].includes(data?.policy_status)?data:null;")
p.write_text(s)
PY
node scripts/vice-deployment-identity.cjs
find "$target" -mindepth 1 -maxdepth 1 -type f -printf '%f\n' | sort
echo "Netlify publishes whitelisted dist/site only."
