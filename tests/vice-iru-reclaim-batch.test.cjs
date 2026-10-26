'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {plan}=require('../vice-iru-reclaim-batch.js');
const base={holderPoolAllocated:'10000',engravedHolderId:'engraved-id',anthonyHolderId:'anthony-id'};
const holders=[
 {id:'restricted-1',vice_units:'500',holdings_locked:true},
 {id:'restricted-2',vice_units:'1000',account_revoked:true},
 {id:'restricted-3',vice_units:'1000',account_suspended:true},
 {id:'restricted-4',vice_units:'1000',holdings_locked:true,account_revoked:true},
 {id:'engraved-id',vice_units:'2500'},
 {id:'anthony-id',vice_units:'100000',account_suspended:true},
 {id:'normal-id',vice_units:'50000'}
];
test('correct proposed batch amount, destination, and exclusions',()=>{
 const result=plan({...base,holders});
 assert.equal(result.totalProposedVice,'4500');
 assert.equal(result.items.length,5);
 assert.equal(result.supplyChange,'0');
 assert.equal(result.targetPool,'STRATEGIC_HOLDER_POOL');
 assert.ok(!result.items.some(x=>x.holderId==='anthony-id'||x.holderId==='normal-id'));
 assert.equal(result.executable,false);
});
test('reclaim requires verified authorization for every entry',()=>{
 const authorizations=Object.fromEntries(holders.map(h=>[h.id,{reviewed:true,executiveApproved:true,legalBasisVerified:true,agreementReference:'agreement-123',evidenceReference:'evidence-123'}]));
 assert.equal(plan({...base,holders,authorizations}).executable,true);
});
test('reject duplicate holders',()=>assert.throws(()=>plan({...base,holders:[holders[0],holders[0]]}),/duplicate/));
test('reject insufficient balance',()=>assert.throws(()=>plan({...base,holders:[{...holders[0],vice_units:'499'}]}),/exceeds balance/));
test('never include excluded Anthony even when restricted',()=>{
 const result=plan({...base,holders:[holders[5]]});
 assert.equal(result.totalProposedVice,'0');
 assert.equal(result.items.length,0);
});
test('fail closed without immutable excluded holder IDs',()=>assert.throws(()=>plan({holders}),/holder IDs required/));
