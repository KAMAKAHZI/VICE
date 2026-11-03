import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createPgSocIngress} from '../security/ai-soc/pg-ingress.mjs';
const secret='institutional-test-secret-32-bytes-long-and-not-production';
const clock=()=>Date.parse('2026-10-25T12:00:00.000Z');
const nonces=new Set();
const incidents=new Set();
const db={async query(sql,params){
  if(sql.includes('vice_soc_webhook_nonces')){
    if(nonces.has(params[0]))return {rowCount:0};
    nonces.add(params[0]);return {rowCount:1};
  }
  if(sql.includes('vice_soc_incidents')){
    if(incidents.has(params[0]))return {rowCount:0};
    incidents.add(params[0]);return {rowCount:1};
  }
  throw new Error('Unexpected SQL');
}};
const ingest=createPgSocIngress({db,secret,clock});
const rawBody=JSON.stringify([{type:'MFA_REPLAY',actorId:'actor-1',at:new Date(clock()).toISOString()}]);
const timestamp=String(clock()),nonce='nonce_1234567890123456';
const signature='sha256='+createHmac('sha256',secret).update(timestamp+'.'+nonce+'.'+rawBody).digest('hex');
const headers={'x-vice-timestamp':timestamp,'x-vice-nonce':nonce,'x-vice-signature':signature};
const first=await ingest({rawBody,headers});
assert.equal(first.status,202);
const replay=await ingest({rawBody,headers});
assert.equal(replay.status,401);
const tampered=await ingest({rawBody:rawBody+' ',headers});
assert.equal(tampered.status,401);
assert.equal(nonces.size,1);
const failed=createPgSocIngress({secret,clock,db:{query:async()=>{throw Error('database down')}}});
assert.equal((await failed({rawBody,headers})).status,401);
console.log('PASS authenticated PostgreSQL SOC ingress, replay rejection, tamper rejection and storage outage');
