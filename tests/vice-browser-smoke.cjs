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
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
   await page.locator('#loginForm').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>typeof onAuthenticated),'function','Application initialized');
   await page.locator('#loginBtn').click();
   assert.equal(await page.locator('#loginBtn').isDisabled(),false,'Empty credentials do not trap submit');
   await page.evaluate(()=>openModal('Keyboard test','<input id="testField"><button class="btn" data-act="modal-close">Close</button>'));
   await page.locator('#testField').click();assert(await page.locator('#modal').evaluate(e=>e.classList.contains('on')));
   await page.locator('#modal button[data-act="modal-close"]').first().click();
   assert.equal(await page.locator('#modal').evaluate(e=>e.classList.contains('on')),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'No horizontal overflow');
   assert.deepEqual(errors,[]);console.log('PASS public browser',viewport.width,'login, validation, modal, layout, runtime');
   // Explicit SIM fixtures exercise rendering only, never real accounts/allocations.
   await page.route('https://*.supabase.co/**',route=>route.abort());
   await page.evaluate(()=>enterSimMode());
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
