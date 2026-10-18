// Private source delivery. Generated release.ts is deployed to Supabase only;
// proprietary MQL/Pine sources never enter the public web root or public Git tree.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { release } from './release.ts';
const ORIGIN='https://vice4x.netlify.app';
const headers=(origin:string)=>({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',
 ...(origin===ORIGIN?{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Expose-Headers':'Content-Disposition, X-Content-SHA256'}:{})});
export async function authorizeSource(client:any){
 const user=await client.auth.getUser();if(user.error||!user.data?.user)return {status:401,error:'Sign in required'};
 const access=await client.rpc('vice_member_access_status');if(access.error)return {status:503,error:'Membership verification unavailable'};
 if(access.data?.allowed!==true)return {status:403,error:'Active membership required'};
 const p=await client.from('profiles').select('id,role').eq('id',user.data.user.id).maybeSingle();
 if(p.error)return {status:503,error:'Role verification unavailable'};
 if(user.data.user.id!=='6e83b6bc-e247-41fc-8469-4267987273b7'||p.data?.role!=='SUPER_ADMIN')return {status:403,error:'Proprietary source downloads require founder authorization'};
 return null;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',h=headers(origin);
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...h,'Content-Type':'application/json'}});
 if(origin&&origin!==ORIGIN)return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 if(req.method!=='POST')return json({error:'POST required'},405);
 if(Number(req.headers.get('content-length')||0)>4096)return json({error:'Request too large'},413);
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return json({error:'Sign in required'},401);
 try{
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const denied=await authorizeSource(client);if(denied)return json({error:denied.error},denied.status);
  const body=await req.json();
  if(body.action==='list')return json({version:'2026-10-18',nativeCompilation:'NOT_EXECUTED',files:release.map(({base64,...meta})=>meta)});
  if(body.action!=='download')return json({error:'Unknown action'},400);
  const file=release.find(f=>f.name===body.name);if(!file)return json({error:'Unknown source file'},404);
  const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{...h,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.name}"`,'X-Content-SHA256':file.sha256}});
 }catch{return json({error:'Source request could not be completed'},500);}
});
