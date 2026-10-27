import {validatePasskeyChallenge} from './passkey-challenge-policy.mjs';
// Server-side WebAuthn assertion boundary. Requires an independently audited
// WebAuthn verification adapter; this module never accepts client-side booleans.
export function makeVerifiedPasskeyGate({verifyAssertion,loadChallenge,consumeChallenge,loadCredential,clock=Date.now}={}){
 if(typeof verifyAssertion!=='function'||typeof loadChallenge!=='function'||typeof consumeChallenge!=='function'||typeof loadCredential!=='function')throw new TypeError('Trusted verification adapters required');
 return async function verify({actorId,challengeId,assertion,expectedOrigin,expectedRpId,action,payloadHash}={}){
  if(typeof actorId!=='string'||!actorId||typeof challengeId!=='string'||!challengeId||!assertion||typeof expectedOrigin!=='string'||typeof expectedRpId!=='string')throw new Error('Invalid passkey verification request');
  const challenge=await loadChallenge(challengeId);
  const now=clock();
  if(!validatePasskeyChallenge({record:challenge,actorId,now,action,payloadHash}) || (challenge.action!==undefined && action===undefined) || (challenge.payloadHash!==undefined && payloadHash===undefined))throw new Error('Passkey challenge invalid or expired');
  const credential=await loadCredential(actorId,assertion.id);
  if(!credential||credential.revoked||credential.actorId!==actorId)throw new Error('Passkey credential unavailable');
  // Adapter MUST validate signature, challenge, origin, RP ID, user verification,
  // credential public key, counter semantics, and authenticator data.
  const result=await verifyAssertion({assertion,credential,challenge:challenge.challenge,expectedOrigin,expectedRpId,requireUserVerification:true});
  if(!result||result.verified!==true||result.userVerified!==true)throw new Error('Passkey verification failed');
  // The adapter must implement atomic compare-and-set, rejecting replay.
  const consumed=await consumeChallenge(challengeId,actorId,now);
  if(consumed!==true)throw new Error('Passkey challenge replayed');
  return Object.freeze({actorId,credentialId:credential.id,verifiedAt:now,action:action??null,payloadHash:payloadHash??null});
 };
}
