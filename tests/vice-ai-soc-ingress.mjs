import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSocIngress} from '../security/ai-soc/ingress.mjs';
const now=Date.parse('2026-10-25T12:00:00Z');
const secret='unit-test-only-soc-secret-at-least-32-chars';
const seen=new Set(),stored=[];
const ingest=createSocIngress({secret,clock:()=>now,
 consumeNonce:async n=>{if(seen.has(n))return false;seen.add(n);return true},
 writeIncidents:async incidents=>stored.push(...incidents)});
const rawBody=JSON.stringify([{type:'MFA_REPLAY',actorId:'actor-1',at:new Date(now).toISOString(),secret:'never-persist'}]);
const timestamp=String(now),nonce='nonce_12345678901234567890';
const signature='sha256='+createHmac('sha256',secret).update(timestamp+'.'+nonce+'.'+rawBody).digest('hex');
const request={rawBody,headers:{'x-vice-timestamp':timestamp,'x-vice-nonce':nonce,'x-vice-signature':signature}};
const first=await ingest(request);
assert.equal(first.status,202);assert.equal(first.body.incidents,1);
assert.equal(stored[0].severity,'critical');
assert.ok(!JSON.stringify(stored).includes('never-persist'));
assert.equal((await ingest(request)).status,401,'Replayed request rejected');
assert.equal((await ingest({...request,rawBody:rawBody+' '})).status,401,'Tampered body rejected');
console.log('PASS SOC authenticated ingress contracts (offline only)');
