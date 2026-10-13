'use strict';
/** Static release safety checks. Do not replace broker acceptance tests. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),meta=JSON.parse(read('version.json'));
const edge=read('supabase/functions/vice-mt5-cloud/index.ts');
assert.match(html,/^<!DOCTYPE html>/i,'site root must start with HTML');
const build=html.match(/data-build="([^"]+)"/)?.[1];
assert.equal(build,meta.version,'HTML build marker and version.json must match');
assert.match(build,/^1\.3\.6\.\d+-/,'unexpected release family');
assert(html.includes('function safeResetCloudMt5Session()'),'optional Cloud MT5 reset safeguard missing');
assert(html.includes('return {state,request,reset,refresh,'),'CloudMT5 must expose reset method');
assert(!html.includes("if(typeof CloudMT5!=='undefined')CloudMT5.reset();"),'unsafe MT5 reset can block login');
assert(html.includes("localStorage.removeItem('vice-os-auth-v1.0.1')"),'session-reset control must clear real Supabase auth storage');
assert(html.includes('function viceServiceDiagnostics()'),'public/member connection diagnostics missing');
assert(html.includes('data-act="vice-health-check"'),'login diagnostics entry missing');
assert(html.includes('S.user?.id===user.id && S.profile?.role'),'authorized session must recover from optional module failures');
assert(html.includes('const btn=$(\'loginBtn\');if(btn){btn.disabled=false;btn.textContent=\'Log In\';}'),'login submit state must reset');
const mainScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.length>100000);
assert(mainScript,'preserved VICE OS inline application code is missing');
new vm.Script(mainScript,{filename:'vice-os-inline.js'});
assert(html.includes('function liveBridgeAccounts()'),'verified WSS snapshot gate missing');
assert(html.includes('a.realEquityVerified!==true'),'MetaApi real broker mode gating missing');
assert(html.includes("mode!=='LIVE'"),'bridge LIVE-only account gate missing');
assert(/const memberKey=\(?stem\)?=>/.test(html),'per-user WSS storage missing');
assert(html.includes('try{Link.stop()}catch(_){}'),'bridge signout cleanup missing');
assert(!html.includes('id="mt5Password"'),'browser MT5 password input must not exist');
assert(!html.includes("localStorage.setItem('vice-link',"),'shared browser bridge credential storage present');
assert(edge.includes("terminalMode:data.type==='ACCOUNT_TRADE_MODE_REAL'"),'broker-reported terminal mode gate missing');
assert(edge.includes("realEquityVerified:row.account_mode==='LIVE'&&info.terminalMode==='LIVE'"),'LIVE real equity guard missing');
assert(edge.includes("'password' in body"),'client-submitted MT5 passwords must be rejected');
assert(edge.includes(".eq('owner_id',uid)"),'MT5 cloud account owner filter missing');
assert(meta.unverified?.some(v=>/MetaApi|token|broker/i.test(v)),'external broker acceptance must not be marked certified');

assert(html.includes('function showPasswordRecovery()'),'Supabase password recovery modal missing');
assert(html.includes('async function applyRecoveredPassword()'),'password recovery update method missing');
assert(html.includes("setTimeout(showPasswordRecovery,0)"),'recovery event must show password UI');
assert(html.includes('if(inviteCode && !prof)'),'returning member must not re-redeem invitations');
assert(html.includes('/guide.html'),'member manual link missing');
const manual=read('guide.html');
assert(manual.includes('First access')&&manual.includes('Troubleshooting connections'),'web manual not complete');
for(const file of ['netlify/functions/yahoo.js','netlify/functions/yahoo-search.js']){
 const src=read(file); new vm.Script(src,{filename:file});
 assert(src.includes('AbortController'),'market source timeout missing');
}
const retired=read('supabase-setup.sql');
assert(retired.includes('RAISE EXCEPTION'),'legacy insecure schema must be disabled');
const patch=read('supabase/migrations/20261013025843_vice_1366_high_priority_row_security_hardening.sql');
assert(patch.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles'),'role escalation fix must remain');
const award=read('supabase/migrations/20261013030015_vice_1366_verified_academy_certificate_awards.sql');
assert(award.includes('v_passed <> 7'),'server verified Academy requirement missing');

console.log('PASS',meta.version,'— syntax, session isolation, live verified equity, password refusal, and no-credential storage.');
console.log('Reminder: automated tests do NOT certify MetaApi token activation or Netlify publication.');
