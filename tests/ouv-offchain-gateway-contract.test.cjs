'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const file=readFileSync(join(__dirname,'..','netlify','functions','ouv-final-deploy.js'),'utf8');
test('OUV execution gateway must remain fail-closed',()=>{
 assert.match(file,/VICE_OUV_EXECUTION_ENABLED/);
 assert.match(file,/s\.can_apply === true/);
 assert.match(file,/s\.governance_mode === 'OFFCHAIN_SUPABASE_TOTP'/);
 assert.match(file,/totp\.ceo && totp\.cfo/);
 assert.match(file,/DUAL_EXECUTIVE_TOTP_REQUIRED/);
 assert.match(file,/OFFCHAIN_GOVERNANCE_POLICY_NOT_DEPLOYED/);
 assert.match(file,/executive_authorizations === 2/);
 assert.match(file,/ledger_reconciled === true/);
 assert.match(file,/baseline_compatible === true/);
 assert.match(file,/review_complete === true/);
 assert.doesNotMatch(file,/const ready = signaturesVerified/);
});
test('OUV gateway cannot treat CFO attestation as TOTP',()=>{
 assert.match(file,/vice_exec_mfa_authorizations\?select=/);
 assert.match(file,/auth_method=eq\.SUPABASE_TOTP/);
 assert.match(file,/a\.auth_method === 'SUPABASE_TOTP'/);
 assert.match(file,/a\.payload_hash === HASH/);
 assert.match(file,/ceoIds\.size === 1 && cfoIds\.size === 1/);
});
test('OUV requires explicit execution intent and post-write reconciliation',()=>{
 assert.match(file,/EXECUTE APPROVED OUV/);
 assert.match(file,/request\.request_id/);
 assert.match(file,/const finalState = await checkPublished/);
 assert.match(file,/status: finalState\.verified \? 'verified' : 'action_required'/);
});
