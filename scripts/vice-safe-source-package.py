#!/usr/bin/env python3
"""Portable source ZIP allowlist. Prevents leaking untracked .env/keys or old build output."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from fnmatch import fnmatch
root=Path(__file__).resolve().parents[1]
public=['index.html','guide.html','verify.html','version.json','manifest.json','manifest.webmanifest',
        'sw.js','vice-mega.js','vice-mega.css','_headers','_redirects','netlify.toml',
        'README.md','RELEASE_NOTES_1364.md','CLOUD_MT5_SETUP_136.md','supabase-setup.sql']
dirs=['.github','docs','netlify','scripts','server','supabase','tests']
skip={'node_modules','dist','.git','__pycache__','data','sitecompare','.venv'}
forbidden=['*.env','*.env.*','*.pem','*.key','*.p12','*.pfx','*private*key*','*secrets*json',
           '*service_role*','*auth_token*','*.log','*.sqlite','*.db','*.pyc']
files=[]
for name in public:
  p=root/name
  if p.exists() and p.is_file():files.append(p)
for name in dirs:
  folder=root/name
  if not folder.exists():continue
  for p in folder.rglob('*'):
    if not p.is_file() or any(t in skip for t in p.relative_to(root).parts):continue
    if any(fnmatch(p.name.lower(),pat.lower()) for pat in forbidden):continue
    files.append(p)
files=sorted(set(files))
with ZipFile(root/'dist/VICE_OS_FULL_SOURCE.zip','w',ZIP_DEFLATED,compresslevel=9) as z:
  for p in files:z.write(p,p.relative_to(root).as_posix())
print('Source ZIP:',len(files),'allowed files')
