'use strict';
/**
 * Execute the committed, deployed fail-closed WebAuthn placeholder with mocked
 * Supabase authentication. This is a boundary test, NOT a passkey verifier test.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const file=path.join(__dirname,'../supabase/functions/vice-passkey/index.ts');
const source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'');
const code=stripTypeScriptTypes(source);
function harness({user={id:'synthetic-user'},url=true,key=true}={}){
 let handler;
 const observed=[];
 const client={auth:{getUser:async token=>{
  observed.push(token);
  return user?{data:{user},error:null}:{data:{user:null},error:{message:'invalid session'}};
 }}};
 const Deno={env:{get:name=>name==='SUPABASE_URL'&&url?'https://project.example.test':name==='SUPABASE_ANON_KEY'&&key?'synthetic-public-key':undefined},serve:fn=>{handler=fn}};
 new Function('Deno','createClient',code)(Deno,(_url,_key,_options)=>client);
 const request=(operation,options={})=>handler(new Request('https://project.example.test/functions/v1/vice-passkey',{
  method:options.method||'POST',
  headers:{...(options.noAuth?{}:{authorization:options.authorization||'Bearer synthetic-session'}),'content-type':'application/json'},
  ...((options.method||'POST')==='GET'?{}:{body:options.rawBody??JSON.stringify({operation})})
 }));
 return {request,observed};
}
test('passkey stub requires POST and a bearer session',async()=>{
 const h=harness();
 assert.equal((await h.request('capabilities',{method:'GET'})).status,405);
 assert.equal((await h.request('capabilities',{noAuth:true})).status,401);
 assert.equal(h.observed.length,0);
});
test('passkey stub refuses absent service configuration and invalid sessions',async()=>{
 assert.equal((await harness({url:false}).request('capabilities')).status,503);
 assert.equal((await harness({key:false}).request('capabilities')).status,503);
 assert.equal((await harness({user:null}).request('capabilities')).status,401);
});
test('passkey stub reports all WebAuthn capabilities disabled only after authentication',async()=>{
 const h=harness();
 const response=await h.request('capabilities');
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.authenticated,true);
 for(const key of ['passkeyRegistration','passkeyAuthentication','transactionAuthorization'])assert.equal(body[key],false,key+' must be disabled');
 assert.deepEqual(h.observed,['synthetic-session']);
 assert.match(body.reason,/TOTP\/AAL2/);
});
test('passkey stub fails closed for registration, assertion and malformed JSON',async()=>{
 const h=harness();
 for(const operation of ['register','authenticate','authorize_transaction','invalid_operation']){
  const response=await h.request(operation);
  assert.equal(response.status,501,operation);
  assert.equal((await response.json()).error,'WEBAUTHN_VERIFIER_NOT_CONFIGURED');
 }
 const malformed=await h.request(null,{rawBody:'{not-json'});
 assert.equal(malformed.status,400);
 assert.equal((await malformed.json()).error,'INVALID_JSON');
});
