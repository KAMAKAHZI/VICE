import assert from 'node:assert/strict';
import {normalizeTrustedBatch,normalizeTrustedSecurityEvent} from '../security/ai-soc/normalize.mjs';
import {triageSecurityEvents} from '../security/ai-soc/triage.mjs';
const now=Date.parse('2026-10-25T12:00:00Z');
const raw={type:'MFA_REPLAY',actorId:'actor-1',at:new Date(now).toISOString(),serverVerified:false,
 password:'do-not-include',token:'do-not-include'};
assert.throws(()=>normalizeTrustedSecurityEvent(raw,{}),/Authenticated server/);
assert.throws(()=>normalizeTrustedSecurityEvent(raw,{trustedSource:true}),/Authenticated server/);
const normalized=normalizeTrustedSecurityEvent(raw,{trustedSource:true,serverAuthenticated:true});
assert.deepEqual(Object.keys(normalized).sort(),['actorId','at','serverVerified','type']);
assert.equal(normalized.serverVerified,true);
assert.equal(triageSecurityEvents([normalized],{now})[0].severity,'critical');
assert.equal(normalizeTrustedSecurityEvent({...raw,actorId:'bad actor\n'}, {trustedSource:true,serverAuthenticated:true}),null);
assert.equal(normalizeTrustedBatch([{...raw,type:'UNRECOGNIZED'},raw],{trustedSource:true,serverAuthenticated:true}).length,1);
console.log('PASS SOC normalization boundary contracts (offline only)');
