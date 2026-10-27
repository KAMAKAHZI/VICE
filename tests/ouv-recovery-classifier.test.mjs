import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyOuvRecovery} from '../web/identity/ouv-recovery-classifier.mjs';
const now=Date.parse('2026-10-27T12:00:00Z');
const proposal={id:'P-1',payload_hash:'sha256-value',status:'REVIEW',validation_until:'2026-10-22T12:00:00Z',quorum_verified_at:null,execute_after:null,payload:{parameters:{target_scaled_tier:{vice_ouv:2.82645403,v4x_ouv:452.2326448}}}};
test('completed review is not an expired proposal',()=>{
 const r=classifyOuvRecovery({proposal,now});
 assert.equal(r.issues.includes('VALIDATION_EXPIRED'),false);
 assert.equal(r.issues.includes('PUBLIC_REVIEW_INCOMPLETE'),false);
 assert.equal(r.canExecute,false);
});
test('signature from different proposal never counts',()=>{
 const r=classifyOuvRecovery({proposal,now,attestations:[{proposal_id:'P-2',payload_hash:proposal.payload_hash,role:'CEO',verified_at:'2026-10-26T00:00:00Z'}]});
 assert.equal(r.verifiedRoles.CEO,false);
});
test('signature from different payload never counts',()=>{
 const r=classifyOuvRecovery({proposal,now,attestations:[{proposal_id:'P-1',payload_hash:'wrong',role:'CFO',verified_at:'2026-10-26T00:00:00Z'}]});
 assert.equal(r.verifiedRoles.CFO,false);
});
test('invalid quorum timestamp fails closed',()=>{
 const r=classifyOuvRecovery({proposal:{...proposal,quorum_verified_at:'not-a-date'},now});
 assert.ok(r.issues.includes('QUORUM_NOT_VERIFIED'));
});
test('invalid execution timestamp fails closed',()=>{
 const r=classifyOuvRecovery({proposal:{...proposal,execute_after:'not-a-date'},now});
 assert.ok(r.issues.includes('EXECUTION_TIME_NOT_REACHED'));
});
test('zero OUV fails closed',()=>{
 const r=classifyOuvRecovery({proposal:{...proposal,payload:{parameters:{target_scaled_tier:{vice_ouv:0,v4x_ouv:0}}}},now});
 assert.equal(r.state,'INVALID_PROPOSAL');
});
