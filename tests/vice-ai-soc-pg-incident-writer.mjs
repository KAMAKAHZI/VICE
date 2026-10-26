import assert from 'node:assert/strict';
import {makePgIncidentWriter} from '../security/ai-soc/pg-incident-writer.mjs';
const seen=new Set();
const calls=[];
const writer=makePgIncidentWriter({async query(sql,values){
  assert.match(sql,/ON CONFLICT \(source_event_key\) DO NOTHING/);
  assert.equal(values.length,9);
  calls.push(values);
  if(seen.has(values[0]))return {rowCount:0};
  seen.add(values[0]);return {rowCount:1};
}});
const incident={
 source_event_key:'a'.repeat(64),actor_reference:'test-actor',
 severity:'critical',risk_score:90,signals:['MFA_REPLAY'],
 categories:['authentication'],rule_version:'test-v1',
 first_seen_at:'2026-10-25T12:00:00.000Z',last_seen_at:'2026-10-25T12:00:00.000Z'
};
assert.equal(await writer([incident]),1);
assert.equal(await writer([incident]),0);
assert.equal(calls.length,2);
await assert.rejects(()=>writer([{...incident,risk_score:999}]),/Invalid incident/);
await assert.rejects(()=>writer([{...incident,source_event_key:'bad'}]),/Invalid incident/);
const outage=makePgIncidentWriter({query:async()=>{throw new Error('DB unavailable')}});
await assert.rejects(()=>outage([incident]),/DB unavailable/);
console.log('PASS SOC incident writer validation, idempotency and fail-closed storage errors');
