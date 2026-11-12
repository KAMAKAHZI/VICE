#!/usr/bin/env python3
"""Fail a VICE OS publish when sensitive credentials or server-only files leak."""
from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "dist/site")
if not ROOT.is_dir():
    raise SystemExit(f"Missing publish directory: {ROOT}")
patterns = {
    "Supabase service-role assignment": re.compile(rb'(?i)(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*["\x27][^"\x27\s]{16,}'),
    "PEM private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(rb"gh[pousr]_[A-Za-z0-9_]{30,}"),
    "AWS access key": re.compile(rb"AKIA[0-9A-Z]{16}"),
}
server_extensions = {".sql", ".pem", ".key", ".p12", ".pfx", ".sqlite", ".db", ".map"}
bad = []
for p in ROOT.rglob("*"):
    if not p.is_file():
        continue
    relative = p.relative_to(ROOT)
    if p.suffix.lower() in server_extensions or p.name.startswith(".env"):
        bad.append((str(relative), "forbidden public artifact"))
        continue
    if p.stat().st_size > 10_000_000:
        bad.append((str(relative), "unexpected oversized asset"))
        continue
    data = p.read_bytes()
    for name, regex in patterns.items():
        if regex.search(data):
            bad.append((str(relative), name))
if bad:
    for path, reason in bad:
        print(f"BLOCK: {path}: {reason}", file=sys.stderr)
    raise SystemExit(1)
print(f"PASS: checked public artifact directory {ROOT} for restricted files and credential patterns")
