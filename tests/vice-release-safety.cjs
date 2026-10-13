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
// 1.3.6.7: guarantee governance and portfolio fixes are not accidentally removed.
assert(html.includes("if(APP_MODE==='LIVE')return 0;"),'unverified manual external balances may not increase LIVE totals');
assert(html.includes("const row={id:uuid(),owner_id:S.user.id,institution"),'external accounts must be owner scoped');
assert(html.includes("holderClientId: d.holder_client_id"),'distribution must remain mapped to holder client ID');
assert(!html.includes("status:'OPEN',votes_for:0,votes_against:0,created_by:S.user.id"),'proposal vote totals must be server controlled');
assert(html.includes("1.3.6.9-ACCESS-CONTROL"),'current release identity missing');
const ballot=read('supabase/migrations/20261013030938_vice_1366_governance_votes_distribution_fields.sql');
assert(ballot.includes('CREATE OR REPLACE FUNCTION public.vice_cast_proposal_vote'),'server ballot RPC missing');
assert(ballot.includes('UNIQUE (proposal_id,voter_id)'),'one vote per holder guard missing');
assert(ballot.includes('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.proposals'),'direct ballot counters should remain guarded');
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
// Legacy bootstrap was physically removed from the production source root.
// Keep its historical audit snapshot in the docs archive; never reintroduce it.
// Allow an inert exception-raising compatibility stub at the old path, but
// never permit a legacy executable schema to be packaged.
if(fs.existsSync(path.join(root,'supabase-setup.sql'))){
  const stub=read('supabase-setup.sql');
  assert(stub.includes('RAISE EXCEPTION')&&stub.includes('SAFE ENTRYPOINT')
    &&!stub.includes('create policy'),'legacy SQL root must remain a throwing stub');
}
const retired=read('docs/legacy/supabase-setup-LEGACY-INSECURE-DO-NOT-RUN.sql');
assert(retired.includes('DO NOT EXECUTE')&&retired.includes('UNSAFE HISTORICAL BOOTSTRAP'),'archived SQL must remain clearly nondeployable');
const patch=read('supabase/migrations/20261013025843_vice_1366_high_priority_row_security_hardening.sql');
assert(patch.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles'),'role escalation fix must remain');
const award=read('supabase/migrations/20261013030015_vice_1366_verified_academy_certificate_awards.sql');
assert(award.includes('v_passed <> 7'),'server verified Academy requirement missing');

console.log('PASS',meta.version,'— syntax, session isolation, live verified equity, password refusal, and no-credential storage.');
console.log('Reminder: automated tests do NOT certify MetaApi token activation or Netlify publication.');

const roleAndHealth=read('supabase/migrations/20261013034008_vice_1369_complete_role_price_and_operational_health_rpcs.sql');
assert(roleAndHealth.includes('CREATE OR REPLACE FUNCTION public.vice_assign_member_role'), 'Role administrator RPC missing');
assert(roleAndHealth.includes('CREATE OR REPLACE FUNCTION public.vice_set_dao_prices'), 'Canonical pricing attestation RPC missing');
assert(roleAndHealth.includes('CREATE OR REPLACE FUNCTION public.vice_operational_health'), 'Issuer health backend RPC missing');
assert(html.includes("sb.rpc('vice_operational_health')"), 'Live admin self diagnostics not connected to server');
