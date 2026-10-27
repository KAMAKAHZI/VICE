// VICE OS executive authorization button controller.
// No implicit financial execution: the server alone decides final governance status.
export function bindExecutiveAuthorizationButton({button,identity,getProposal,onStatus=()=>{},onError=()=>{}}){
 if(!button||!identity?.authorizeProposal||typeof getProposal!=="function")throw new TypeError("Executive authorization dependencies required");
 let busy=false;
 const run=async()=>{
  if(busy)return;
  busy=true;button.disabled=true;button.textContent="Verifying executive authorization…";
  try{
   const proposal=await getProposal();
   if(!proposal?.proposalId||!proposal?.payloadHash||!["CEO","CFO"].includes(proposal.role))
    throw new Error("PROPOSAL_CONTEXT_REQUIRED");
   const result=await identity.authorizeProposal({
    proposalId:proposal.proposalId,payloadHash:proposal.payloadHash,
    role:proposal.role,action:"APPROVE"
   });
   if(result?.verified!==true||result?.receiptRecorded!==true)
    throw new Error("AUTHORIZATION_NOT_CONFIRMED");
   const status=result.executionStatus==="EXECUTED"?"Executed & Synchronized ✓":
    proposal.role==="CEO"?"CEO Verified — Awaiting CFO":"CFO Verified — Awaiting Finalization";
   button.textContent=status;
   onStatus(result);
  }catch(error){
   button.textContent="Authorization unavailable — View Details";
   onError(error);
  }finally{busy=false;button.disabled=false;}
 };
 button.addEventListener("click",run);
 return ()=>button.removeEventListener("click",run);
}
