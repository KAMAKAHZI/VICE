import assert from 'node:assert/strict';
import {makeVerifiedPasskeyGate} from '../security/auth/passkey-gate.mjs';
const now=1800000000000;
const base={actorId:'user-1',challengeId:'challenge-1',assertion:{id:'credential-1'},expectedOrigin:'https://example.test',expectedRpId:'example.test'};
function gate(overrides={}){
 let used=false;
 const opts={
  clock:()=>now,
  loadChallenge:async()=>({actorId:'user-1',challenge:'opaque-challenge',createdAt:now-1000,expiresAt:now+1000,used}),
  loadCredential:async()=>({id:'credential-1',actorId:'user-1',revoked:false}),
  verifyAssertion:async()=>({verified:true,userVerified:true}),
  consumeChallenge:async()=>{if(used)return false;used=true;return true;},
  ...overrides
 };
 return makeVerifiedPasskeyGate(opts);
}
const verify=gate();
assert.equal((await verify(base)).credentialId,'credential-1');
await assert.rejects(()=>verify(base),/invalid or expired|replayed/);
await assert.rejects(()=>gate({verifyAssertion:async()=>({verified:true,userVerified:false})})(base),/failed/);
await assert.rejects(()=>gate({loadCredential:async()=>({id:'credential-1',actorId:'user-1',revoked:true})})(base),/unavailable/);
await assert.rejects(()=>gate({loadChallenge:async()=>({actorId:'user-2',createdAt:now-1000,expiresAt:now+1000})})(base),/invalid/);
await assert.rejects(()=>gate({loadChallenge:async()=>({actorId:'user-1',createdAt:now-1000,expiresAt:now})})(base),/invalid/);
await assert.rejects(()=>gate({loadChallenge:async()=>({actorId:'user-1',createdAt:now-1000,expiresAt:now+1000,action:'ROLE_ASSIGN',payloadHash:'abc'})})(base),/invalid/);
console.log('PASS passkey verification boundary contracts (mock adapters only)');
