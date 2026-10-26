// VICE OS Phase 3.16: server-only authenticated SOC ingress handler.
// Framework-agnostic request adapter. Call from a trusted Node route only.
// No direct financial writes or authorization changes.
import {authenticateSocWebhook} from './webhook-auth.mjs';
import {normalizeTrustedBatch} from './normalize.mjs';
import {prepareSocIncidents} from './incidents.mjs';
export function createSocIngress({secret,consumeNonce,writeIncidents,clock=Date.now}){
  if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw new Error('Strong SOC secret required');
  if(typeof consumeNonce!=='function'||typeof writeIncidents!=='function')throw new TypeError('Trusted storage adapters required');
  return async function ingest({rawBody,headers}){
    if(typeof rawBody!=='string'||Buffer.byteLength(rawBody)>65536)return {status:413,body:{error:'payload_too_large'}};
    if(!headers||typeof headers!=='object')return {status:401,body:{error:'unauthorized'}};
    const timestamp=headers['x-vice-timestamp'];
    const nonce=headers['x-vice-nonce'];
    const signature=headers['x-vice-signature'];
    let context;
    try{
      context=await authenticateSocWebhook({rawBody,timestamp,nonce,signature,secret,now:clock()},consumeNonce);
    }catch{
      return {status:401,body:{error:'unauthorized'}};
    }
    let records;
    try{records=JSON.parse(rawBody)}catch{return {status:400,body:{error:'invalid_json'}}}
    if(!Array.isArray(records)||records.length>1000)return {status:400,body:{error:'invalid_batch'}};
    const normalized=normalizeTrustedBatch(records,context);
    const incidents=prepareSocIncidents(normalized,context,{now:clock()});
    try{
      await writeIncidents(incidents);
    }catch{
      return {status:503,body:{error:'incident_store_unavailable'}};
    }
    return {status:202,body:{accepted:normalized.length,incidents:incidents.length}};
  };
}
