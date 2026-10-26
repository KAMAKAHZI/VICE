'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),p=require('node:path');
const site='dist/site';
const required=['index.html','guide.html','verify.html','version.json','deployment.json','manifest.json','manifest.webmanifest','sw.js','vice-mega.js','vice-mega.css','vice4x-operations.js','vice4x-operations.css','vice-solace-system.js','vice-ouv-final-deploy.js','vice-ouv-reference.js','vice4x-comms.js','vice4x-comms.css','governance.html','vice4x-institutional-core.js','vice4x-institutional.js','vice4x-institutional.css','_headers','_redirects'];
required.push('vice-market-data-integrity.js');
required.push('vice4x-icon.svg','vice4x-icon-192.png','vice4x-icon-512.png','apple-touch-icon.png');
const found=fs.readdirSync(site).sort(),safe=[...required].sort();
assert.deepEqual(found,safe,'Public deployment must be exact whitelisted assets');
for(const fname of found)assert(fs.statSync(p.join(site,fname)).isFile(),'Unexpected path: '+fname);
const build=JSON.parse(fs.readFileSync(p.join(site,'version.json'),'utf8')).version;
assert(fs.readFileSync(p.join(site,'index.html'),'utf8').includes('data-build="'+build+'"'),'Netlify and source build diverge');
assert(!found.some(x=>/supabase|secrets|\.github|bootstrap|netlify|tests|sql/i.test(x)),'Backend code exposed');
console.log('PASS PUBLIC DEPLOYMENT SAFETY: '+found.length+' whitelisted files, '+build);

const identity=JSON.parse(fs.readFileSync(p.join(site,'deployment.json'),'utf8'));assert.deepEqual(Object.keys(identity).sort(),['built_at','commit','context','deployment_id','release_version']);


// Ensure the OUV control is injected exactly once at the real document end.
// Inline certificate templates also contain "</body>" as string content;
// replacing every occurrence previously corrupted the principal app script.
const stagedHtml=fs.readFileSync(p.join(site,'index.html'),'utf8');
const injected=(stagedHtml.match(/<script defer src="\/vice-ouv-final-deploy\.js"><\/script>/g)||[]);
assert.equal(injected.length,1,'OUV control script must be injected exactly once');
const reference=(stagedHtml.match(/<script defer src="\/vice-ouv-reference\.js"><\/script>/g)||[]);
assert.equal(reference.length,1,'Canonical OUV reference module must be injected exactly once');
assert(stagedHtml.indexOf('vice-ouv-reference.js')<stagedHtml.indexOf('vice-ouv-final-deploy.js'),'Canonical reference must load before executive UI');
const start=stagedHtml.indexOf('<script>\n\'use strict\';');
assert(start>=0,'Primary VICE app script missing');
const end=stagedHtml.indexOf('</script>',start);
assert(end>start,'Primary VICE app script closure missing');
assert.doesNotThrow(()=>new Function(stagedHtml.slice(start+'<script>'.length,end)),
  'Deployment must preserve syntactically valid principal app JavaScript');
