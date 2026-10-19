// Regenerate checked-in install icons from the application's own vector emblem.
// Development only: production publishes the resulting files without Playwright.
import fs from 'node:fs';
import {chromium} from 'playwright';

const html=fs.readFileSync('index.html','utf8');
const path=html.match(/<path fill="url\(#vice-gold\)" d="([^"]+)"/)?.[1];
const stops=html.match(/<linearGradient id="vice-gold"[^>]*>([\s\S]*?)<\/linearGradient>/)?.[1].trim();
if(!path||!stops)throw Error('Official VICE emblem or metallic finish is missing');
// All vertices fit within the central 80%-diameter maskable safe circle.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="VICE4X metallic gold emblem">
<defs><linearGradient id="vice-gold" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
<radialGradient id="backdrop"><stop stop-color="#292317"/><stop offset="1" stop-color="#07080a"/></radialGradient>
<filter id="edge" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="0" flood-color="#fff2ba" flood-opacity=".33"/><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000" flood-opacity=".65"/></filter></defs>
<rect width="1024" height="1024" fill="#07080a"/><circle cx="512" cy="495" r="440" fill="url(#backdrop)"/>
<path transform="translate(212 252.2) scale(.6)" filter="url(#edge)" fill="url(#vice-gold)" d="${path}"/>
</svg>\n`;
fs.writeFileSync('vice4x-icon.svg',svg);
const browser=await chromium.launch({headless:true,...(process.env.VICE_CHROMIUM_PATH?{executablePath:process.env.VICE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
try{
 for(const [size,file] of [[180,'apple-touch-icon.png'],[192,'vice4x-icon-192.png'],[512,'vice4x-icon-512.png']]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent('<style>html,body{margin:0;width:100%;height:100%;background:#07080a}svg{display:block;width:100%;height:100%}</style>'+svg);
  await page.screenshot({path:file,animations:'disabled'});await page.close();
  console.log('Generated '+file+' '+size+'×'+size);
 }
}finally{await browser.close();}
