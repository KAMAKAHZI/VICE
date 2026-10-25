// Read-only auth lifecycle regression contracts. No credentials or live sessions.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function section(start,end){const a=src.indexOf(start);assert.ok(a>=0,'Missing '+start);const b=src.indexOf(end,a+start.length);assert.ok(b>a,'Missing '+end);return src.slice(a,b)}
const listener=section("sb.auth.onAuthStateChange((event, session) => {", "}).catch(e=>console.warn('VICE auth init failed:'");
const refreshed=section("} else if(event === 'TOKEN_REFRESHED'){", "} else if(event === 'PASSWORD_RECOVERY'){");
assert.doesNotMatch(refreshed,/clearMemberSession\s*\(|signOut\s*\(|onAuthenticated\s*\(/,'Token refresh must never reset member state');
const signedIn=section("} else if(event === 'SIGNED_IN' && session && session.user){", "} else if(event === 'TOKEN_REFRESHED'){");
assert.match(signedIn,/authSetupTask&&authSetupOwner===session\.user\.id/,'Duplicate SIGNED_IN must respect ongoing setup');
assert.match(listener,/event === 'SIGNED_OUT'/,'SIGNED_OUT must clear state');
const setup=section('function onAuthenticated(user){','// An enrolled authenticator');
assert.match(setup,/authSetupOwner===user\.id&&authSetupEpoch===authEpoch/,'Same user/epoch must share initialization');
assert.match(setup,/const previousSetup=authSetupTask;/,'Account switching must await the prior setup');
assert.match(setup,/previousSetup\.catch\([\s\S]*?\.then\(/,'Previous setup errors must not strand the next account');
assert.match(setup,/if\(authSetupEpoch===epoch && authSetupOwner===user\.id\)/,'Only the owning epoch may clear setup state');
assert.match(setup,/S\.user\?\.id === user\.id && \$\('login'\)\?\.hidden === true/,'Already signed-in member must not reinitialize');
const profile=section('async function completeAuthenticatedSetup(user,epoch=authEpoch){','async function ensureHolderForCurrentUser()');
assert.match(profile,/viceRequireSecondFactor\(user,epoch\)/,'MFA is mandatory before member data');
assert.match(profile,/if\(!prof\)\{[\s\S]*?your session is preserved/,'Missing profile must preserve Supabase session');
assert.match(profile,/catch\(e\)[\s\S]*?showApp\(\)/,'Optional module errors must not blank valid member UI');
console.log('PASS auth session regression contracts (static; live desktop sign-in remains unverified)');
