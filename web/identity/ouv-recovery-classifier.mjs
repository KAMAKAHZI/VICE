// VICE OS — deterministic expired-proposal recovery classification.
// Read-only: never mutates votes, attestation records, deadlines, or OUV values.
export function classifyOuvRecovery({proposal,attestations=[],now=Date.now()}){
 if(!proposal?.id||!proposal?.payload_hash)throw new TypeError("Authoritative proposal required");
 const target=proposal.payload?.parameters?.target_scaled_tier;
 if(!target||!Number.isFinite(Number(target.vice_ouv))||!Number.isFinite(Number(target.v4x_ouv))||Number(target.vice_ouv)<=0||Number(target.v4x_ouv)<=0)
  return {state:"INVALID_PROPOSAL",canExecute:false};
 const expires=proposal.validation_until?Date.parse(proposal.validation_until):null;
 const reviewComplete=expires!==null&&Number.isFinite(expires)&&expires<=now;
 const valid=attestations.filter(a=>a.proposal_id===proposal.id&&a.payload_hash===proposal.payload_hash&&a.verified_at&&Number.isFinite(Date.parse(a.verified_at)));
 const ceo=valid.some(a=>a.role==="CEO");
 const cfo=valid.some(a=>a.role==="CFO");
 const issues=[];
 if(!["REVIEW","LOCKED"].includes(proposal.status))issues.push("PROPOSAL_NOT_ACTIVE");
 if(!reviewComplete)issues.push("PUBLIC_REVIEW_INCOMPLETE");
 if(!ceo)issues.push("CEO_ATTESTATION_REQUIRED");
 if(!cfo)issues.push("CFO_ATTESTATION_REQUIRED");
 if(!proposal.quorum_verified_at||!Number.isFinite(Date.parse(proposal.quorum_verified_at)))issues.push("QUORUM_NOT_VERIFIED");
 if(!proposal.execute_after||!Number.isFinite(Date.parse(proposal.execute_after))||Date.parse(proposal.execute_after)>now)issues.push("EXECUTION_TIME_NOT_REACHED");
 return {state:issues.length?"RECOVERY_REQUIRED":"ELIGIBILITY_REVIEW_REQUIRED",
  canExecute:false,proposalId:proposal.id,issues,
  verifiedRoles:{CEO:ceo,CFO:cfo},target:{VICE:String(target.vice_ouv),V4X:String(target.v4x_ouv)},
  notice:"Classification only. Never executes or renews a proposal."};
}
