'use strict';
// Narrow high-confidence source-secret release gate; complements (does not
// replace) GitHub secret scanning and manual security review.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const failures=[];
const privateKey=/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/;
const providerTokens=/\b(?:sb_secret_[A-Za-z0-9_-]{20,}|nfp_[A-Za-z0-9_-]{20,})\b/g;
const secretAssignments=/\b(?:SUPABASE_SERVICE_ROLE_KEY|NETLIFY_AUTH_TOKEN|SMTP_PASSWORD|RESEND_API_KEY|TURN_SHARED_SECRET)\s*[:=]\s*(['"`])([^\r\n'"`]+)\1/g;
const sourceFile=/^(?:server\/|netlify\/functions\/|supabase\/functions\/|scripts\/|tests\/|\.github\/workflows\/)/;
for(const file of tracked){
 if(/(^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|private\.pem)$/.test(file))
  failures.push(file+': sensitive filename must not be tracked');
 if(!/(?:\.m?[jc]s|\.tsx?|\.ya?ml|\.json|\.html|\.sh)$/.test(file) || (!sourceFile.test(file)&&file!=='index.html'))continue;
 const abs=path.resolve(root,file);
 if(!abs.startsWith(root+path.sep))throw Error('Unexpected tracked path escape');
 const bytes=fs.readFileSync(abs);
 if(bytes.length>4*1024*1024)continue;
 const text=bytes.toString('utf8');
 if(privateKey.test(text))failures.push(file+': embedded private-key block');
 if(providerTokens.test(text))failures.push(file+': live-format privileged service token');
 providerTokens.lastIndex=0;
 for(const [,quote,value] of text.matchAll(secretAssignments)){
  // These are permitted placeholders and expressions, never real secrets.
  const v=value.trim();
  if(v.length<20 || /^(?:\$\{|process\.env|Deno\.env|<|YOUR_|REPLACE_|synthetic|test-|example|placeholder|\{\{)/i.test(v))continue;
  failures.push(file+': suspicious literal server-only credential assignment');
 }
}
assert.deepEqual(failures,[],'Potential source-controlled secrets: '+failures.join('; '));
console.log('PASS high-confidence tracked source credential gate ('+tracked.length+' paths). This is not comprehensive secret scanning.');
