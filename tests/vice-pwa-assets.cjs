'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('Install manifests publish existing correctly sized PNG icons, with one app identity',()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest'));
 assert.deepEqual(manifest,JSON.parse(fs.readFileSync('manifest.json')));
 assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');
 assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'any');
 assert.equal(manifest.icons.length,2);
 for(const icon of manifest.icons){
  const data=fs.readFileSync(new URL(icon.src,'https://example.test').pathname.slice(1));
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);
  assert.equal(icon.type,'image/png');assert.match(icon.purpose,/maskable/);
 }
 const apple=fs.readFileSync('apple-touch-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
 assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png\?v=/);
});
test('Install artwork uses exactly the official in-app emblem and metallic finish',()=>{
 const svg=fs.readFileSync('vice4x-icon.svg','utf8');
 const logo=html.match(/<path fill="url\(#vice-gold\)" d="([^"]+)"/)[1];
 const stops=html.match(/<linearGradient id="vice-gold"[^>]*>([\s\S]*?)<\/linearGradient>/)[1].trim();
 assert(svg.includes(`d="${logo}"`));assert(svg.includes(stops));
 assert.match(svg,/translate\(212 252.2\) scale\(\.6\)/);
 // Extreme triangle corners are inside the maskable 80% safe circle.
 for(const [x,y] of [[212,252.2],[812,252.2],[512,771.8]])assert(Math.hypot(x-512,y-512)<409.6);
});
