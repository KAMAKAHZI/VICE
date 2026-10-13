import { createHmac } from 'node:crypto';
const json=(statusCode,obj)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'https://vice4x.netlify.app','vary':'origin'},body:JSON.stringify(obj)});
export async function handler(event){
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  const header=event.headers.authorization||event.headers.Authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  const url=process.env.SUPABASE_URL;
  const anon=process.env.SUPABASE_ANON_KEY;
  const secret=process.env.TURN_SHARED_SECRET;
  const hostname=process.env.TURN_HOSTNAME;
  if(!url||!anon||!secret||!hostname)return json(503,{error:'TURN not provisioned'});
  if(secret.length<32)return json(503,{error:'TURN secret too short'});
  if(!token)return json(401,{error:'Authentication required'});
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
    let auth;
    try {auth=await fetch(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{'Authorization':'Bearer '+token,'apikey':anon},signal:controller.signal});}
    finally {clearTimeout(timer);}
    if(!auth.ok)return json(401,{error:'Invalid Supabase session'});
    const user=await auth.json();if(!user.id || !/^[a-f0-9-]{36}$/i.test(user.id))return json(401,{error:'Missing identity'});
    // Supabase Auth users without a provisioned VICE OS profile are not
    // invited members and must not consume the operator's paid TURN relay.
    const membershipUrl=new URL(url.replace(/[/]+$/,'')+'/rest/v1/profiles');
    membershipUrl.searchParams.set('select','id');
    membershipUrl.searchParams.set('id','eq.'+user.id);
    membershipUrl.searchParams.set('limit','1');
    const member=await fetch(membershipUrl,{
      headers:{'Authorization':'Bearer '+token,'apikey':anon,'Accept':'application/json'},
      signal:controller.signal
    });
    if(!member.ok)return json(503,{error:'Membership verification unavailable'});
    const rows=await member.json();
    if(!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==user.id)
      return json(403,{error:'Approved VICE membership required'});
    const expires=Math.floor(Date.now()/1000)+600;
    const username=`${expires}:${user.id}`;
    const credential=createHmac('sha1',secret).update(username).digest('base64');
    return json(200,{iceServers:[{urls:[`turn:${hostname}:3478?transport=udp`,`turn:${hostname}:3478?transport=tcp`],username,credential}],expires});
  }catch(e){return json(502,{error:'TURN auth lookup temporarily unavailable'});}
}
