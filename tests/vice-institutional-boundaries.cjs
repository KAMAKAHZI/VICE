'use strict';
/**
 * VICE OS release-boundary regression tests.
 * Static contract checks only: never confuse these with browser, financial,
 * cryptographic WebAuthn, or production-deployment acceptance.
 * Run: node tests/vice-institutional-boundaries.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const publish=read('scripts/vice-publish-netlify.sh');
const headers=read('_headers');
const version=JSON.parse(read('version.json'));
const html=read('index.html');
const passkeyPath='supabase/functions/vice-passkey/index.ts';
const passkey=fs.existsSync(path.join(root,passkeyPath))?read(passkeyPath):null;
const errors=[];
function check(name,fn){try{fn();console.log('PASS',name)}catch(e){errors.push(name+': '+e.message);console.error('FAIL',name,e.message)}}
check('publish uses explicit asset allowlist and isolated webroot',()=>{
  assert.match(publish,/target="dist\/site"/);
  assert.match(publish,/assets=\(/);
  assert.match(publish,/cp "\$f" "\$target\/\$f"/);
  assert.doesNotMatch(publish,/cp\s+-[a-zA-Z]*[rR]/);
});
const block=publish.match(/assets=\(([\s\S]*?)\)/);
check('publish allowlist has no privileged artifacts',()=>{
  assert(block,'missing assets allowlist');
  const assets=block[1].trim().split(/\s+/);
  assert(assets.includes('index.html')&&assets.includes('version.json'));
  assert.equal(new Set(assets).size,assets.length,'duplicate published asset');
  for(const f of assets){
    assert(!f.startsWith('.')&&!f.includes('..')&&!f.includes('/'),'nested/hidden asset '+f);
    assert(!/\.(?:sql|env|ts|map|pem|key|jsonl)$/i.test(f)||f==='version.json','privileged extension '+f);
    assert(fs.statSync(path.join(root,f)).isFile(),'missing public asset '+f);
  }
});
check('deployment identity is consistent',()=>{
  assert.equal(html.match(/data-build="([^"]+)"/)?.[1],version.version);
  assert.match(publish,/node scripts\/vice-deployment-identity\.cjs/);
});
check('baseline security headers exist',()=>{
  for(const h of ['X-Content-Type-Options: nosniff','X-Frame-Options: DENY','Strict-Transport-Security:','Referrer-Policy:'])assert(headers.includes(h),'missing '+h);
});
if(passkey===null)console.log('SKIP passkey source not committed to repository; deployed Edge Function must be separately audited');
else check('passkey route is fail-closed until verifier is installed',()=>{
  assert.match(passkey,/auth\.getUser\(/);
  assert.match(passkey,/passkeyRegistration:false/);
  assert.match(passkey,/passkeyAuthentication:false/);
  assert.match(passkey,/transactionAuthorization:false/);
  assert.match(passkey,/WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
  assert.match(passkey,/return reply\(501,/);
});
check('every GitHub Actions workflow uses immutable action and reusable-workflow pins',()=>{
  const workflowDir=path.join(root,'.github/workflows');
  const paths=fs.readdirSync(workflowDir).filter(file=>/\.ya?ml$/.test(file));
  assert(paths.length>=8,'Expected to scan the complete VICE workflow set');
  for(const file of paths){
    const yaml=fs.readFileSync(path.join(workflowDir,file),'utf8');
    const uses=[...yaml.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)].map(m=>m[1]);
    assert(uses.length>0,'No job action references found in '+file);
    for(const action of uses)assert.match(action,/^[\w.-]+\/[\w.-]+(?:\/\.github\/workflows\/[\w.-]+\.ya?ml)?@[a-f0-9]{40}$/,'Mutable or unpinned action in '+file+': '+action);
  }
  const acceptance=read('.github/workflows/vice-repair-acceptance.yml');
  assert.match(acceptance,/npm install --ignore-scripts --no-save/,'Untrusted npm lifecycle scripts must not execute in acceptance CI');
  assert.match(read('.github/workflows/vice-os-release-guard.yml'),/['"]\.github\/workflows\/\*\*['"]/,'Release guard must rerun for changes to ANY workflow');
});
check('release metadata does not claim certified production',()=>{
  assert.notEqual(version.release_acceptance?.financial_operations_certified,true);
  assert.notEqual(version.release_acceptance?.live_login_tested,true);
});
if(errors.length){console.error('Institutional boundary checks failed:',errors.length);process.exitCode=1}
else console.log('PASS repository release-boundary checks (static only; passkey source may be SKIPPED; no production certification).');
