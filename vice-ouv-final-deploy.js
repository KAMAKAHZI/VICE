/* VICE OS executive OUV actions. Readiness is never itself authorization. */
(() => {
'use strict';
const PROPOSAL='PROP-20261019-548A9057-34F';
const endpoint='/.netlify/functions/ouv-final-deploy';
let busy=false;
const client=()=>[window.sb,window.supabaseClient,window._supabase].find(c=>c&&c.auth&&c.auth.getSession);
function mount(){
 if(document.getElementById('vice-ouv-final-deploy'))return;
 const nodes=document.querySelectorAll('div,section,article');
 let host=null;
 for(const n of nodes){
  const t=n.textContent||'';
  if(n.children.length<14&&t.length<4500&&t.includes(PROPOSAL)&&/execution gates|executive authorizations|quorum/i.test(t)){host=n;break;}
 }
 if(!host)return;
 const root=document.createElement('section');root.id='vice-ouv-final-deploy';
 root.setAttribute('aria-label','Executive OUV governance');
 root.style.cssText='margin:14px 0;padding:15px;border:1px solid #a88a3e;border-radius:12px;background:#15130e;color:#ecd28a';
 const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:10px';
 function button(label){
  const b=document.createElement('button');b.type='button';b.textContent=label;
  b.style.cssText='flex:1 1 200px;min-height:46px;padding:12px;border:1px solid #c9a84c;border-radius:9px;background:#302710;color:#f5d77e;font-weight:700;cursor:pointer';
  row.append(b);return b;
 }
 const verify=button('VERIFY OUV READINESS'),execute=button('EXECUTE APPROVED OUV'),reference=button('CHECK OFFICIAL OUV');
 execute.disabled=true;
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.style.cssText='white-space:pre-wrap;margin-top:10px;overflow-wrap:anywhere';
 status.textContent='Executive-only. Verification is read-only; execution requires independent server authorization.';
 const details=document.createElement('pre');details.hidden=true;details.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:12px';
 root.append(row,status,details);host.append(root);
 function setBusy(v){
  busy=v;verify.disabled=v;reference.disabled=v;execute.disabled=v||root.dataset.ready!=='true';
  execute.style.opacity=execute.disabled?'0.5':'1';
 }
 async function action(kind){
  if(busy)return;
  if(kind==='execute_ouv'&&root.dataset.ready!=='true')return;
  if(kind==='execute_ouv'&&!window.confirm('Execute approved issuer management OUV? Not independent fair market value; holder units will not change.'))return;
  root.dataset.ready='';setBusy(true);details.hidden=true;
  status.textContent=kind==='execute_ouv'?'Submitting authorized execution…':'Checking authoritative governance readiness…';
  try{
   const session=await client()?.auth.getSession();
   const token=session?.data?.session?.access_token;
   if(!token)throw Error('Executive sign-in required');
   const request_id=crypto.randomUUID();
   const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token,'Idempotency-Key':request_id},body:JSON.stringify({action:kind,proposal_id:PROPOSAL,request_id,...(kind==='execute_ouv'?{confirm:'EXECUTE APPROVED OUV'}:{})})});
   const data=await response.json();
   if(!data||typeof data.status!=='string')throw Error('Invalid server response');
   root.dataset.ready=response.ok&&data.status==='ready'?'true':'';
   status.textContent=data.status==='verified'?'OUV PUBLISHED AND RECONCILED — issuer management reference only.':data.status==='ready'?'Governance gates report ready; execution requires an explicit click.':'EXECUTION BLOCKED — '+(data.message||'Review conditions');
   details.textContent=JSON.stringify({status:data.status,proposal_id:data.proposal_id||PROPOSAL,issues:data.issues||[],checks:data.checks||null,ouv_version:data.ouv_version||null,receipt_id:data.receipt_id||null},null,2);
   details.hidden=false;
  }catch(e){root.dataset.ready='';status.textContent='ACTION REQUIRED — '+(e?.message||'Verification failed');}
  finally{setBusy(false);}
 }
 reference.addEventListener('click',async()=>{
  if(busy)return;setBusy(true);details.hidden=true;
  try{
   if(!window.ViceOUVReference)throw Error('Canonical reference module unavailable');
   const c=client();if(!c)throw Error('Sign in to inspect official OUV');
   const snapshot=await window.ViceOUVReference.read(c);
   status.textContent='OFFICIAL ISSUER REFERENCE — VICE '+snapshot.vice.toFixed(8)+'; V4X '+snapshot.v4x.toFixed(8)+'; policy '+snapshot.policyStatus+'. Not independent FMV.';
   details.textContent=JSON.stringify(snapshot,null,2);details.hidden=false;
  }catch(e){status.textContent='OFFICIAL REFERENCE UNAVAILABLE — '+(e?.message||'Unable to verify');}
  finally{setBusy(false);}
 });
 verify.addEventListener('click',()=>action('reconcile_ouv'));
 execute.addEventListener('click',()=>action('execute_ouv'));
}
function boot(){
 mount();
 const observer=new MutationObserver(()=>{if(!document.getElementById('vice-ouv-final-deploy'))mount();});
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
