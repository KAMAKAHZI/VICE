import {createClient} from 'npm:@supabase/supabase-js@2.49.4';
import './core.js';
const core=(globalThis as any).ViceInstitutionalCore;
const origin='https://vice4x.netlify.app';
async function remote(url:string,options:any){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(url,{...options,signal:c.signal});if(!r.ok)throw Error(r.status===429?'Provider rate limit; retry later':'Provider request failed (HTTP '+r.status+')');return await r.json();}finally{clearTimeout(t);}
}
Deno.serve(async(req:Request)=>{
 const h={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:h});
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 if(req.method!=='POST')return json({error:'POST required'},405);
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
 try{
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const u=await client.auth.getUser();if(u.error||!u.data.user)return json({error:'Session expired'},401);
  const a=await client.rpc('vice_institutional_access');if(a.error||a.data!==true)return json({error:'Active CEO/CFO access required'},403);
  const text=await req.text();if(text.length>64000)return json({error:'Request too large'},413);const body=JSON.parse(text);
  const apollo=Deno.env.get('APOLLO_API_KEY');
  const mailReady=!!(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('OMEGA_FROM_EMAIL')&&Deno.env.get('OMEGA_POSTAL_ADDRESS')&&Deno.env.get('OMEGA_REPLY_TO'));
  const rpc=async(name:string,args:any)=>{const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
  if(body.action==='status')return json({apollo_configured:!!apollo,email_configured:mailReady,quorum_verifier_configured:false,executor_configured:false,live_trading:false});
  if(body.action==='verify_signature'){
   const c=await client.from('vice_exec_challenges').select('*').eq('id',body.challenge_id).eq('user_id',u.data.user.id).maybeSingle();
   if(c.error||!c.data||c.data.used_at||Date.parse(c.data.expires_at)<=Date.now())return json({error:'Signature challenge expired or unavailable'},409);
   const s=await client.from('vice_exec_signers').select('*').eq('user_id',u.data.user.id).maybeSingle();
   if(s.error||!s.data)return json({error:'Designated signer required'},403);
   const key=c.data.action==='ENROLL'?c.data.public_key:s.data.public_key;
   if(!await core.verifySignature(key,c.data.message,body.signature))return json({error:'Cryptographic signature verification failed'},422);
   const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const done=await admin.rpc('vice_exec_finish',{p_challenge:c.data.id,p_actor:u.data.user.id,p_signature:body.signature});
   if(done.error)throw Error(done.error.message);return json(done.data);
  }
  if(body.action==='import_apollo'){
   if(!apollo)return json({error:'APOLLO_API_KEY is not configured in Supabase Edge Function secrets'},503);
   const page=Number(body.page||1);if(!Number.isInteger(page)||page<1||page>500)return json({error:'Page must be 1–500'},400);
   await rpc('vice_omega_provider_limit',{});
   const headers={'Content-Type':'application/json','x-api-key':apollo,'accept':'application/json'};
   const search=new URL('https://api.apollo.io/api/v1/mixed_people/api_search');
   for(const title of ['Chief Financial Officer','VP of Corporate Treasury','Managing Partner','Chief Investment Officer'])search.searchParams.append('person_titles[]',title);
   for(const range of ['50,200','200,500','500,1000'])search.searchParams.append('organization_num_employees_ranges[]',range);
   search.searchParams.set('contact_email_status[]','verified');search.searchParams.set('page',String(page));search.searchParams.set('per_page','10');
   const data=await remote(search.href,{method:'POST',headers});
   if(!Array.isArray(data.people))throw Error('Apollo returned an invalid search result');
   let imported=0;const failures=[];
   for(const preview of data.people.slice(0,10)){
    try{
     const personId=preview.id||preview.person_id;
     if(typeof personId!=='string')throw Error('Missing provider identity');
     const match=new URL('https://api.apollo.io/api/v1/people/match');match.searchParams.set('id',personId);match.searchParams.set('reveal_personal_emails','false');match.searchParams.set('reveal_phone_number','false');
     const person=await remote(match.href,{method:'POST',headers});
     if(!person.person?.id)throw Error('Provider enrichment unavailable');
     const lead=core.normalizeLead(person.person,'APOLLO');
     const id=await rpc('vice_omega_save_lead',{p_record:lead});
     const draft=core.outreach(lead);await rpc('vice_omega_draft',{p_lead:id,p_subject:draft.subject,p_body:draft.body});imported++;
    }catch(e){failures.push(String((e as Error).message).slice(0,180));}
   }
   return json({imported,failed:failures.length,errors:failures,next_page:data.people.length===10?page+1:null,queued_for_review:true,sent:0});
  }
  if(body.action==='send'){
   if(!mailReady)return json({error:'Email requires RESEND_API_KEY, OMEGA_FROM_EMAIL, OMEGA_REPLY_TO and OMEGA_POSTAL_ADDRESS in Edge Function secrets'},503);
   const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const deliver=async(args:any)=>{const r=await admin.rpc('vice_omega_delivery',{p_id:body.id,p_actor:u.data.user.id,...args});if(r.error)throw Error(r.error.message);return r.data;};
   const delivery=await deliver({p_action:'CLAIM'});
   const address=Deno.env.get('OMEGA_POSTAL_ADDRESS')!,reply=Deno.env.get('OMEGA_REPLY_TO')!;
   try{
    const result=await remote('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'vice-omega-'+body.id},body:JSON.stringify({from:Deno.env.get('OMEGA_FROM_EMAIL'),to:[delivery.email],reply_to:reply,subject:delivery.subject,text:delivery.body+'\n\nVice Capital Inc. · '+address,headers:{'List-Unsubscribe':'<mailto:'+reply+'?subject=Unsubscribe>'}})});
    if(!result.id)throw Error('Provider receipt unavailable');
    await deliver({p_action:'FINISH',p_provider_id:result.id,p_error:null});
    return json({accepted:true,provider_id:result.id,delivered:false});
   }catch(e){await deliver({p_action:'FINISH',p_provider_id:null,p_error:'Provider outcome unconfirmed; reconcile before retry'});throw e;}
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:String((e as Error).message).slice(0,250)},400);}
});
