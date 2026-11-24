"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {handler}=require("../netlify/functions/vice-prime-gate.js");
const id="11111111-1111-4111-8111-111111111111";
const token=(overrides={})=>["eyJhbGciOiJIUzI1NiJ9",Buffer.from(JSON.stringify({sub:id,aal:"aal2",role:"authenticated",iss:"https://example.supabase.co/auth/v1",exp:Math.floor(Date.now()/1000)+1000,...overrides})).toString("base64url"),"testsignature"].join(".");
const request=t=>({httpMethod:"GET",headers:{authorization:"Bearer "+t}});
test("UI scripts parse and preview is isolated from live execution",()=>{
 const html=fs.readFileSync("executive-prime.html","utf8");
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert.match(html,/SIMULATION ONLY/);
 assert.match(html,/vice-prime-gate/);
 assert.match(fs.readFileSync("scripts/vice-publish-netlify.sh","utf8"),/executive-prime\.html/);
});
test("authorization denies missing config, anonymous, lower assurance, wrong identity, expired or rejected tokens",async()=>{
 const originalFetch=global.fetch;
 const names=["SUPABASE_URL","SUPABASE_ANON_KEY","VICE_PRIME_EXECUTIVE_IDS"];
 const saved=names.map(n=>process.env[n]);
 try{
  for(const n of names)delete process.env[n];
  assert.equal((await handler(request(token()))).statusCode,503);
  Object.assign(process.env,{SUPABASE_URL:"https://example.supabase.co",SUPABASE_ANON_KEY:"test",VICE_PRIME_EXECUTIVE_IDS:id});
  assert.equal((await handler({httpMethod:"GET",headers:{}})).statusCode,401);
  assert.equal((await handler({httpMethod:"POST",headers:{}})).statusCode,405);
  global.fetch=async()=>({ok:false,status:401});
  assert.equal((await handler(request(token()))).statusCode,401);
  global.fetch=async()=>({ok:true,json:async()=>({id})});
  assert.equal((await handler(request(token({aal:"aal1"})))).statusCode,403);
  assert.equal((await handler(request(token({exp:0})))).statusCode,403);
  assert.equal((await handler(request(token({sub:"different"})))).statusCode,403);
  global.fetch=async()=>({ok:true,json:async()=>({id,is_anonymous:true})});
  assert.equal((await handler(request(token()))).statusCode,403);
  global.fetch=async()=>({ok:true,json:async()=>({id})});
  const success=await handler(request(token()));
  assert.equal(success.statusCode,200);
  assert.deepEqual(JSON.parse(success.body),{authorized:true,mode:"PAPER"});
 }finally{global.fetch=originalFetch;names.forEach((n,i)=>saved[i]===undefined?delete process.env[n]:process.env[n]=saved[i])}
});
