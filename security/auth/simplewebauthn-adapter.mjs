// Adapter for @simplewebauthn/server. This file is server-only.
// Install and pin a reviewed version of @simplewebauthn/server in the backend
// before using. Never expose stored credential public keys to the browser.
export function makeSimpleWebAuthnAssertionVerifier({verifyAuthenticationResponse}={}){
 if(typeof verifyAuthenticationResponse!=='function')throw new TypeError('WebAuthn verifier dependency required');
 return async function verify({assertion,credential,challenge,expectedOrigin,expectedRpId,requireUserVerification=true}={}){
  if(!assertion||!credential||!credential.publicKey||!credential.id||typeof challenge!=='string'||!challenge||!expectedOrigin||!expectedRpId)throw new Error('Invalid WebAuthn verification inputs');
  const result=await verifyAuthenticationResponse({
   response:assertion,
   expectedChallenge:challenge,
   expectedOrigin,
   expectedRPID:expectedRpId,
   requireUserVerification,
   credential:{id:credential.id,publicKey:credential.publicKey,counter:credential.counter??0,transports:credential.transports}
  });
  if(result?.verified!==true||result.authenticationInfo?.userVerified!==true)throw new Error('WebAuthn assertion not verified');
  if(!Number.isSafeInteger(result.authenticationInfo?.newCounter)||result.authenticationInfo.newCounter<0)throw new Error('Invalid authenticator counter');
  return {verified:true,userVerified:true,newCounter:result.authenticationInfo.newCounter};
 };
}
