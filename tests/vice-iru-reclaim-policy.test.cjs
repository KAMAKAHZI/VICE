const test=require('node:test');
const assert=require('node:assert/strict');
const {assess}=require('../vice-iru-reclaim-policy.js');
const base={program:'VICE',sourceHolderId:'VC-000025',status:'SUSPENDED',holderBalance:'100',requestedUnits:'40',holderPoolAllocated:'1000'};
test('suspension alone never permits reclaim',()=>{const r=assess(base);assert.equal(r.allowed,false);assert.equal(r.supplyChange,'0');});
test('documented approval permits preflight only',()=>{const r=assess({...base,authorization:{reviewed:true,executiveApproved:true,legalBasisVerified:true,agreementReference:'AGR-12345',evidenceReference:'CASE-12345'}});assert.equal(r.allowed,true);assert.equal(r.holderPoolAllocatedAfter,'960');assert.equal(r.holderPoolAvailableAfter,'2499040');assert.equal(r.requiresAtomicLedgerTransfer,true);});
test('rejects overdraw and unauthorized reserve',()=>{assert.throws(()=>assess({...base,requestedUnits:'101'}));assert.throws(()=>assess({...base,targetPool:'ESTATE'}));});
test('supports V4X without changing fixed supply',()=>assert.equal(assess({...base,program:'V4X'}).supplyChange,'0'));
