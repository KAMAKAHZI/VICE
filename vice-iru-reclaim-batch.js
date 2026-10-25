/* VICE OS: deterministic, read-only reclaim batch planner. No confiscation or writes. */
'use strict';
const policy=require('./vice-iru-reclaim-policy.js');
function plan({holders=[],engravedHolderId,anthonyHolderId,holderPoolAllocated,authorizations={}}={}){
  if(!Array.isArray(holders))throw Error('holders must be an array');
  if(!anthonyHolderId||!engravedHolderId)throw Error('Verified excluded and named holder IDs required');
  const seen=new Set(),items=[];
  for(const h of holders){
    if(!h||!h.id||seen.has(h.id))throw Error('Missing or duplicate holder ID');
    seen.add(h.id);
    if(h.id===anthonyHolderId)continue;
    const isEngraved=h.id===engravedHolderId;
    const restricted=h.account_suspended===true||h.account_revoked===true||h.holdings_locked===true;
    if(!restricted&&!isEngraved)continue;
    const requested=isEngraved?2500n:500n;
    const balance=BigInt(String(h.vice_units));
    if(balance<requested)throw Error('Requested amount exceeds balance for holder '+h.id);
    const a=authorizations[h.id]||{};
    const result=policy.assess({program:'VICE',status:restricted?'SUSPENDED':'ACTIVE',sourceHolderId:h.id,holderBalance:balance.toString(),requestedUnits:requested.toString(),holderPoolAllocated,authorization:a});
    items.push({holderId:h.id,category:isEngraved?'ENGRAVED':'RESTRICTED',...result});
  }
  if(items.filter(x=>x.category==='RESTRICTED').length>4)throw Error('Unexpected restricted account count');
  const total=items.reduce((s,x)=>s+BigInt(x.units),0n);
  if(total>4500n)throw Error('Exceeds approved review scope');
  return Object.freeze({mode:'REVIEW_ONLY',items,totalProposedVice:total.toString(),executable:items.length>0&&items.every(x=>x.allowed),supplyChange:'0',targetPool:'STRATEGIC_HOLDER_POOL'});
}
module.exports={plan};
