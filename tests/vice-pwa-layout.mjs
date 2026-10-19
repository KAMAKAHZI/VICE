// Browser regression for the reported installed-app status-bar/menu collision.
// Chromium supplies real CSS env() insets through CDP. This is layout emulation,
// not a claim of physical iOS/Android device certification. All member data is SIM.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=path.resolve(process.env.VICE_LAYOUT_ROOT||'dist/site');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+url.pathname),file=p===root?path.join(root,'index.html'):p;
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.VICE_CHROMIUM_PATH?{executablePath:process.env.VICE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
const cases=[
 ['island-phone',393,852,59,34,0,0],['small-phone',320,568,0,0,0,0],
 ['classic-phone',375,667,20,0,0,0],['notched-phone',390,844,47,34,0,0],
 ['large-phone',430,932,59,34,0,0],['android-phone',412,915,28,24,0,0],
 ['phone-landscape',844,390,0,21,47,47],['tablet-portrait',768,1024,24,20,0,0],
 ['tablet-landscape',1024,768,24,20,0,0],['desktop',1440,900,0,0,0,0]
];
try{
 for(const [name,width,height,top,bottom,left,right] of cases){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<=1024,deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top,bottom,left,right}});
  await page.goto(process.env.VICE_BROWSER_ORIGIN||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.locator('#loginForm').waitFor();
  await page.route('https://*.supabase.co/**',r=>r.abort());
  // The production-origin variant also uses in-memory SIM only; it does not log in.
  await page.evaluate(()=>{enterSimMode();Realtime.disconnect();document.getElementById('toasts').replaceChildren();});
  await page.locator('#sbToggle').waitFor({state:width<=900?'visible':'hidden'});
  const geometry=await page.evaluate(()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return {header:box('#tb'),menu:box('#sbToggle'),brand:box('.tb .brand'),account:box('.tb .upill'),view:box('main.mn'),banner:box('#bnr'),sb:box('#sb'),overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(geometry.header.height,54+top,`${name}: header includes safe area`);
  assert(geometry.brand.y>=top,`${name}: brand below status bar`);
  assert(geometry.account.y>=top&&geometry.account.right<=width-right,`${name}: account inside safe rectangle`);
  assert.equal(geometry.banner.y,geometry.header.bottom,`${name}: banner follows header`);
  assert(geometry.view.y>=geometry.banner.bottom,`${name}: content below chrome`);
  assert(!geometry.overflow,`${name}: no horizontal page overflow`);
  if(width<=900){
   assert(geometry.menu.y>=top&&geometry.menu.x>=left,`${name}: menu clear of status bar and cutout`);
   assert(geometry.menu.width>=44&&geometry.menu.height>=44,`${name}: minimum menu touch target`);
   // An opaque OS-owned strip intercepts every tap inside the unsafe region.
   await page.evaluate(top=>{const strip=document.createElement('div');strip.id='test-status-bar';strip.style.cssText=`position:fixed;inset:0 0 auto;height:${top}px;z-index:2147483647;background:#07080a`;document.body.append(strip);},top);
   await page.locator('#sbToggle').tap();
   assert.equal(await page.locator('#sbToggle').getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#sb').evaluate(e=>e.inert),false);
   await page.locator('#sb [data-go="portfolio"]').tap();
   assert.equal(await page.evaluate(()=>S.tab),'portfolio');
   assert.equal(await page.locator('#sbToggle').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('#sb').evaluate(e=>e.inert),true);
   await page.locator('#sbToggle').click();await page.locator('#sbToggle').focus();await page.keyboard.press('Tab');
   assert(await page.evaluate(()=>document.querySelector('#sb').contains(document.activeElement)),'Keyboard enters navigation');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#sbToggle').getAttribute('aria-expanded'),'false');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'sbToggle');
   await page.locator('#sbToggle').tap();
   await page.locator('#sbBackdrop').tap({position:{x:width-right-18,y:50}});
   assert.equal(await page.locator('#sbToggle').getAttribute('aria-expanded'),'false');
   await page.locator('#sbToggle').tap();
   const last=page.locator('#sb [data-go]').last();await last.scrollIntoViewIfNeeded();
   assert((await last.boundingBox()).y>=geometry.header.bottom,'Scrolled final menu item remains below header');
   await last.tap();assert.equal(await page.locator('#sbToggle').getAttribute('aria-expanded'),'false');
  }else{
   assert.equal(await page.locator('#sb').evaluate(e=>e.inert),false);
   await page.locator('#sb [data-go="portfolio"]').click();assert.equal(await page.evaluate(()=>S.tab),'portfolio');
  }
  await page.evaluate(()=>{go('command');window.__viceAct(document.getElementById('bnr'));});
  const closed=await page.locator('main.mn').boundingBox();assert.equal(closed.y,54+top,`${name}: dismissing banner preserves safe top offset`);
  await page.evaluate(()=>go('comms'));await page.locator('#cmTabs button[data-cm-tab="contacts"]').click();
  assert.equal(await page.evaluate(()=>S.comms.tab),'contacts');
  const bottomNav=await page.locator('#cmTabs button').first().boundingBox();
  assert(bottomNav.y+bottomNav.height<=height-bottom+1,`${name}: bottom tabs clear home indicator`);
  if(name==='island-phone'||name==='phone-landscape'){
   await page.evaluate(()=>go('command'));await page.screenshot({path:'/tmp/vice-pwa-'+name+'.png',fullPage:false});
  }
  if(name==='tablet-portrait'){
   await page.locator('#sbToggle').click();await page.setViewportSize({width:1024,height:768});
   await page.waitForFunction(()=>!document.body.classList.contains('mobile-menu-open'));
   assert.equal(await page.locator('#sbBackdrop').isVisible(),false);
   assert.equal(await page.locator('#sb').evaluate(e=>e.inert),false,'Rotating to desktop layout restores sidebar');
  }
  if(width<=900&&name!=='tablet-portrait')await page.locator('#sbToggle').click();
  await page.evaluate(()=>clearMemberSession());
  assert.equal(await page.locator('#sbBackdrop').isVisible(),false,'Logout clears navigation backdrop');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('mobile-menu-open')),false);
  assert.deepEqual(errors,[],`${name}: no runtime errors`);
  console.log('PASS PWA layout '+name+' '+width+'×'+height+': safe insets, navigation, banner, lower tabs, session cleanup');
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
