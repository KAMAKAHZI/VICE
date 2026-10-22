'use strict';
/*
 * Deterministic release-only compatibility repair for the legacy public
 * governance page. The source HTML embeds the existing public Supabase anon
 * identifier; never duplicate, print, re-commit or expose its raw value.
 *
 * Back-end feed already returns both fields:
 * verified_executive_signatures = cryptographic device signatures ONLY,
 * verified_executive_authorizations = DISTINCT CEO/CFO device OR 2FA votes.
 *
 * Transform the whitelisted dist/site copy and fail closed if the source
 * changes. This does NOT update official issuer OUV or execute governance.
 */
const fs=require('node:fs');
const path=require('node:path');

function patch(source){
 let s=String(source);
 const changes=[
  [
   '<dt>Verified executive signatures</dt><dd>\${esc(p.verified_executive_signatures)} of 2</dd>',
   '<dt>Verified CEO/CFO approvals (device or 2FA)</dt><dd>\${esc(Number.isInteger(Number(p.verified_executive_authorizations)) ? p.verified_executive_authorizations : "UNVERIFIED")} of 2</dd><dt>CEO authorization</dt><dd>\${p.ceo_signed?("VERIFIED · "+esc(p.ceo_authorization_method==="MFA_TOTP"?"Authenticator 2FA":"Device signature")):"AWAITING"}</dd><dt>CFO authorization</dt><dd>\${p.cfo_signed?("VERIFIED · "+esc(p.cfo_authorization_method==="MFA_TOTP"?"Authenticator 2FA":"Device signature")):"AWAITING"}</dd>'
  ],
  [
   '"UNDER REVIEW — EXECUTION NOT AUTHORIZED"',
   'p.status==="REVIEW" && p.ceo_signed===true && p.cfo_signed===true && p.verified_executive_authorizations===2 ? "2/2 EXECUTIVE APPROVALS — NOT EFFECTIVE" : "UNDER REVIEW — EXECUTION NOT AUTHORIZED"'
  ],
  [
   'new Date(p.validation_until).toLocaleString()',
   'new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(p.validation_until))'
  ],
  [
   "<dt>72-hour execution timelock</dt><dd>\${p.execute_after?esc(p.execute_after):'Not started'}</dd></dl>",
   "<dt>72-hour execution timelock</dt><dd>\${p.execute_after?esc(p.execute_after):'Not started'}</dd><dt>Reference status</dt><dd>\${p.status==='APPLIED'||p.status==='EXECUTED'?'Reported executed — independently verify official prices':'NOT EFFECTIVE — official issuer references and holder values are unchanged'}</dd></dl>"
  ],
  [
   "document.getElementById('refresh').onclick=load;load();",
   "document.getElementById('refresh').onclick=load;document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden)load();},60000);load();"
  ]
 ];
 for(const [original,replacement] of changes){
  if(!s.includes(original))throw Error('Governance publish contract changed; stop release rather than silently publish stale executive vote counts');
  if(s.indexOf(original)!==s.lastIndexOf(original))throw Error('Ambiguous governance display anchor; manual review required');
  s=s.replace(original,replacement);
 }
 if(!s.includes('verified_executive_authorizations')||s.includes('<dt>Verified executive signatures</dt>'))
  throw Error('Public executive authorization fix incomplete');
 return s;
}
if(require.main===module){
 const target=path.resolve(__dirname,'../dist/site/governance.html');
 const source=fs.readFileSync(target,'utf8');
 fs.writeFileSync(target,patch(source),'utf8');
 console.log('PASS public governance: distinct executive 2FA/device authorizations, Eastern deadline and non-effective prices');
}
module.exports={patch};
