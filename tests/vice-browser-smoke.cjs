'use strict';
// Public UI only. No accounts, financial mutations or production writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve('dist/site');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  const target=file===root?path.join(root,'index.html'):file;
  if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{const ext=path.extname(target);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[ext]||'text/plain');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.VICE_CHROMIUM_PATH?{executablePath:process.env.VICE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.VICE_BROWSER_ORIGIN||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('#loginForm').waitFor({state:'visible',timeout:45000});
   assert.equal(await page.evaluate(()=>typeof onAuthenticated),'function','Application initialized; browser errors: '+JSON.stringify(errors));
   await page.locator('#loginBtn').click();
   assert.equal(await page.locator('#loginBtn').isDisabled(),false,'Empty credentials do not trap submit');
   await page.evaluate(()=>openModal('Keyboard test','<input id="testField"><button class="btn" data-act="modal-close">Close</button>'));
   await page.locator('#testField').click();assert(await page.locator('#modal').evaluate(e=>e.classList.contains('on')));
   await page.locator('#modal button[data-act="modal-close"]').first().click();
   assert.equal(await page.locator('#modal').evaluate(e=>e.classList.contains('on')),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'No horizontal overflow');
   assert.deepEqual(errors,[]);console.log('PASS public browser',viewport.width,'login, validation, modal, layout, runtime');
   if(process.env.VICE_BROWSER_ORIGIN){await page.close();continue;}
   // Explicit SIM fixtures exercise rendering only, never real accounts/allocations.
   await page.route('https://*.supabase.co/**',route=>route.abort());
   await page.evaluate(()=>enterSimMode());
   await page.waitForFunction(()=>S.ch.candles.length>100);
   await page.evaluate(()=>{S.tab='markets';renderMain();});
   const canvas=page.locator('#cv');await canvas.waitFor({state:'visible'});
   await page.waitForFunction(()=>document.getElementById('cv')?._wired);
   await canvas.scrollIntoViewIfNeeded();
   const box=await canvas.boundingBox();assert(box&&box.width>100);
   const x=box.x+Math.max(25,(box.width-84)/2),y=box.y+box.height/2;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+30,{steps:8});await page.mouse.up();
   assert(await page.evaluate(()=>S.view2.end!==null&&S.view2.priceRange?.max>S.view2.priceRange?.min),'Chart drag pans time and price');
   const before=await page.evaluate(()=>S.view2.priceRange.max-S.view2.priceRange.min);
   assert(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)===document.getElementById('cv'),{x:box.x+box.width-25,y}),'Price axis is not covered by a floating control');
   await page.mouse.move(box.x+box.width-25,y);await page.mouse.down();await page.mouse.move(box.x+box.width-25,y+35,{steps:8});await page.mouse.up();
   assert(await page.evaluate(span=>S.view2.priceRange.max-S.view2.priceRange.min>span,before),'Price-axis drag changes scale');
   assert.equal(await page.evaluate(()=>S.tab),'markets','Chart dragging does not activate navigation');
   assert.equal(await page.locator('#oi-root').evaluate(e=>e.classList.contains('on')),false,'Chart dragging does not open O.I.');
   assert.equal(await page.locator('#view [data-act="oi-open"]').count(),1,'O.I. remains available in the chart toolbar');
   assert.equal(await page.locator('#view [data-act="support-open"]').count(),1,'Support remains available in the chart toolbar');
   assert.equal(await page.evaluate(()=>S.res.version),'10.6','Browser runs supplied System adaptation');
   await page.locator('[data-act="v4x-system-settings"]').click();
   await page.locator('#v4x-system-form').waitFor({state:'visible'});
   await page.locator('[data-system-key="mode"]').selectOption('Scalp');
   await page.locator('[data-act="v4x-system-save"]').click();
   await page.waitForFunction(()=>S.res?.params.mode==='Scalp');
   assert.equal(await page.evaluate(()=>S.res.params.lookback),250);
   console.log('PASS chart body/price-axis drag and System settings',viewport.width);
   await page.evaluate(()=>{S.tab='admin';renderMain();});
   const buildRow=page.locator('.rw').filter({has:page.locator('.rw-l',{hasText:'Build'})});
   if(await buildRow.count())assert((await buildRow.boundingBox()).height<100,'Monospace build label does not inherit full-page height');
   await page.evaluate(()=>{S.tab='lending';renderMain();});
   await page.locator('[data-act="v4x-loan-new"]').click();
   await page.locator('#v4x-loan-form').waitFor({state:'visible'});
   await page.locator('#v4x-principal').fill('100');await page.locator('#v4x-appraisal_value').fill('400');
   assert.match(await page.locator('#v4x-ltv').textContent(),/25.00%/);
   assert.equal(await page.evaluate(()=>document.querySelector('.mdl').scrollWidth>document.querySelector('.mdl').clientWidth+2),false,'Loan form fits mobile modal');
   await page.evaluate(()=>closeModal());
   console.log('PASS compact settings and lending form',viewport.width);
   const renderFailures=await page.evaluate(()=>{
     const failures=[];
     for(const tab of TABS){S.tab=tab;renderMain();const text=document.getElementById('view')?.textContent||'';if(/^Error:/.test(text.trim()))failures.push(tab+': '+text);}
     APP_MODE='LIVE';clearMemberSession();
     if(!document.getElementById('view'))failures.push('Session cleanup removed the view mount');
     return failures;
   });
   assert.deepEqual(renderFailures,[],'Every existing navigation view renders with explicit SIM fixtures');
   console.log('PASS navigation render and session DOM cleanup',viewport.width);
   await page.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
