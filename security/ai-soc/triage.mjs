// VICE OS AI-SOC phase 3.10: deterministic, explainable event triage.
// Pure function. Never performs financial writes, access changes, or automatic sanctions.
// Input must come from server-verified events, not client assertions.
export const RULE_VERSION = 'vice-soc-2026-10-25.1';
const RULES = Object.freeze({
  MFA_FAILURE: {score: 25, category:'identity'},
  MFA_REPLAY: {score: 90, category:'identity'},
  ROLE_CHANGE_DENIED: {score: 70, category:'privilege'},
  ROLE_CHANGE: {score: 35, category:'privilege'},
  SESSION_REVOKED: {score: 35, category:'identity'},
  LOGIN_FAILURE: {score: 10, category:'identity'},
  IRU_ALLOCATION_DENIED: {score: 75, category:'financial'},
  OUV_EXECUTION_DENIED: {score: 85, category:'governance'},
});
const MAX_EVENTS=1000;
export function triageSecurityEvents(events, options={}){
  if(!Array.isArray(events) || events.length>MAX_EVENTS) throw new TypeError('Expected at most 1000 events');
  const now=Number.isFinite(options.now)?options.now:Date.now();
  const horizon=Number.isFinite(options.windowMs)?Math.min(Math.max(options.windowMs,60000),86400000):900000;
  const verified=events.filter(e=>e && e.serverVerified===true && typeof e.type==='string' &&
    typeof e.actorId==='string' && e.actorId.length>0 && e.actorId.length<=128 &&
    typeof e.at==='string' && Number.isFinite(Date.parse(e.at)) &&
    Date.parse(e.at)<=now+30000 && Date.parse(e.at)>=now-horizon);
  const groups=new Map();
  for(const e of verified){
    const rule=RULES[e.type];if(!rule) continue;
    const key=e.actorId;
    if(!groups.has(key))groups.set(key,{actorId:key,score:0,signals:new Set(),count:0,categories:new Set()});
    const g=groups.get(key);g.score+=rule.score;g.signals.add(e.type);g.categories.add(rule.category);g.count++;
  }
  return [...groups.values()].map(g=>{
    const score=Math.min(100,g.score);
    return {actorId:g.actorId,score,severity:score>=80?'critical':score>=50?'high':score>=25?'medium':'low',
      signals:[...g.signals].sort(),categories:[...g.categories].sort(),count:g.count,
      recommendation:score>=80?'Escalate to human security operator; verify evidence before containment':
      score>=50?'Investigate correlated verified events':'Continue monitoring',
      automaticFinancialAction:false,automaticRoleChange:false,ruleVersion:RULE_VERSION};
  }).sort((a,b)=>b.score-a.score||a.actorId.localeCompare(b.actorId));
}
