import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';
const root=path.resolve('dist/site');const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),f=p===root?path.join(root,'index.html'):p;if(!f.startsWith(root+'/')){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.VICE_CHROMIUM_PATH?{executablePath:process.env.VICE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.supabase.co/functions/v1/vice-institutional',async route=>{const b=route.request().postDataJSON();const result=b.action==='verify_signature'?{verified:true,action:'ENROLL'}:{apollo_configured:false,email_configured:false};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.locator('#loginForm').waitFor();
 await page.evaluate(()=>{
  enterSimMode();Realtime.disconnect();authEpoch++;S.user={id:'00000000-0000-4000-8000-000000000001',email:'synthetic@example.test'};S.profile={...S.profile,name:'Synthetic executive',role:'SUPER_ADMIN'};APP_MODE='LIVE';
  const leads=[],drafts=[],rows={vice_omega_leads:leads,vice_omega_outreach:drafts,vice_omega_financings:[],vice_sovereign_proposals:[{id:'PROP-2026-10-ELITE-SCALE-003',payload:{parameters:{previous_baseline:{vice_ouv:2.5,v4x_ouv:400},target_scaled_tier:{vice_ouv:25,v4x_ouv:4000}}},payload_hash:'a'.repeat(64),validation_issues:['BASELINE_MISMATCH'],status:'REVIEW',validation_until:new Date(Date.now()+72*3600000).toISOString()}],vice_exec_signers:[{role:'CEO',user_id:S.user.id,public_key:null}]};window.__instCalls=[];
  sb={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-no-production-session'}}})},from:t=>({select(){return this},eq(column,value){this.column=column;this.value=value;return this},maybeSingle:async function(){if(t!=='vice_exec_signers'||this.column!=='user_id')throw Error('Unexpected single-row query '+t+'.'+this.column);return {data:(rows[t]||[]).find(x=>x.user_id===this.value)||null,error:null}},limit:async()=>({data:rows[t]||[]})}),rpc:async(name,args)=>{window.__instCalls.push({name,args});if(name==='vice_institutional_diagnostics')return {data:{reference:{vice_price:2,v4x_price:320},checked_at:new Date().toISOString(),audit_chain_ok:true,audit_events:1,ratio_ok:true,structural_writes_locked:true,onchain_quorum:'NOT_CONFIGURED',zero_leakage:'NOT_CERTIFIED'}};if(name==='vice_omega_save_lead'){leads.push({...args.p_record,id:'00000000-0000-4000-8000-000000000011',updated_at:new Date().toISOString()});return {data:leads.at(-1).id};}if(name==='vice_omega_draft'){drafts.push({id:'00000000-0000-4000-8000-000000000012',lead_id:args.p_lead,subject:args.p_subject,body:args.p_body,status:'DRAFT'});return {data:drafts.at(-1).id};}if(name==='vice_exec_challenge')return {data:{id:crypto.randomUUID(),message:'VICE4X-SOVEREIGN|synthetic-test-challenge'}};return {data:{}};}};go('omega');
 });
 await page.waitForFunction(()=>document.querySelector('#view')?.textContent.includes('Manual records are available now.'));
 await page.locator('#inst-model [name="grossProfit"]').fill('150000');await page.locator('#inst-model [name="costs"]').fill('10000');await page.locator('#inst-model [name="lossCarry"]').fill('5000');assert.match(await page.locator('#inst-model-output').textContent(),/63,375/);assert.match(await page.locator('#inst-model-output').textContent(),/37,500/);
 assert.equal(await page.locator('[data-inst="apollo"]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('#toasts .tst:not(.err)')).every(el=>getComputedStyle(el).pointerEvents==='none')),true,'Toast notifications must not intercept touch/click actions');
 // Errors remain accessible, are dismissible by keyboard, and cannot swallow unrelated taps.
 await page.evaluate(()=>toast('Synthetic executive authentication failure','error'));
 const errorToast=page.locator('#toasts .tst.err').filter({hasText:'Synthetic executive authentication failure'});
 await errorToast.waitFor();
 assert.equal(await errorToast.getAttribute('role'),'alert');
 assert.equal(await errorToast.getAttribute('aria-live'),'assertive');
 assert.match(await errorToast.textContent(),/Synthetic executive authentication failure/);
 const closeError=errorToast.getByRole('button',{name:'Dismiss error notification'});
 await closeError.focus();
 assert.equal(await closeError.evaluate(el=>document.activeElement===el),true,'Dismiss control must be keyboard-focusable');
 await page.keyboard.press('Enter');
 await errorToast.waitFor({state:'detached',timeout:3000});
 await page.evaluate(()=>toast('Persistent security failure','error'));
 const persistentToast=page.locator('#toasts .tst.err').filter({hasText:'Persistent security failure'});
 await page.waitForTimeout(3900);
 assert.equal(await persistentToast.count(),1,'Error toast must persist longer than the previous 3.4 second timeout');
 await persistentToast.getByRole('button',{name:'Dismiss error notification'}).click();
 await persistentToast.waitFor({state:'detached',timeout:3000});
 await page.locator('[data-inst="lead-new"]').click();
 await page.locator('#inst-lead [name="full_name"]').fill('Synthetic <Executive>');await page.locator('#inst-lead [name="company"]').fill('Test & Co');await page.locator('#inst-lead [name="email"]').fill('test@example.test');await page.locator('[data-inst="lead-save"]').click();await page.waitForFunction(()=>document.querySelector('[data-inst-lead]')?.textContent.includes('Synthetic <Executive>'));
 assert.equal(await page.locator('executive').count(),0);await page.locator('[data-inst-search]').fill('missing');assert.equal(await page.locator('[data-inst-lead]:visible').count(),0);await page.locator('[data-inst-search]').fill('Synthetic');
 await page.locator('[data-inst="draft"]').click();await page.locator('[data-inst="draft-view"]').waitFor();await page.locator('[data-inst="draft-view"]').click();assert.match(await page.locator('.inst-preview').textContent(),/15% fixed annual/);assert.match(await page.locator('.inst-preview').textContent(),/not a forecast or guaranteed/);await page.evaluate(()=>closeModal());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'No horizontal page overflow');
 await page.screenshot({path:'/tmp/vice-omega-'+width+'.png',fullPage:true});
 await page.evaluate(()=>go('sovereign'));await page.locator('#view').getByText('BASELINE MISMATCH',{exact:false}).first().waitFor();assert.equal(await page.locator('[data-inst="approve-proposal"]').count(),0,'Invalid proposal must not expose executive authorization');assert.equal(await page.locator('[data-inst="approve-device"]').count(),0,'Invalid proposal must not expose device authorization');
 await page.locator('[data-inst="enroll"]').click();try{await page.waitForFunction(()=>window.__instCalls.some(x=>x.name==='vice_exec_challenge'),{},{timeout:8000});}catch(e){const diagnostic=await page.evaluate(()=>({calls:window.__instCalls,toastText:document.querySelector('#toasts')?.innerText,button:document.querySelector('[data-inst="enroll"]')?.outerHTML,crypto:!!crypto?.subtle,indexedDB:!!indexedDB}));throw new Error('Executive key enrollment did not reach challenge RPC: '+JSON.stringify({diagnostic,pageErrors:errors}),{cause:e});}
 const key=await page.evaluate(()=>window.__instCalls.find(x=>x.name==='vice_exec_challenge').args.p_public_key);assert.equal(key.kty,'EC');assert(!key.d);assert.equal(key.x.length,43);
 // Abort the key-store transaction deliberately: an aborted write must reject, never authorize.
 const abortOutcome=await page.evaluate(async()=>{
  const opened=await new Promise((resolve,reject)=>{const req=indexedDB.open('vice-executive-keys',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   return await new Promise((resolve,reject)=>{
    const tx=opened.transaction('keys','readwrite');
    const req=tx.objectStore('keys').put({test:true},'abort-regression');
    // A request inside an explicitly aborted transaction normally emits AbortError.
    // The transaction's terminal event, not the request error, determines the result.
    req.onerror=event=>{ event.preventDefault(); }; // Expected AbortError from explicit abort.
    tx.oncomplete=()=>resolve('COMMITTED');
    tx.onabort=()=>resolve('ABORTED');
    tx.onerror=()=>{}; // Error can precede abort; wait for the terminal transaction event.
    tx.abort();
   });
  }finally{opened.close()}
 });
 assert.equal(abortOutcome,'ABORTED','IndexedDB transaction abort must not report a successful commit');
 const noAbortedRecord=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('vice-executive-keys',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readonly'),r=tx.objectStore('keys').get('abort-regression');r.onsuccess=()=>resolve(r.result===undefined);r.onerror=()=>reject(r.error)})}finally{db.close()}
 });
 assert.equal(noAbortedRecord,true,'Aborted key write must not persist a record');
 await page.evaluate(()=>go('self-diagnosis'));await page.locator('#view').getByText('Database integrity',{exact:true}).waitFor();assert.match(await page.locator('#view').textContent(),/NOT CERTIFIED/);
 await page.evaluate(()=>{S.profile.role='HOLDER';S.tab='omega';renderMain();});assert.match(await page.locator('#view').textContent(),/CEO or CFO access required/);assert.deepEqual(errors,[]);console.log('PASS institutional UI '+width+': model, lead save/search, escaped content, outreach, key enrollment, blocked scaling, honest diagnostics and role isolation');await page.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}
