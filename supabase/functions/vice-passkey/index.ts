import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13.2.2";
const JSON_HEADERS={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const rpID=Deno.env.get("VICE_WEBAUTHN_RP_ID")||"vice4x.netlify.app";
const origin=Deno.env.get("VICE_WEBAUTHN_ORIGIN")||"https://vice4x.netlify.app";
const toBase64Url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromBase64Url=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return respond(405,{error:"METHOD_NOT_ALLOWED"});
 const auth=req.headers.get("authorization");
 if(!auth?.startsWith("Bearer "))return respond(401,{error:"AUTH_REQUIRED"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!key)return respond(503,{error:"AUTH_SERVICE_UNAVAILABLE"});
 const client=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(auth.slice(7));
 if(error||!data.user)return respond(401,{error:"INVALID_SESSION"});
 let input:Record<string,unknown>;
 try{input=await req.json();}catch{return respond(400,{error:"INVALID_JSON"});}
 // Fail-closed while challenge persistence, atomic consume and transaction binding are integrated.
 if(input.operation==="capabilities")return respond(200,{
  passkeyRegistration:false,passkeyAuthentication:false,transactionAuthorization:false,
  verifierLibrary:"@simplewebauthn/server@13.2.2",
  reason:"Cryptographic verifier installed in source; durable single-use challenge lifecycle not yet wired.",
  authenticated:true
 });
 return respond(501,{error:"WEBAUTHN_CHALLENGE_LIFECYCLE_NOT_CONFIGURED",
 message:"Passkeys cannot be enabled until server-side challenge issuance, atomic consumption, and credential persistence are verified. Continue using TOTP."});
});
