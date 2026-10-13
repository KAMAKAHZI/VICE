// @ts-nocheck
/**
 * VICE OS 1.3.6 — MT5 cloud connector (MetaApi Provisioning; credential handoff).
 * The browser never sends MT5 credentials to VICE. No trade endpoints are exposed.
 * METAAPI_TOKEN must be configured in Supabase Edge Function secrets.
 * Auth: verified Supabase user JWT + owner-scoped registry rows.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const PROVIDER = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const CLIENT_REGION = (Deno.env.get('METAAPI_CLIENT_REGION') || 'new-york').toLowerCase();
const REGIONS = new Set(['new-york','london']);
const SITE_ORIGINS = new Set(['https://vice4x.netlify.app','http://localhost:8888','http://localhost:3000','http://127.0.0.1:5500']);
const TABLE = 'vice_mt5_cloud_accounts';
const U = /^[-_a-zA-Z0-9. ]{2,160}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function reply(body, status=200, origin=''){
 const headers = { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(SITE_ORIGINS.has(origin)) {headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';headers['Access-Control-Allow-Methods']='POST, OPTIONS';}
 return new Response(status===204?null:JSON.stringify(body),{status,headers});
}
async function provider(path, method, payload=null, txn=''){
 const token=Deno.env.get('METAAPI_TOKEN');
 if(!token)throw Object.assign(new Error('Cloud provider is not configured'),{http:503});
 const headers={'auth-token':token,'Accept':'application/json'};
 if(payload)headers['Content-Type']='application/json';
 if(txn)headers['transaction-id']=txn;
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),14000);
 try {
  const r=await fetch(PROVIDER+path,{method,headers,body:payload?JSON.stringify(payload):undefined,signal:ctrl.signal});
  const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={}}
  if(!r.ok && r.status!==202){
   const err=new Error(r.status===401||r.status===403?'Cloud service authorization unavailable':
     (r.status===429?'Cloud provider rate limit':
       (r.status>=500?'Cloud provider temporarily unavailable':
         'Cloud provider refused the request; check broker server and provider dashboard')));
   err.http=r.status===404?404:(r.status===429?429:503);throw err;
  }
  return {http:r.status,data, retryAfter:r.headers.get('retry-after')||null};
 } finally {clearTimeout(timer)}
}
async function metaClientRead(providerId,endpoint){
 const token=Deno.env.get('METAAPI_TOKEN');
 if(!REGIONS.has(CLIENT_REGION))return null;
 const url=`https://mt-client-api-v1.${CLIENT_REGION}.agiliumtrade.ai/users/current/accounts/${encodeURIComponent(providerId)}/${endpoint}`;
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(url,{headers:{'auth-token':token,'Accept':'application/json'},signal:ctrl.signal});
  if(!r.ok)return null;
  return await r.json();
 }catch{return null}finally{clearTimeout(timer)}
}
async function clientInfo(providerId){
 const data=await metaClientRead(providerId,'account-information?refreshTerminalState=true');
 if(!data)return null;
 const balance=Number(data.balance),equity=Number(data.equity);
 if(!Number.isFinite(balance)||!Number.isFinite(equity))return null;
 return {equity,balance,currency:String(data.currency||'USD').toUpperCase().slice(0,8),
   login:String(data.login??'').slice(0,30),broker:String(data.broker||'').slice(0,120),
   server:String(data.server||'').slice(0,120),investorMode:data.investorMode===true?true:null,
   checkedAt:new Date().toISOString()};
}
async function clientPositions(providerId){
 const data=await metaClientRead(providerId,'positions');
 if(!Array.isArray(data))return null;
 return data.slice(0,60).map(x=>({
   ticket:String(x.id||'').slice(0,40),symbol:String(x.symbol||'').slice(0,35),
   side:String(x.type||'').replace('POSITION_TYPE_','').slice(0,12),
   volume:Number.isFinite(Number(x.volume))?Number(x.volume):null,
   open:Number.isFinite(Number(x.openPrice))?Number(x.openPrice):null,
   current:Number.isFinite(Number(x.currentPrice))?Number(x.currentPrice):null,
   profit:Number.isFinite(Number(x.profit))?Number(x.profit):null,
   sl:Number.isFinite(Number(x.stopLoss))?Number(x.stopLoss):null,
   tp:Number.isFinite(Number(x.takeProfit))?Number(x.takeProfit):null
 }));
}
async function ownerRow(db,user,id){
 if(!UUID.test(String(id||'')))throw Object.assign(new Error('Invalid account'),{http:400});
 const {data,error}=await db.from(TABLE).select('id,owner_id,provider_account_id,label,server,account_mode,connection_state,request_nonce,provisioning_transaction_id,created_at').eq('owner_id',user).eq('id',id).maybeSingle();
 if(error)throw Object.assign(new Error('Account registry unavailable'),{http:503});
 if(!data)throw Object.assign(new Error('Account not found'),{http:404});
 return data;
}
function cleanRow(row){return {id:row.id,label:row.label,server:row.server,mode:row.account_mode,
 connectionState:row.connection_state,createdAt:row.created_at};}
Deno.serve(async(req)=>{
 try {
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return reply({},204,origin);
 if(req.method!=='POST')return reply({error:'Method not allowed'},405,origin);
 if(origin && !SITE_ORIGINS.has(origin))return reply({error:'Origin forbidden'},403,origin);
 if(Number(req.headers.get('content-length')||0)>8192)return reply({error:'Request too large'},413,origin);
 const supabaseUrl=Deno.env.get('SUPABASE_URL');
 const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
 const adminKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!supabaseUrl||!anonKey||!adminKey)return reply({error:'Connector backend not configured'},503,origin);
 const bearer=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!bearer)return reply({error:'Sign in to VICE OS first'},401,origin);
 const anon=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:who,error:authError}=await anon.auth.getUser(bearer);
 if(authError||!who?.user?.id)return reply({error:'Invalid or expired VICE session'},401,origin);
 const uid=who.user.id;
 const db=createClient(supabaseUrl,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 let body={};try{body=await req.json()}catch{return reply({error:'Invalid JSON'},400,origin)}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length>12||'password' in body||'token' in body||'login' in body)
  return reply({error:'Never send broker passwords or logins to VICE; use the provider-hosted credential page'},400,origin);
 const action=String(body.action||'status');
 const configured=Boolean(Deno.env.get('METAAPI_TOKEN'));
 if(action==='status'){
  const {count,error}=await db.from(TABLE).select('id',{count:'exact',head:true}).eq('owner_id',uid);
  return reply({configured,provider:'MetaApi',readOnly:true,windowsRequired:false,connectedAccounts:error?null:count,configurationRequired:!configured},200,origin);
 }
 if(action==='list'){
  const {data:rows,error}=await db.from(TABLE).select('id,provider_account_id,label,server,account_mode,connection_state,created_at').eq('owner_id',uid).order('created_at',{ascending:false}).limit(12);
  if(error)return reply({error:'Cloud registry unavailable'},503,origin);
  if(!configured)return reply({configured:false,accounts:(rows||[]).map(cleanRow)},200,origin);
  const accounts=await Promise.all((rows||[]).map(async row=>{
   const result={...cleanRow(row),verified:false,equity:null,balance:null,currency:null};
   if(!row.provider_account_id)return result;
   try{
    const remote=await provider(`/users/current/accounts/${encodeURIComponent(row.provider_account_id)}`,'GET');
    result.connectionState=String(remote.data?.connectionStatus||remote.data?.state||'UNKNOWN').slice(0,35);
    if(result.connectionState==='CONNECTED'){
     const [info,positions]=await Promise.all([clientInfo(row.provider_account_id),clientPositions(row.provider_account_id)]);
     if(info&&/^\d+$/.test(info.login)&&info.server.toLowerCase()===String(row.server).toLowerCase()){
       Object.assign(result,info,{verified:true,connectionState:'CONNECTED',
         positions:positions||[],positionsAvailable:Array.isArray(positions)});
     }
    }
   }catch{result.connectionState='UNAVAILABLE'}
   return result;
  }));
  return reply({configured,accounts,readOnly:true,asOf:new Date().toISOString()},200,origin);
 }
 if(!configured)return reply({error:'MetaApi service token not configured; configure METAAPI_TOKEN in Supabase Edge secrets',configured:false},503,origin);
 if(action==='prepare'){
  const label=String(body.label||'').trim(),server=String(body.server||'').trim(),mode=String(body.mode||'DEMO').toUpperCase(),nonce=String(body.nonce||'');
  if(!U.test(label)||!U.test(server)||!['DEMO','LIVE'].includes(mode)||!UUID.test(nonce))return reply({error:'Enter label, exact MT5 server, mode and a valid request ID'},400,origin);
  const {data:prior}=await db.from(TABLE).select('*').eq('owner_id',uid).eq('request_nonce',nonce).maybeSingle();
  if(prior&&(prior.server!==server||prior.label!==label||prior.account_mode!==mode))return reply({error:'Request ID conflict'},409,origin);
  let row=prior;
  if(!row){
   const {count,error:countError}=await db.from(TABLE).select('id',{count:'exact',head:true}).eq('owner_id',uid);
   if(countError)return reply({error:'Cloud quota cannot be verified'},503,origin);
   if((count||0)>=10)return reply({error:'Ten cloud accounts per member maximum'},429,origin);
   const hourAgo=new Date(Date.now()-3600000).toISOString();
   const {count:recent,error:recentError}=await db.from(TABLE).select('id',{count:'exact',head:true}).eq('owner_id',uid).gte('created_at',hourAgo);
   if(recentError)return reply({error:'Cloud rate limit could not be verified'},503,origin);
   if((recent||0)>=3)return reply({error:'Cloud connection limit: three requests per hour'},429,origin);
   const {data:created,error}=await db.from(TABLE).insert({owner_id:uid,label,server,account_mode:mode,request_nonce:nonce,provisioning_transaction_id:nonce.replaceAll('-','')}).select().single();
   if(error)return reply({error:'Cloud registry could not accept connection'},503,origin);
   row=created;
  }
  let providerId=row.provider_account_id;
  if(!providerId){
   const payload={name:label,server,platform:'mt5',type:'cloud-g2',magic:0,manualTrades:true};
   const {http,data,retryAfter}=await provider('/users/current/accounts','POST',payload,row.provisioning_transaction_id);
   if(http===202)return reply({pending:true,retryAfter:retryAfter||null,id:row.id,message:'Broker settings detection is in progress. Retry this same request in about one minute.'},202,origin);
   providerId=String(data.id||data._id||'');
   if(!/^[a-zA-Z0-9-]{12,90}$/.test(providerId))return reply({error:'Cloud provider did not return an account ID. Refresh and check your provider dashboard.'},502,origin);
   const {error:saving}=await db.from(TABLE).update({provider_account_id:providerId,connection_state:String(data.state||'DRAFT').slice(0,30),updated_at:new Date().toISOString()}).eq('owner_id',uid).eq('id',row.id);
   if(saving)return reply({error:'Account created at cloud provider, but registry update failed. Contact support with request ID.'},503,origin);
  }
  const {data:link}=await provider(`/users/current/accounts/${encodeURIComponent(providerId)}/configuration-link?ttlInDays=1`,'PUT');
  const raw=String(link?.configurationLink||'');let u;try{u=new URL(raw)}catch{}
  if(!u||u.protocol!=='https:'||u.hostname!=='app.metaapi.cloud')return reply({error:'Cloud provider supplied an untrusted configuration link'},503,origin);
  return reply({id:row.id,pending:false,configurationUrl:u.href,provider:'MetaApi',readOnly:true,
   message:'Use your MT5 investor (read-only) password on the provider site. VICE never receives it.'},200,origin);
 }
 if(action==='configuration-link'){
  const row=await ownerRow(db,uid,body.id);
  if(!row.provider_account_id)return reply({error:'Provider account not created; retry preparation'},409,origin);
  const {data:link}=await provider(`/users/current/accounts/${encodeURIComponent(row.provider_account_id)}/configuration-link?ttlInDays=1`,'PUT');
  const raw=String(link?.configurationLink||'');let u;try{u=new URL(raw)}catch{}
  if(!u||u.protocol!=='https:'||u.hostname!=='app.metaapi.cloud')return reply({error:'Provider URL validation failed'},503,origin);
  return reply({configurationUrl:u.href,provider:'MetaApi',message:'Use the official provider page to enter your MT5 investor password.'},200,origin);
 }
 if(action==='deploy'){
  const row=await ownerRow(db,uid,body.id);
  if(!row.provider_account_id)return reply({error:'Provider account not prepared'},409,origin);
  await provider(`/users/current/accounts/${encodeURIComponent(row.provider_account_id)}/deploy`,'POST');
  await db.from(TABLE).update({connection_state:'DEPLOYED',updated_at:new Date().toISOString()}).eq('owner_id',uid).eq('id',row.id);
  return reply({ok:true,message:'Cloud provider deployment requested. Refresh after broker authentication.'},200,origin);
 }
 if(action==='remove'){
  const row=await ownerRow(db,uid,body.id);
  if(body.confirm!=='DELETE_CLOUD_ACCOUNT')return reply({error:'Explicit DELETE_CLOUD_ACCOUNT confirmation required'},400,origin);
  if(row.provider_account_id){
   try{await provider(`/users/current/accounts/${encodeURIComponent(row.provider_account_id)}?executeForAllReplicas=true`,'DELETE')}
   catch(e){if(e.http!==404)throw e;}
  }
  const {error}=await db.from(TABLE).delete().eq('owner_id',uid).eq('id',row.id);
  if(error)return reply({error:'Provider account deletion may have completed, but registry removal failed'},503,origin);
  return reply({ok:true,message:'Cloud connection removed from provider and VICE portfolio'},200,origin);
 }
 return reply({error:'Unknown connector action'},400,origin);
 } catch(error) {
  return reply({error:(error && typeof error.message==='string' ? error.message.slice(0,200) : 'MT5 cloud connector unavailable')},Number(error?.http||503),req.headers.get('origin')||'');
 }
});
