'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Published asset comparison permits only the observed Netlify guide-link rewrite',async()=>{
 const {matchesPublishedAsset}=await import('./vice-published-assets.mjs');
 const source=fs.readFileSync('index.html');
 const expected='<a class="login-link" href="/guide.html" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px">Read Member User Guide</a>';
 const netlify="<a class='login-link' href='/guide' rel='noopener noreferrer' style='display:inline-block;margin-top:10px' target='_blank'>Read Member User Guide</a>";
 const transformed=Buffer.from(source.toString().replace(expected,netlify));
 assert(matchesPublishedAsset('index.html',source,source));assert(matchesPublishedAsset('index.html',transformed,source));
 assert(!matchesPublishedAsset('index.html',Buffer.from(transformed.toString().replace('UNITS_ISSUANCE_REVERSED','DIFFERENT_EVENT')),source));
 assert(!matchesPublishedAsset('index.html',Buffer.from(transformed.toString().replace("href='/guide'","href='https://example.org'")),source));
 assert(!matchesPublishedAsset('vice-mega.js',transformed,source));
});
