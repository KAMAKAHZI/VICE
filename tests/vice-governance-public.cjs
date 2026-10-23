'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {patch}=require('../scripts/vice-governance-publish.cjs');
const source=fs.readFileSync('governance.html','utf8');
test('public governance release counts both cryptographic and 2FA executive votes',()=>{
 const output=patch(source);
 assert.match(output,/Verified CEO\/CFO approvals \(device or 2FA\)/);
 assert.match(output,/p\.verified_executive_authorizations/);
 assert.match(output,/p\.ceo_signed/);
 assert.match(output,/p\.cfo_signed/);
 assert.match(output,/Authenticator 2FA/);
 assert.doesNotMatch(output,/<dt>Verified executive signatures<\/dt>/);
 assert.match(output,/2\/2 EXECUTIVE APPROVALS — NOT EFFECTIVE/);
 assert.match(output,/official issuer references and holder values are unchanged/);
 assert.match(output,/timeZone:"America\/New_York"/);
 assert.match(output,/setInterval\(\(\)=>\{if\(!document.hidden\)load\(\);\},60000\)/);
 assert.throws(()=>patch(output),/contract changed/i,'Repeat publisher rewrite must not silently double-transform source');
});
test('published governance asset includes safe executive vote correction',()=>{
 const published=fs.readFileSync('dist/site/governance.html','utf8');
 assert.equal(published,patch(source),'Publisher must apply the narrowly defined source transform');
});
