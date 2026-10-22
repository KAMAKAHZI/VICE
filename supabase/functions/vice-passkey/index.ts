import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply(405,{error:"METHOD_NOT_ALLOWED"});
 const auth=req.headers.get("authorization");
 if(!auth?.startsWith("Bearer "))return reply(401,{error:"AUTH_REQUIRED"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!key)return reply(503,{error:"AUTH_SERVICE_UNAVAILABLE"});
 const client=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(auth.slice(7));
 if(error||!data.user)return reply(401,{error:"INVALID_SESSION"});
 let input:Record<string,unknown>;
 try{input=await req.json();}catch{return reply(400,{error:"INVALID_JSON"});}
 if(input.operation==="capabilities")return reply(200,{passkeyRegistration:false,passkeyAuthentication:false,transactionAuthorization:false,reason:"WebAuthn attestation and assertion verifier not yet installed. Existing TOTP/AAL2 remains mandatory.",authenticated:true});
 return reply(501,{error:"WEBAUTHN_VERIFIER_NOT_CONFIGURED",message:"Passkey registration and authorization remain disabled until cryptographic WebAuthn verification is installed. Use existing TOTP MFA."});
});