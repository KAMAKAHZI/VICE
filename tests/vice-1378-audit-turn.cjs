'use strict';
// Offline, deterministic server-side entitlement regression. No real sessions.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const oldFetch=global.fetch;
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','TURN_SHARED_SECRET','TURN_HOSTNAME'];
  const oldEnv=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_ANON_KEY='public-test-key';
  process.env.TURN_SHARED_SECRET='a'.repeat(48);
  process.env.TURN_HOSTNAME='relay.test.invalid';
  const {handler}=await import(pathToFileURL(path.resolve('netlify/functions/turn-credentials.mjs')));
  const id='12345678-1234-1234-1234-123456789abc';
  const event={httpMethod:'GET',headers:{authorization:'Bearer test.session.jwt'}};
  function respond(status,value){return {ok:status>=200&&status<300,status,
    async json(){return value}}}
  function mock(authorized,rows,status=200){
    const requests=[];
    global.fetch=async (url,init)=>{
      requests.push({url:String(url),headers:init.headers});
      if(String(url).endsWith('/auth/v1/user')){
        return authorized ? respond(200,{id}):respond(401,{error:'invalid token'});
      }
      assert(String(url).includes('/rest/v1/profiles'),'Must check profile membership');
      assert.equal(init.headers.Authorization,'Bearer test.session.jwt');
      assert(String(url).includes(encodeURIComponent('eq.'+id))||
        String(url).includes('eq.'+id));
      return respond(status,rows);
    };
    return requests;
  }
  try{
    let r=await handler({httpMethod:'POST',headers:{}});
    assert.equal(r.statusCode,405);
    r=await handler({httpMethod:'GET',headers:{}});
    assert.equal(r.statusCode,401,'No bearer token, no relay access');
    let requests=mock(false,[]);
    r=await handler(event);
    assert.equal(r.statusCode,401);
    assert.equal(requests.length,1,'Bad token must never query membership');
    requests=mock(true,[]);
    r=await handler(event);
    assert.equal(r.statusCode,403,'Uninvited valid Supabase accounts must be denied');
    assert.equal(requests.length,2);
    requests=mock(true,[{id}],200);
    r=await handler(event);
    assert.equal(r.statusCode,200,'Approved VICE member may receive temporary relay creds');
    const ok=JSON.parse(r.body);
    assert.equal(ok.iceServers.length,1);
    assert(ok.iceServers[0].username.includes(id));
    assert(ok.iceServers[0].credential.length>20);
    assert.equal(r.headers['cache-control'],'no-store');
    requests=mock(true,null,503);
    r=await handler(event);
    assert.equal(r.statusCode,503,'Membership gateway failure must fail closed');
    console.log('PASS TURN 6 offline outcomes — invite check, 401/403/503 and signed 10m credentials');
  }finally{
    global.fetch=oldFetch;
    for(const [k,v] of Object.entries(oldEnv)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1});
