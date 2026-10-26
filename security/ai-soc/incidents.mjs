// VICE OS Phase 3.13 — deterministic incident materialization.
// Pure adapter: caller must authenticate its upstream event source and
// persist using a server-only DB role. No network, secrets or writes here.
import {createHash} from 'node:crypto';
import {normalizeTrustedBatch} from './normalize.mjs';
import {triageSecurityEvents} from './triage.mjs';
export function prepareSocIncidents(records, context, options={}){
  const normalized=normalizeTrustedBatch(records,context);
  const now=Number.isFinite(options.now)?options.now:Date.now();
  const windowMs=Number.isFinite(options.windowMs)?options.windowMs:900000;
  const groups=new Map();
  for(const e of normalized){
    const timestamp=Date.parse(e.at);
    if(timestamp<now-Math.min(Math.max(windowMs,60000),86400000)||timestamp>now+30000)continue;
    if(!groups.has(e.actorId))groups.set(e.actorId,[]);
    groups.get(e.actorId).push(e);
  }
  const findings=triageSecurityEvents(normalized,{now,windowMs});
  return findings.map(f=>{
    const relevant=groups.get(f.actorId)||[];
    const times=relevant.map(e=>Date.parse(e.at));
    const first=new Date(Math.min(...times)).toISOString();
    const last=new Date(Math.max(...times)).toISOString();
    const fingerprint=createHash('sha256').update(JSON.stringify({
      ruleVersion:f.ruleVersion,actorId:f.actorId,signals:f.signals,
      events:relevant.map(e=>[e.type,e.at]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
    })).digest('hex');
    return Object.freeze({
      source_event_key:fingerprint,actor_reference:f.actorId,severity:f.severity,
      risk_score:f.score,signals:f.signals,categories:f.categories,
      rule_version:f.ruleVersion,first_seen_at:first,last_seen_at:last
    });
  });
}
