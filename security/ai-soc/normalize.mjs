// VICE OS AI-SOC phase 3.11: conservative normalization of server-side events.
// This adapter is NOT an authentication mechanism. The caller must be a trusted
// server integration and must enforce access control before supplying records.
const ALLOWED = new Set(['MFA_FAILURE','MFA_REPLAY','ROLE_CHANGE_DENIED','ROLE_CHANGE',
 'SESSION_REVOKED','LOGIN_FAILURE','IRU_ALLOCATION_DENIED','OUV_EXECUTION_DENIED']);
export function normalizeTrustedSecurityEvent(raw, context){
  if(!context || context.trustedSource!==true || context.serverAuthenticated!==true)
    throw new Error('Authenticated server integration required');
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return null;
  const type=raw.type;
  if(typeof type!=='string'||!ALLOWED.has(type))return null;
  const actorId=raw.actorId;
  if(typeof actorId!=='string'||!/^[-_a-zA-Z0-9:.]{1,128}$/.test(actorId))return null;
  const at=raw.at;
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))return null;
  // Never trust a user-supplied serverVerified field.
  return Object.freeze({type,actorId,at:new Date(at).toISOString(),serverVerified:true});
}
export function normalizeTrustedBatch(records,context){
  if(!Array.isArray(records)||records.length>1000)throw new TypeError('Invalid batch size');
  return records.map(r=>normalizeTrustedSecurityEvent(r,context)).filter(Boolean);
}
