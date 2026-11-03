import assert from 'node:assert/strict';
import {makePgPasskeyChallengeStore} from '../security/auth/pg-passkey-challenges.mjs';
let used=false;const now=1800000000000;let updates=0;
const store=makePgPasskeyChallengeStore({query:async(sql,args)=>{
 if(sql.startsWith('SELECT'))return {rows:[{actor_id:'actor',challenge:'opaque',created_at:new Date(now-1000),expires_at:new Date(now+1000),used_at:used?new Date(now):null,action:'ROLE_ASSIGN',payload_hash:'hash'}]};
 if(sql.startsWith('UPDATE')){updates++;assert.match(sql,/used_at IS NULL/);assert.match(sql,/RETURNING id/);if(args[1]!=='actor'||used)return {rowCount:0};used=true;return {rowCount:1};}
 throw new Error('Unexpected SQL');
}});
const row=await store.loadChallenge('id');
assert.equal(row.actorId,'actor');assert.equal(row.action,'ROLE_ASSIGN');
assert.equal(await store.consumeChallenge('id','actor',now),true);
assert.equal(await store.consumeChallenge('id','actor',now),false);
assert.equal((await store.loadChallenge('id')).used,true);
assert.equal(updates,2);
console.log('PASS atomic passkey challenge adapter SQL contract (mock DB; integration pending)');
