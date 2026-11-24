"use strict";
// Read-only authorization for the synthetic VICE PRIME dashboard.
// No broker keys, orders, real account data or mutations are exposed.
const headers={"Content-Type":"application/json","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow, noarchive"};
const respond=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
exports.handler=async function(event){
  if(event.httpMethod!=="GET")return respond(405,{authorized:false});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
  const allowed=(process.env.VICE_PRIME_EXECUTIVE_IDS||"").split(",").map(x=>x.trim()).filter(x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x));
  if(!url||!key||!allowed.length)return respond(503,{authorized:false});
  const authorization=event.headers?.authorization||event.headers?.Authorization||"";
  const m=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
  if(!m||m[1].length>16000)return respond(401,{authorized:false});
  try{
    const base=new URL(url);
    if(base.protocol!=="https:"||base.username||base.password||base.search||base.hash)return respond(503,{authorized:false});
    const token=m[1];
    const r=await fetch(new URL("/auth/v1/user",base),{headers:{apikey:key,Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(6000)});
    if(!r.ok)return respond(r.status===401||r.status===403?401:503,{authorized:false});
    const user=await r.json();
    // Only decode after the Auth server has authenticated this exact token.
    const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
    if(!user.id||claims.sub!==user.id||!allowed.includes(user.id)||claims.aal!=="aal2"||claims.role!=="authenticated"||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000||claims.iss!==base.origin+"/auth/v1"||user.is_anonymous)return respond(403,{authorized:false});
    return respond(200,{authorized:true,mode:"PAPER"});
  }catch{return respond(503,{authorized:false})}
};
