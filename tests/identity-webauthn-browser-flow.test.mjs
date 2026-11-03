import test from "node:test";
import assert from "node:assert/strict";
import {registerPasskey,authenticatePasskey} from "../web/identity/webauthn-client.mjs";
const b64=b=>Buffer.from(b).toString("base64url");
const bytes=s=>Uint8Array.from(Buffer.from(s));
function withAuthenticator(credential,callback){
 const old={isSecureContext:globalThis.isSecureContext,PublicKeyCredential:globalThis.PublicKeyCredential,navigator:globalThis.navigator};
 globalThis.isSecureContext=true;globalThis.PublicKeyCredential=class {};
 Object.defineProperty(globalThis,"navigator",{value:{credentials:credential},configurable:true});
 return Promise.resolve().then(callback).finally(()=>{
  for(const k of ["isSecureContext","PublicKeyCredential"])if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];
  if(old.navigator===undefined)delete globalThis.navigator;else Object.defineProperty(globalThis,"navigator",{value:old.navigator,configurable:true});
 });
}
test("registration converts binary options and serializes public attestation",async()=>{
 const challenge=bytes("challenge123"),user=bytes("user123"),rawId=bytes("credential");
 await withAuthenticator({create:async({publicKey:p})=>{
  assert.deepEqual([...p.challenge],[...challenge]);assert.deepEqual([...p.user.id],[...user]);
  assert.equal(p.authenticatorSelection.userVerification,"required");
  return {id:b64(rawId),rawId,type:"public-key",response:{clientDataJSON:bytes("client"),attestationObject:bytes("attestation"),getTransports:()=>["internal"]},getClientExtensionResults:()=>({})};
 }},async()=>{
  const out=await registerPasskey({challenge:b64(challenge),user:{id:b64(user)},authenticatorSelection:{residentKey:"required"}},{passkeyRegistration:true});
  assert.equal(out.response.attestationObject,b64(bytes("attestation")));
  assert.deepEqual(out.response.transports,["internal"]);
 });
});
test("assertion forces user verification and returns signature bytes",async()=>{
 const challenge=bytes("challenge123"),rawId=bytes("credential");
 await withAuthenticator({get:async({publicKey:p})=>{
  assert.deepEqual([...p.challenge],[...challenge]);
  assert.equal(p.userVerification,"required");
  return {id:b64(rawId),rawId,type:"public-key",response:{clientDataJSON:bytes("client"),authenticatorData:bytes("auth"),signature:bytes("sig"),userHandle:null},getClientExtensionResults:()=>({})};
 }},async()=>{
  const out=await authenticatePasskey({challenge:b64(challenge)},{transactionAuthorization:true},{transaction:true});
  assert.equal(out.response.signature,b64(bytes("sig")));
  assert.equal(out.response.userHandle,null);
 });
});
test("transaction cannot reuse login-only capability even with authenticator",async()=>{
 await withAuthenticator({get:async()=>{throw new Error("should not reach authenticator");}},async()=>{
  await assert.rejects(authenticatePasskey({challenge:b64(bytes("c"))},{passkeyAuthentication:true,transactionAuthorization:false},{transaction:true}),/WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
 });
});
test("invalid challenge is rejected before credential creation",async()=>{
 await withAuthenticator({create:async()=>{throw new Error("should not reach authenticator");}},async()=>{
  await assert.rejects(registerPasskey({challenge:"not+base64url",user:{id:"dXNlcg"}},{passkeyRegistration:true}),/Invalid base64url/);
 });
});
