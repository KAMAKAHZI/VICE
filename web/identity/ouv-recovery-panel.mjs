import {classifyOuvRecovery} from "./ouv-recovery-classifier.mjs";
// Executive read-only recovery panel: explicit reasons, no fake success state.
export function renderOuvRecoveryPanel({container,proposal,attestations,now}){
 if(!container)throw new TypeError("Container required");
 const state=classifyOuvRecovery({proposal,attestations,now});
 container.replaceChildren();
 const title=document.createElement("h3");title.textContent="OUV proposal recovery";container.append(title);
 const summary=document.createElement("p");
 summary.textContent=`Proposal ${state.proposalId||"unknown"} — ${state.state}`;
 container.append(summary);
 const list=document.createElement("ul");
 for(const issue of state.issues||[]){
  const item=document.createElement("li");item.textContent=issue.replaceAll("_"," ");list.append(item);
 }
 container.append(list);
 const note=document.createElement("p");
 note.textContent="Existing votes and signatures are preserved. A new authorization is requested only if the governing policy requires it.";
 container.append(note);
 return state;
}
