import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13.2.2";
const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const rpID=Deno.env.get("VICE_WEBAUTHN_RP_ID")||"vice4x.netlify.app";
const origin=Deno.env.get("VICE_WEBAUTHN_ORIGIN")||"https://vice4x.netlify.app";
const enc=new TextEncoder();
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",enc.encode(value));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");}
function b64(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function fromB64(s:string){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply(405,{error:"METHOD_NOT_ALLOWED"});
 const auth=req.headers.get("authorization");
 if(!auth?.startsWith("Bearer "))return reply(401,{error:"AUTH_REQUIRED"});
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon)return reply(503,{error:"AUTH_SERVICE_UNAVAILABLE"});
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await client.auth.getUser(auth.slice(7));
 if(userError||!userData.user)return reply(401,{error:"INVALID_SESSION"});
 let input:Record<string,unknown>;try{input=await req.json();}catch{return reply(400,{error:"INVALID_JSON"});}
 if(input.operation==="capabilities")return reply(200,{passkeyRegistration:false,passkeyAuthentication:false,transactionAuthorization:false,authenticated:true,reason:"Enrollment challenge issuance is staged; verification and atomic persistence must pass staging tests before activation."});
 if(!["register_options","register_verify"].includes(String(input.operation)))return reply(501,{error:"WEBAUTHN_VERIFICATION_NOT_READY"});
 if(!service)return reply(503,{error:"CREDENTIAL_STORE_UNAVAILABLE"});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error:profileError}=await admin.from("profiles").select("role").eq("id",userData.user.id).maybeSingle();
 if(profileError||!profile||!["SUPER_ADMIN","FINANCE_OFFICER"].includes(String(profile.role)))return reply(403,{error:"EXECUTIVE_ROLE_REQUIRED"});
 if(input.operation==="register_verify"){
  const challengeId=String(input.challengeId||"");
  const response=input.response as Record<string,unknown>|undefined;
  if(!/^[0-9a-f-]{36}$/i.test(challengeId)||!response||typeof response!=="object")return reply(400,{error:"INVALID_REGISTRATION_PAYLOAD"});
  const {data:record,error:lookupError}=await admin.from("vice_passkey_challenges")
   .select("id,challenge_hash,expires_at,consumed_at").eq("id",challengeId).eq("user_id",userData.user.id).eq("purpose","REGISTER").maybeSingle();
  if(lookupError||!record||record.consumed_at||Date.parse(record.expires_at)<=Date.now())return reply(409,{error:"CHALLENGE_INVALID_OR_EXPIRED"});
  let challenge:string;
  try{
   const raw=(response.response as Record<string,unknown>)?.clientDataJSON;
   if(typeof raw!=="string")throw Error("missing client data");
   const clientData=JSON.parse(new TextDecoder().decode(fromB64(raw)));
   if(clientData.type!=="webauthn.create"||typeof clientData.challenge!=="string")throw Error("wrong ceremony");
   challenge=clientData.challenge;
  }catch{return reply(400,{error:"INVALID_CLIENT_DATA"});}
  if(await sha256(challenge)!==record.challenge_hash)return reply(403,{error:"CHALLENGE_MISMATCH"});
  // Consume atomically before expensive verification; failures require a fresh challenge.
  const {data:consumed,error:consumeError}=await admin.rpc("vice_passkey_consume_challenge",{
   p_challenge_id:challengeId,p_user_id:userData.user.id,p_purpose:"REGISTER",
   p_hash:record.challenge_hash,p_action_digest:null
  });
  if(consumeError||consumed!==true)return reply(409,{error:"CHALLENGE_ALREADY_USED"});
  try{
   const verified=await verifyRegistrationResponse({
    response:response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge:challenge,expectedOrigin:origin,expectedRPID:rpID,
    requireUserVerification:true
   });
   if(!verified.verified||!verified.registrationInfo)return reply(403,{error:"REGISTRATION_NOT_VERIFIED"});
   const info=verified.registrationInfo;
   const {error:storeError}=await admin.from("vice_passkey_credentials").insert({
    user_id:userData.user.id,credential_id:info.credential.id,
    public_key_cose:b64(info.credential.publicKey),sign_count:info.credential.counter,
    transports:Array.isArray((response.response as Record<string,unknown>)?.transports)?(response.response as Record<string,unknown>).transports:[],
    device_label:"Passkey"
   });
   if(storeError)return reply(409,{error:"CREDENTIAL_PERSISTENCE_FAILED"});
   return reply(200,{verified:true,credentialRegistered:true});
  }catch{return reply(403,{error:"WEBAUTHN_ATTESTATION_REJECTED"});}
 }
 const {data:credentials,error:credentialError}=await admin.from("vice_passkey_credentials").select("credential_id,transports").eq("user_id",userData.user.id).is("revoked_at",null).limit(50);
 if(credentialError)return reply(503,{error:"CREDENTIAL_LOOKUP_FAILED"});
 const options=await generateRegistrationOptions({
 rpName:"VICE OS",rpID,userName:userData.user.email||userData.user.id,userID:enc.encode(userData.user.id),
 timeout:180000,attestationType:"none",
 excludeCredentials:(credentials||[]).map((c:{credential_id:string;transports:string[]})=>({id:c.credential_id,transports:c.transports as AuthenticatorTransport[]})),
 authenticatorSelection:{residentKey:"preferred",userVerification:"required"},supportedAlgorithmIDs:[-7,-257]
 });
 const hash=await sha256(options.challenge);
 const {data:challenge,error:insertError}=await admin.from("vice_passkey_challenges").insert({
 user_id:userData.user.id,challenge_hash:hash,purpose:"REGISTER",expires_at:new Date(Date.now()+180000).toISOString()
 }).select("id").single();
 if(insertError||!challenge)return reply(503,{error:"CHALLENGE_STORE_FAILED"});
 return reply(200,{...options,challengeId:challenge.id});
});
