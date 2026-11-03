import assert from 'node:assert/strict';
import {makeSimpleWebAuthnAssertionVerifier} from '../security/auth/simplewebauthn-adapter.mjs';
assert.throws(()=>makeSimpleWebAuthnAssertionVerifier(),/dependency/);
let called=false;
const verify=makeSimpleWebAuthnAssertionVerifier({verifyAuthenticationResponse:async options=>{
 called=true;
 assert.equal(options.expectedChallenge,'challenge');
 assert.equal(options.expectedOrigin,'https://vice4x.netlify.app');
 assert.equal(options.expectedRPID,'vice4x.netlify.app');
 assert.equal(options.requireUserVerification,true);
 return {verified:true,authenticationInfo:{userVerified:true,newCounter:3}};
}});
const base={assertion:{id:'cred'},credential:{id:'cred',publicKey:new Uint8Array([1]),counter:2},challenge:'challenge',expectedOrigin:'https://vice4x.netlify.app',expectedRpId:'vice4x.netlify.app'};
assert.equal((await verify(base)).newCounter,3);
assert.equal(called,true);
await assert.rejects(()=>makeSimpleWebAuthnAssertionVerifier({verifyAuthenticationResponse:async()=>({verified:true,authenticationInfo:{userVerified:false,newCounter:3}})})(base),/not verified/);
await assert.rejects(()=>makeSimpleWebAuthnAssertionVerifier({verifyAuthenticationResponse:async()=>({verified:true,authenticationInfo:{userVerified:true,newCounter:-1}})})(base),/counter/);
console.log('PASS WebAuthn library adapter contract (mock verifier; live crypto integration pending)');
