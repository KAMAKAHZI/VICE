/* VICE OS: preflight only. Never executes transfers or changes account access. */
(function(root){
  'use strict';
  const LIMIT=2500000n;
  function units(value){
    if(typeof value==='bigint')return value;
    if(typeof value==='number'&&Number.isSafeInteger(value))return BigInt(value);
    if(typeof value==='string'&&/^\d+$/.test(value))return BigInt(value);
    throw Error('Invalid whole-unit balance');
  }
  function assess({status,program,holderBalance,requestedUnits,holderPoolAllocated,authorization,sourceHolderId,targetPool='STRATEGIC_HOLDER_POOL'}={}){
    if(!['VICE','V4X'].includes(program))throw Error('Unsupported IRU class');
    if(!sourceHolderId||sourceHolderId==='ESTATE'||sourceHolderId===targetPool)throw Error('Invalid holder');
    const available=units(holderBalance),amount=units(requestedUnits),allocated=units(holderPoolAllocated);
    if(amount<=0n||amount>available)throw Error('Insufficient eligible balance');
    if(allocated<amount||allocated>LIMIT)throw Error('Holder pool accounting conflict');
    if(targetPool!=='STRATEGIC_HOLDER_POOL')throw Error('Reclaims must return to 25% holder pool');
    const accessOnly=['SUSPENDED','REVOKED','FROZEN'].includes(String(status||'').toUpperCase());
    const a=authorization||{};
    const authorized=a.reviewed===true&&a.executiveApproved===true&&a.legalBasisVerified===true&&
      typeof a.agreementReference==='string'&&a.agreementReference.trim().length>=5&&
      typeof a.evidenceReference==='string'&&a.evidenceReference.trim().length>=5;
    return Object.freeze({
      allowed:authorized,
      reason:authorized?'APPROVED_FOR_SEPARATE_LEDGER_EXECUTION':accessOnly?'ACCESS_RESTRICTION_DOES_NOT_FORFEIT_UNITS':'RECLAIM_REQUIRES_VERIFIED_AUTHORITY',
      program,sourceHolderId,targetPool,units:amount.toString(),
      holderPoolAllocatedAfter:(allocated-amount).toString(),
      holderPoolAvailableAfter:(LIMIT-allocated+amount).toString(),
      supplyChange:'0',requiresAtomicLedgerTransfer:true,requiresCertificateReconciliation:true
    });
  }
  const api=Object.freeze({assess});
  root.ViceIruReclaimPolicy=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
