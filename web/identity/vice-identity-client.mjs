// VICE OS Identity Engine — connected API transport.
// This client uses the current Supabase session and the deployed vice-passkey Edge Function.
// It refuses to launch WebAuthn until the server explicitly reports cryptographic readiness.
import { registerPasskey, authenticatePasskey } from "./webauthn-client.mjs";
const OPERATIONS=Object.freeze({
 capabilities:"capabilities",
 registerOptions:"register_options",
 registerVerify:"register_verify",
 authenticateOptions:"authenticate_options",
 authenticateVerify:"authenticate_verify",
 authorizeOptions:"authorize_options",
 authorizeVerify:"authorize_verify"
});
export class ViceIdentityClient {
 constructor(supabase){if(!supabase?.functions?.invoke||!supabase?.auth?.getSession)throw new TypeError("Supabase client required");this.sb=supabase;}
 async invoke(operation,payload={}){
  if(!Object.values(OPERATIONS).includes(operation))throw new TypeError("Unknown identity operation");
  const {data:sessionData,error:sessionError}=await this.sb.auth.getSession();
  if(sessionError||!sessionData?.session?.access_token)throw new Error("AUTH_REQUIRED");
  const {data,error}=await this.sb.functions.invoke("vice-passkey",{
   body:{operation,...payload},headers:{Authorization:`Bearer ${sessionData.session.access_token}`}
  });
  if(error)throw new Error(error.message||"IDENTITY_SERVICE_ERROR");
  if(data?.error)throw new Error(data.error);
  return data;
 }
 async capabilities(){return this.invoke(OPERATIONS.capabilities);}
 async enroll(label){
  const caps=await this.capabilities();
  if(caps?.passkeyRegistration!==true)throw new Error("WEBAUTHN_VERIFIER_NOT_CONFIGURED");
  const options=await this.invoke(OPERATIONS.registerOptions,{label});
  const response=await registerPasskey(options,caps);
  return this.invoke(OPERATIONS.registerVerify,{response,challengeId:options.challengeId,label});
 }
 async authenticate(){
  const caps=await this.capabilities();
  if(caps?.passkeyAuthentication!==true)throw new Error("WEBAUTHN_VERIFIER_NOT_CONFIGURED");
  const options=await this.invoke(OPERATIONS.authenticateOptions);
  const response=await authenticatePasskey(options,caps);
  return this.invoke(OPERATIONS.authenticateVerify,{response,challengeId:options.challengeId});
 }
 async authorizeProposal({proposalId,payloadHash,role,action="APPROVE"}){
  if(!proposalId||!payloadHash||!["CEO","CFO"].includes(role)||!["APPROVE","REJECT"].includes(action))throw new TypeError("Invalid authorization parameters");
  const caps=await this.capabilities();
  if(caps?.transactionAuthorization!==true)throw new Error("WEBAUTHN_VERIFIER_NOT_CONFIGURED");
  const context={proposalId,payloadHash,role,action};
  const options=await this.invoke(OPERATIONS.authorizeOptions,context);
  const response=await authenticatePasskey(options,caps,{transaction:true});
  return this.invoke(OPERATIONS.authorizeVerify,{...context,response,challengeId:options.challengeId});
 }
}
