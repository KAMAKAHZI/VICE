// Identity Engine 2.0 — browser-side WebAuthn adapter.
// This module NEVER grants authority. All challenges and assertions MUST be verified server-side.
// A 501 or capabilities=false response must disable registration and approval.
const B64URL=/^[A-Za-z0-9_-]+$/;
function decode(s){
 if(typeof s!=="string"||!B64URL.test(s))throw new TypeError("Invalid base64url");
 const b=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4));
 return Uint8Array.from(b,c=>c.charCodeAt(0));
}
function encode(buf){
 const bytes=new Uint8Array(buf);let binary="";
 for(const b of bytes)binary+=String.fromCharCode(b);
 return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function assertReady(capabilities,key){
 if(!globalThis.isSecureContext||!globalThis.PublicKeyCredential||!globalThis.navigator?.credentials)throw new Error("WEBAUTHN_UNAVAILABLE");
 if(capabilities?.[key]!==true)throw new Error("WEBAUTHN_VERIFIER_NOT_CONFIGURED");
}
function publicKeyCreateOptions(options){
 const p=structuredClone(options);
 p.challenge=decode(p.challenge);p.user.id=decode(p.user.id);
 if(p.excludeCredentials)p.excludeCredentials=p.excludeCredentials.map(x=>({...x,id:decode(x.id)}));
 p.authenticatorSelection={...p.authenticatorSelection,userVerification:"required"};
 return p;
}
function publicKeyGetOptions(options){
 const p=structuredClone(options);
 p.challenge=decode(p.challenge);
 if(p.allowCredentials)p.allowCredentials=p.allowCredentials.map(x=>({...x,id:decode(x.id)}));
 p.userVerification="required";
 return p;
}
export async function registerPasskey(options,capabilities){
 assertReady(capabilities,"passkeyRegistration");
 const c=await navigator.credentials.create({publicKey:publicKeyCreateOptions(options)});
 if(!c||c.type!=="public-key")throw new Error("PASSKEY_REGISTRATION_CANCELLED");
 return {id:c.id,rawId:encode(c.rawId),type:c.type,response:{
 clientDataJSON:encode(c.response.clientDataJSON),
 attestationObject:encode(c.response.attestationObject),
 transports:c.response.getTransports?.()||[]
 },clientExtensionResults:c.getClientExtensionResults?.()||{}};
}
export async function authenticatePasskey(options,capabilities,{transaction=false}={}){
 assertReady(capabilities,transaction?"transactionAuthorization":"passkeyAuthentication");
 const c=await navigator.credentials.get({publicKey:publicKeyGetOptions(options)});
 if(!c||c.type!=="public-key")throw new Error("PASSKEY_AUTHENTICATION_CANCELLED");
 return {id:c.id,rawId:encode(c.rawId),type:c.type,response:{
 clientDataJSON:encode(c.response.clientDataJSON),
 authenticatorData:encode(c.response.authenticatorData),
 signature:encode(c.response.signature),
 userHandle:c.response.userHandle?encode(c.response.userHandle):null
 },clientExtensionResults:c.getClientExtensionResults?.()||{}};
}
