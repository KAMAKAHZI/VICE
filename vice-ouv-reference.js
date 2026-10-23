/* VICE OS — authoritative OUV read-only bridge. No pricing writes. */
(function(root){
 'use strict';
 const RATIO=160;
 function normalize(data){
   if(!data||data.reference_kind!=='ISSUER_INTERNAL_MANAGEMENT_REFERENCE'||data.independent_fair_market_value!==false||data.holder_units_changed!==false) throw Error('Invalid OUV reference response');
   if(!['MODEL_ONLY','AUTO_ACTIVE','SUSPENDED'].includes(data.policy_status)) throw Error('Unrecognized OUV policy');
   const vice=Number(data.official_ouv&&data.official_ouv.VICE);
   const v4x=Number(data.official_ouv&&data.official_ouv.V4X);
   if(!Number.isFinite(vice)||vice<=0||!Number.isFinite(v4x)||Math.abs(v4x-vice*RATIO)>0.00000001) throw Error('OUV integrity failure');
   if(!data.effective_at||!Number.isFinite(Date.parse(data.effective_at))) throw Error('Missing effective timestamp');
   return Object.freeze({vice,v4x,policyStatus:data.policy_status,effectiveAt:data.effective_at,versionId:data.effective_version_id||null,referenceKind:data.reference_kind});
 }
 async function read(supabaseClient){
   if(!supabaseClient||typeof supabaseClient.rpc!=='function') throw Error('Authenticated Supabase client required');
   const {data,error}=await supabaseClient.rpc('vice_ouv_effective_reference');
   if(error) throw Error('Official OUV unavailable: '+error.message);
   return normalize(data);
 }
 function portfolioValue(units,reference){
   if(!units||!reference) throw Error('Holdings and reference required');
   const vice=Number(units.VICE),v4x=Number(units.V4X);
   if(!Number.isSafeInteger(vice)||vice<0||!Number.isSafeInteger(v4x)||v4x<0) throw Error('Invalid holdings');
   const value=vice*reference.vice+v4x*reference.v4x;
   if(!Number.isFinite(value)) throw Error('Portfolio overflow');
   return value;
 }
 root.ViceOUVReference=Object.freeze({normalize,read,portfolioValue});
})(typeof window!=='undefined'?window:globalThis);
