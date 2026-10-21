'use strict';
const ViceInstitutional=(()=>{
 const core=ViceInstitutionalCore,blank=()=>({owner:null,epoch:0,loading:false,loaded:false,error:null,leads:[],drafts:[],financings:[],proposals:[],signers:[],authorizations:[],ouvRelease:null,lastRefreshAt:0,diagnostics:null,providers:null,model:{principal:1000000,months:3,grossProfit:0,costs:0,lossCarry:0,lead_id:'',evidence:''}});let state=blank();
 const allowed=()=>isRegistryOperator(),label=s=>String(s||'').replaceAll('_',' '),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0);
 function clear(){const epoch=state.epoch+1;state=blank();state.epoch=epoch;}
 function owner(){if(state.owner!==S.user?.id){clear();state.owner=S.user?.id;}}
 async function rpc(name,args={}){if(APP_MODE!=='LIVE'||!S.user||S.user.id==='sim-user')throw Error('Sign in to LIVE to save institutional records');const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function edge(body){const session=await sb.auth.getSession(),token=session.data?.session?.access_token;if(!token)throw Error('Sign in again');const c=new AbortController(),timer=setTimeout(()=>c.abort(),145000);try{const r=await fetch(SUPABASE_URL+'/functions/v1/vice-institutional',{method:'POST',signal:c.signal,headers:{'content-type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+token},body:JSON.stringify(body)});const data=await r.json();if(!r.ok||data.error)throw Error(data.error||'Institutional service unavailable');return data;}finally{clearTimeout(timer);}}
 async function refresh(){owner();if(state.loading||!allowed())return;const epoch=state.epoch;state.loading=true;
  try{
   if(APP_MODE!=='LIVE'||S.user?.id==='sim-user'){state.loaded=true;return;}
   const results=await Promise.all(['vice_omega_leads','vice_omega_outreach','vice_omega_financings','vice_sovereign_proposals','vice_exec_signers'].map(t=>sb.from(t).select('*').limit(500)));
   for(const r of results)if(r.error)throw r.error;
   const [diagnostics,authorizations,ouvRelease]=await Promise.all([rpc('vice_institutional_diagnostics'),rpc('vice_sovereign_feed'),rpc('vice_ouv_release_snapshot').catch(e=>({error:String(e.message||e)}))]);let providers;try{providers=await edge({action:'status'});}catch(e){providers={error:e.message};}
   if(epoch!==state.epoch||state.owner!==S.user?.id)return;
   [state.leads,state.drafts,state.financings,state.proposals,state.signers]=results.map(r=>r.data||[]);state.diagnostics=diagnostics;state.authorizations=Array.isArray(authorizations)?authorizations:[];state.ouvRelease=ouvRelease?.error?null:ouvRelease||null;state.providers=providers;state.error=null;
  }catch(e){if(epoch===state.epoch)state.error=e.message;}finally{if(epoch===state.epoch){state.loaded=true;state.loading=false;state.lastRefreshAt=Date.now();if(['omega','sovereign','self-diagnosis'].includes(S.tab))renderMain();}}
 }
 function load(){
  owner();
  if(state.loading || !allowed())return;
  if(!state.loaded || Date.now()-state.lastRefreshAt>45000)queueMicrotask(refresh);
 }
 // Live institutional data is refreshed without manual page reload after a
 // distribution or sovereign vote. The loop never reauthenticates or changes balances.
 if(typeof window!=='undefined' && typeof document!=='undefined' && typeof window.setInterval==='function'){
  window.setInterval(()=>{
   if(APP_MODE!=='LIVE'||!S.user?.id||document.visibilityState!=='visible'||!allowed())return;
   if(!['sovereign','self-diagnosis'].includes(S.tab)||state.loading)return;
   if(Date.now()-state.lastRefreshAt<45000)return;
   refresh().catch(err=>console.warn('Institutional background refresh deferred',err));
  },45000);
 }

 const notice=()=>state.error?`<p class="note warn">Records unavailable: ${esc(state.error)}</p>`:!state.loaded?'<p class="meta" role="status">Loading confirmed records…</p>':'';
 const button=(act,text,attrs='')=>`<button type="button" class="btn btn-g" data-inst="${act}" ${attrs}>${text}</button>`;
 const field=(key,title,value='',type='text',attrs='')=>`<label class="field">${title}<input name="${key}" type="${type}" value="${esc(String(value??''))}" ${attrs}></label>`;
 const select=(key,title,values,value)=>`<label class="field">${title}<select name="${key}">${values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label(v))}</option>`).join('')}</select></label>`;
 const text=(key,title,value='')=>`<label class="field inst-wide">${title}<textarea name="${key}" maxlength="12000">${esc(value)}</textarea></label>`;
 function modal(title,body,footer=''){openModal(title,body+(footer?'<div class="actions" style="margin-top:18px">'+footer+'</div>':''));}
 const values=id=>Object.fromEntries(new FormData(document.getElementById(id)));
 function header(title,sub){return `<div class="ph"><div><div class="eb">VICE CAPITAL INC. · Institutional core</div><h1>${title}</h1><p>${sub}</p></div>${button('refresh','Refresh')}</div>${notice()}`;}
 function denied(el){if(!allowed()){clear();el.innerHTML='<div class="emp">CEO or CFO access required.</div>';return true;}load();return false;}
 function omega(el){if(denied(el))return;el.innerHTML=`<div class="inst">${header('OMEGA <em>Engine</em>','Institutional relationships, proposed financing terms and controlled outreach.')}
 <div class="inst-grid inst-metrics"><section class="band"><span class="eb">Proposed baseline APR</span><strong>15%</strong><p class="meta">3.75% quarterly contractual rate</p></section><section class="band"><span class="eb">Net alpha participation</span><strong>65 / 35</strong><p class="meta">Capital provider / VICE</p></section><section class="band"><span class="eb">Strategy objective</span><strong>Up to 5%</strong><p class="meta">Monthly target · not guaranteed</p></section></div>
 <section class="band"><div class="band-head"><h2>Institutional pipeline</h2><span class="meta">${state.leads.length} records</span></div><div class="actions">${button('lead-new','Add executive')}${button('apollo','Search & enrich 10 · Apollo',state.providers?.apollo_configured?'':'disabled title="APOLLO_API_KEY required"')}${field('apollo-page','Provider page',1,'number','id="inst-apollo-page" min="1" max="500"')}</div><p class="meta">${state.providers?.apollo_configured?'Apollo configured. Enrichment may use provider credits. Imports create review drafts; they do not send messages.':'Apollo is awaiting its server API key. Manual records are available now.'}</p><label class="field">Search executives<input type="search" data-inst-search placeholder="Name, company or tier"></label>
 <div class="scroll-x"><table class="pos"><thead><tr><th>Executive / company</th><th>Tier</th><th>Contact</th><th>Stage</th><th>Actions</th></tr></thead><tbody>${state.leads.map(l=>`<tr data-inst-lead><td><b>${esc(l.full_name)}</b><br><span class="meta">${esc(l.company)} · ${esc(l.title)}</span></td><td><span class="bdg gd">${esc(l.tier)}</span></td><td>${esc(l.email||'Awaiting enrichment')}<br><span class="meta">${esc(label(l.email_status))}${l.suppressed?' · SUPPRESSED':''}</span></td><td>${esc(l.stage)}</td><td>${button('lead-edit','Review',`data-id="${l.id}"`)} ${button('draft','Draft outreach',`data-id="${l.id}" ${l.suppressed?'disabled':''}`)}</td></tr>`).join('')||'<tr><td colspan="5">No executive records have been imported.</td></tr>'}</tbody></table></div><p class="meta">A · Corporate treasuries &nbsp; B · Strategic joint ventures &nbsp; C · Family offices / private equity. Imported tiers are initial classifications for review.</p></section>
 <section class="band"><div class="band-head"><h2>Outreach control</h2><span class="meta">${state.drafts.length} records</span></div><p class="meta">${state.providers?.email_configured?'Email provider configured. Queue only after reviewing recipient and offering evidence.':'Email delivery is awaiting a verified sender, API key, reply address and business mailing address.'}</p>${state.drafts.map(d=>`<div class="inst-record"><span><b>${esc(state.leads.find(l=>l.id===d.lead_id)?.full_name||'Executive')}</b><span class="meta">${esc(d.subject)}</span></span><span class="bdg ${d.status==='SENT'?'gr':'gd'}">${d.status==='SENT'?'PROVIDER ACCEPTED':esc(d.status)}</span>${button('draft-view','Review',`data-id="${d.id}"`)}</div>`).join('')||'<p class="meta">No outreach drafts yet.</p>'}</section>
 <section class="band"><div class="band-head"><h2>Financing model</h2><span class="bdg gd">DRAFT TERMS</span></div><p class="meta">Simple contractual APR, costs and prior losses before upside participation. Enter realized or scenario P&amp;L explicitly. This model does not create a note, promise payment or move funds.</p>
 <form id="inst-model" class="inst-grid">${field('principal','Principal · USD',state.model.principal,'number','min="0.01" max="1000000000000" step="0.01" required')}${field('months','Period · months',state.model.months,'number','min="1" max="12" step="1" required')}${field('grossProfit','Gross profit / loss · USD',state.model.grossProfit,'number','step="0.01" required')}${field('costs','Costs · USD',state.model.costs,'number','min="0" step="0.01" required')}${field('lossCarry','Prior loss recovery · USD',state.model.lossCarry,'number','min="0" step="0.01" required')}<label class="field">Partner record<select name="lead_id"><option value="">Select partner to save</option>${state.leads.map(l=>`<option value="${l.id}" ${l.id===state.model.lead_id?'selected':''}>${esc(l.company)} · ${esc(l.full_name)}</option>`).join('')}</select></label>${text('evidence','Agreement, security/collateral, conversion, counsel, eligibility and segregated account references',state.model.evidence)}<div class="inst-wide" id="inst-model-output" aria-live="polite"></div><div class="actions inst-wide">${button('model-save','Save draft financing')}</div></form><p class="meta">Saved drafts: ${state.financings.length}. Capital commitment remains subject to executed documentation and verified eligibility, collateral and custody arrangements.</p></section>
 <section class="band"><div class="band-head"><h2>Execution risk monitor</h2><span class="bdg gd">SCENARIO INPUTS</span></div><form id="inst-risk" class="inst-grid">${field('opening','Month opening equity',100000,'number','min="0.01" step="0.01"')}${field('equity','Current equity',100000,'number','min="0" step="0.01"')}${field('flows','Net deposits less withdrawals',0,'number','step="0.01"')}${field('limit','Monthly stop threshold · %',10,'number','min="10" max="12" step="0.1"')}<div id="inst-risk-output" class="inst-wide" aria-live="polite"></div></form><p class="meta">No broker connection or order execution is activated here. A threshold is a trading control, not a guaranteed loss cap. Native risk-module integration and broker acceptance remain required.</p></section></div>`;calculate();}
 function calculate(){const out=document.getElementById('inst-model-output');if(out){try{state.model=values('inst-model');const r=core.waterfall(state.model);out.innerHTML=`<div class="inst-grid">${[['Baseline due',r.baselineDue],['Eligible net alpha',r.netAlpha],['Partner upside · 65%',r.partnerUpside],['VICE upside · 35%',r.viceUpside],['Total partner due',r.partnerDue],['Baseline funding gap',r.baselineFundingGap]].map(([a,b])=>`<div class="rw"><span>${a}</span><b>${money(b)}</b></div>`).join('')}</div>`;}catch(e){out.textContent=e.message;}}
 const risk=document.getElementById('inst-risk-output');if(risk){try{const v=values('inst-risk'),r=core.drawdown(v.opening,v.equity,v.flows,v.limit);risk.innerHTML=`<span class="bdg ${r.halt?'rd':'gr'}">${r.halt?'HALT NEW EXPOSURE':'BELOW THRESHOLD'}</span> &nbsp; Flow-adjusted drawdown ${r.drawdownPct.toFixed(2)}% · scenario calculation`;}catch(e){risk.textContent=e.message;}}}
 function leadModal(l={}){modal(l.id?'Review institutional executive':'Add institutional executive',`<form id="inst-lead" class="inst-grid">${field('full_name','Full name',l.full_name,'text','required maxlength="200"')}${field('company','Company',l.company,'text','required maxlength="200"')}${field('title','Title',l.title)}${field('email','Corporate email',l.email,'email')}${field('phone','Business phone',l.phone)}${field('hq_address','Company headquarters',l.hq_address)}${field('linkedin','LinkedIn URL',l.linkedin,'url')}${field('asset_tier','Revenue / AUM tier and source',l.asset_tier)}${select('tier','Institutional tier',['A','B','C'],l.tier||'A')}${select('email_status','Email evidence',['UNVERIFIED','REVIEWED'],l.email_status==='UNVERIFIED'?'UNVERIFIED':'REVIEWED')}${select('stage','Stage',['NEW','REVIEW','QUALIFIED','CLOSED'],l.stage||'NEW')}${select('suppressed','Do not contact',['false','true'],String(l.suppressed||false))}${text('contact_basis','Contact permission / relationship basis',l.contact_basis)}${text('offering_basis','Offering route and solicitation eligibility evidence',l.evidence?.offering_basis)}${text('counsel_reference','Counsel review / approved communication reference',l.evidence?.counsel_reference)}${text('investor_verification','Institutional/accredited verification reference',l.evidence?.investor_verification)}<p class="meta inst-wide">Evidence is an executive record, not automatic legal or accreditation certification. Editing cancels unsent drafts so changed contacts cannot receive previously approved messages.</p></form>`,`${button('lead-save','Save executive',`data-id="${l.id||''}"`)}`);}
 function draftModal(d){const l=state.leads.find(l=>l.id===d.lead_id);modal('Outreach review',`<p><b>${esc(l?.full_name)} · ${esc(l?.company)}</b><br>${esc(l?.email||'No verified email')}</p><h3>${esc(d.subject)}</h3><pre class="inst-preview">${esc(d.body)}</pre><p class="meta">${esc(label(d.status))}${d.provider_id?' · Provider receipt '+esc(d.provider_id):''}</p>${d.last_error?`<p class="note warn">${esc(d.last_error)}</p>`:''}`,`${d.status==='DRAFT'?button('queue','Approve & queue',`data-id="${d.id}"`):''}${d.status==='QUEUED'?button('send','Send approved message',`data-id="${d.id}" ${state.providers?.email_configured?'':'disabled title="Email provider setup required"'}`):''}`);}


 function ouvMoney8(n){const v=Number(n);return Number.isFinite(v)?'$'+v.toFixed(8):'UNVERIFIED';}
 function releaseQuotePreview(){
  modal('OUV distribution impact · mathematical model',
   '<p class="note warn">A token distribution does not create underlying economic value. This calculation is an internal scarcity/reference indicator ONLY, not the official OUV or an independently supported fair market valuation.</p>'+
   '<p>Formula: <strong>distribution % = net newly allocated units ÷ 20,000,000 × 100</strong>. Each 100,000 units of VICE plus 100,000 units of V4X adds 1% to the modeled reference from the approved baseline.</p>'+
   '<form id="inst-ouv-model">'+
    field('vice_units','New VICE units',100000,'number','min="0" max="10000000" step="1"')+
    field('v4x_units','New V4X units',100000,'number','min="0" max="10000000" step="1"')+
    '<label class="field">Distribution reserve <select name="pool"><option value="STRATEGIC_POOL">Strategic 2.5M per class</option><option value="ESTATE_RESERVE">Estate 7.5M per class</option></select></label></form>',
    button('ouv-model-compute','Calculate projected OUV'));
 }
 async function releaseQuoteCompute(){
  const f=document.getElementById('inst-ouv-model');
  if(!f?.reportValidity())throw Error('Valid distribution quantities required');
  const v=values('inst-ouv-model');
  const n=x=>Number(x);
  if(![v.vice_units,v.v4x_units].every(x=>/^\d+$/.test(String(x)))||
   !Number.isSafeInteger(n(v.vice_units))||!Number.isSafeInteger(n(v.v4x_units))||
   n(v.vice_units)<0||n(v.v4x_units)<0)throw Error('Enter nonnegative whole numbers');
  if(n(v.vice_units)===0&&n(v.v4x_units)===0)throw Error('Enter at least one unit');
  if(!state.ouvRelease||state.ouvRelease.model_usable!==true||state.ouvRelease.status!=='MODEL_ONLY')throw Error('Release model is paused until ledger reconciliation and baseline verification pass');
  const q=await rpc('vice_ouv_release_quote',{p_vice_units:n(v.vice_units),p_v4x_units:n(v.v4x_units),p_pool:v.pool});
  const pct=Number(q.appreciation_percent||0),a=q.modeled_ouv||{},official=q.official_ouv||{};
  modal('Distribution model · verified SQL arithmetic',
   '<p class="meta">Net additional released units since model baseline: '+esc(String(q.incremental_units))+' of 20,000,000 fixed units.</p>'+
   '<p>Modeled distribution index change: <strong>'+esc(pct.toFixed(8))+'%</strong>.</p>'+
   '<p>Modeled VICE OUV: <strong>'+ouvMoney8(a.VICE)+'</strong> (official: '+ouvMoney8(official.VICE)+')</p>'+
   '<p>Modeled V4X OUV: <strong>'+ouvMoney8(a.V4X)+'</strong> (official: '+ouvMoney8(official.V4X)+')</p>'+
   '<p class="note warn">'+(q.major_governance_required?'MAJOR EVENT: new executive governance approval would be required. ':'')+'This is MODEL ONLY. No holder balances, official OUVs, certificates or financial values were changed.</p>');
 }
 function execRole(){return state.signers.find(x=>x.user_id===S.user?.id)?.role||null;}
 function latestAuthorization(p){return state.authorizations.find(a=>a.id===p.id&&a.payload_hash===p.payload_hash)||null;}
 function execAlreadyAuthorized(p){const a=latestAuthorization(p),role=execRole();return role==='CEO'?!!a?.ceo_signed:role==='CFO'?!!a?.cfo_signed:false;}
 function execAuthorizerLabel(a,role){const ok=role==='CEO'?a?.ceo_signed:a?.cfo_signed;const method=role==='CEO'?a?.ceo_authorization_method:a?.cfo_authorization_method;return ok?'AUTHORIZED · '+(method==='MFA_TOTP'?'2FA AUTHENTICATOR':method==='CRYPTOGRAPHIC'?'DEVICE SIGNATURE':String(method||'VERIFIED')):'AWAITING '+role;}
 function sovereign(el){if(denied(el))return;
  const role=execRole();
  const cards=state.proposals.map(p=>{
   const a=latestAuthorization(p),valid=Array.isArray(p.validation_issues)&&p.validation_issues.length===0&&p.status==='REVIEW';
   const signed=execAlreadyAuthorized(p),signedCount=Number(a?.verified_executive_authorizations??a?.verified_executive_signatures??0);
   const canApprove=valid&&(role==='CEO'||role==='CFO')&&!signed;
   const params=p.payload?.parameters||{},old=params.previous_baseline||{},next=params.target_scaled_tier||{};
   const issueText=Array.isArray(p.validation_issues)&&p.validation_issues.length?p.validation_issues.map(label).join(' · '):'Baseline and ratio valid';
   const currentVice=Number(state.diagnostics?.reference?.vice_price??S.iruClasses[0].ouv);
   const currentV4x=Number(state.diagnostics?.reference?.v4x_price??S.iruClasses[1].ouv);
   const targetVice=Number(next.vice_ouv),targetV4x=Number(next.v4x_ouv);
   const fmtReference=n=>Number.isFinite(n)?n.toFixed(8).replace(/0+$/,'').replace(/\.$/,''):'UNVERIFIED';
   const reviewOpen=!p.validation_until||!Number.isFinite(Date.parse(p.validation_until))||Date.now()<Date.parse(p.validation_until);
   const quorumReady=!!p.quorum_verified_at;
   const timelockReady=!!p.execute_after&&Date.now()>=Date.parse(p.execute_after);
   const executorReady=state.diagnostics?.atomic_executor==='CONFIGURED' && state.diagnostics?.structural_writes_locked===false;
   const proposalApplied=(p.status==='EXECUTED'||p.status==='APPLIED')&&Math.abs(targetVice-currentVice)<1e-8&&Math.abs(targetV4x-currentV4x)<1e-8;
   const blockers=[];
   if(signedCount!==2)blockers.push('Executive approvals '+signedCount+'/2');
   if(reviewOpen)blockers.push('Public review still open');
   if(!quorumReady)blockers.push('Independent on-chain quorum not verified');
   if(!timelockReady)blockers.push('Execution timelock not completed');
   if(!executorReady)blockers.push('Atomic governance executor unavailable');
   const stageLabel=proposalApplied?'EFFECTIVE':signedCount===2?'EXECUTIVE APPROVED — NOT EFFECTIVE':'PENDING EXECUTIVE APPROVAL';
   return `<section class="band"><div class="band-head"><h2>${esc(p.id)}</h2><span class="bdg gd">${esc(p.status)}</span></div>
    <p><strong>${esc(stageLabel)}</strong></p>
    <p class="meta">Active management references: VICE ${esc(fmtReference(currentVice))} · V4X ${esc(fmtReference(currentV4x))} / unit.</p>
    <p>Proposed, NOT effective: VICE ${esc(fmtReference(targetVice))} · V4X ${esc(fmtReference(targetV4x))} / unit.</p>
    <p class="meta">${esc(issueText)} · Public review through ${p.validation_until?esc(new Date(p.validation_until).toLocaleString()):'—'}.</p>
    ${!proposalApplied?'<p class="note warn">Holder holdings and official reference values have NOT been repriced. Remaining gates: '+esc(blockers.join(' · '))+'. Existing IRU unit balances must not be multiplied or replaced.</p>':'<p class="note">Reference revision is recorded as effective; IRU unit balances remain unchanged.</p>'}
    <p class="meta">Executive authorizations: ${signedCount}/2 · CEO: ${esc(execAuthorizerLabel(a,'CEO'))} · CFO: ${esc(execAuthorizerLabel(a,'CFO'))}.</p>
    <p class="meta">On-chain quorum: ${p.quorum_verified_at?'verified':'awaiting configured verifier'} · Execution timelock: ${p.execute_after?esc(p.execute_after):'not started'}.</p>
    <p class="inst-hash">Payload SHA-256: ${esc(p.payload_hash)}</p>
    <details><summary>Submitted payload · claims are independently checked</summary><pre class="inst-preview">${esc(JSON.stringify(p.payload,null,2))}</pre></details>
    <div class="actions">${button('gates','Check execution gates',`data-id="${esc(p.id)}"`)}
    ${canApprove?button('approve-proposal','Authorize proposal with 2FA',`data-id="${esc(p.id)}"`):''}
    ${canApprove?button('approve-device','Sign with verified device key',`data-id="${esc(p.id)}"`):''}
    ${signed?'<span class="bdg gr">YOUR EXECUTIVE APPROVAL IS VERIFIED — NO RE-SIGN REQUIRED</span>':''}
    ${!valid?'<span class="meta">Authorization unavailable: proposal must be in valid REVIEW status.</span>':''}</div></section>`;
  }).join('')||'<section class="band"><p>No structural proposals recorded.</p></section>';
  const ou=state.ouvRelease;
  const modelBand=ou&&ou.model_usable===true&&ou.status==='MODEL_ONLY'?'<section class="band"><div class="band-head"><h2>Fixed-Supply OUV Distribution Model</h2><span class="bdg gd">MODEL ONLY — GOVERNANCE NOT ACTIVATED</span></div>'+
   '<p class="meta">Source: committed strategic issuance and estate reserve distribution records · fixed total of 20,000,000 units · 1:160 reference ratio.</p>'+
   '<p>Net newly distributed since model baseline: <strong>'+esc(String(ou.incremental_units))+' units</strong> · mathematical change <strong>'+esc(String(ou.appreciation_percent))+'%</strong>.</p>'+
   '<p>Modeled VICE: <strong>'+ouvMoney8(ou.modeled_ouv?.VICE)+'</strong> · Modeled V4X: <strong>'+ouvMoney8(ou.modeled_ouv?.V4X)+'</strong></p>'+
   '<p>Official VICE: <strong>'+ouvMoney8(ou.official_ouv?.VICE)+'</strong> · Official V4X: <strong>'+ouvMoney8(ou.official_ouv?.V4X)+'</strong></p>'+
   '<p class="note warn">Automatic OUV issuance policy is a draft. Financial appreciation cannot be inferred from redistribution alone. Official portfolio values do not change until a properly approved, auditable policy and structural executor are active.</p>'+
   '<div class="actions">'+button('ouv-model-quote','Preview 100,000 + 100,000 distribution')+'</div></section>'
   :'<section class="band"><p class="note warn">OUV distribution model paused or unavailable: supply totals or baseline need reconciliation. No automatic official revaluation is active.</p></section>';
  el.innerHTML=`<div class="inst">${header('Sovereign <em>Governance</em>','Executive attestations and equal-authority 2FA approvals with a separate immutable audit trail.')}
   <section class="band"><div class="band-head"><h2>Structural state</h2><span class="bdg gd">WRITES LOCKED</span></div>
    <p>Current references: <b>${money(state.diagnostics?.reference?.vice_price??S.iruClasses[0].ouv)} VICE</b> · <b>${money(state.diagnostics?.reference?.v4x_price??S.iruClasses[1].ouv)} V4X</b> · ratio 1:160.</p>
    <p class="meta">Executive approvals using verified device signatures or fresh authenticator 2FA have equal internal governance authority. Structural execution separately requires verified on-chain quorum, policy checks, and timelock; no automatic price or unit change.</p>
    <div class="actions">${button('proposal-new','Record proposal')}${button('enroll','Enroll a new signing device',role&&state.signers.find(x=>x.user_id===S.user?.id)?.public_key?'disabled title="Key already enrolled; use controlled recovery to replace"':'')}${button('halt','Sign emergency structural halt')}<a class="btn btn-g" href="/governance.html" target="_blank" rel="noopener">Public governance feed ↗</a></div>
    <p class="meta">${state.signers.map(x=>`${esc(x.role)}: ${x.public_key?'key enrolled':'key enrollment pending'}`).join(' · ')||'Designated signers loading'}. ${role?'Signed in as '+esc(role):'Executive authorization requires designated CEO/CFO account'}. 2FA proposal approvals do not depend on browser-stored keys.</p>
   </section>${modelBand}${cards}</div>`;
 }
 function approveWith2FADialog(id){
  const p=state.proposals.find(x=>x.id===id);
  if(!p||p.status!=='REVIEW'||!Array.isArray(p.validation_issues)||p.validation_issues.length)throw Error('Proposal is not eligible for approval');
  if(!['CEO','CFO'].includes(execRole()))throw Error('Only the designated CEO or CFO may authorize a structural proposal');
  if(execAlreadyAuthorized(p))throw Error('Your executive role already authorized this proposal; a second signature is not required');
  modal('Approve exact proposal with authenticator 2FA',
   '<p class="note">Same internal governance approval authority as a registered device key. This creates a verified 2FA authorization record, not a forged device-key signature.</p>'+
   '<p><strong>'+esc(execRole())+' · '+esc(p.id)+'</strong></p>'+
   '<p class="inst-hash">Proposal SHA-256: '+esc(p.payload_hash)+'</p>'+
   '<p class="meta">Enter a fresh 6-digit code from your enrolled authenticator to approve this specific proposal. CEO and CFO approvals are separate and no transfer or structural execution occurs.</p>'+
   '<label class="field">Authenticator code<input id="inst-approval-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code"></label>',
   button('approve-2fa-confirm','Verify 2FA & Approve',`data-id="${esc(id)}"`));
 }
 async function finish2FAApproval(id){
  const code=String(document.getElementById('inst-approval-code')?.value||'').trim();
  if(!/^[0-9]{6}$/.test(code))throw Error('Enter the six-digit authenticator code');
  const p=state.proposals.find(x=>x.id===id);
  if(!p||p.status!=='REVIEW'||execAlreadyAuthorized(p))throw Error('Proposal already authorized or no longer open for approval');
  const started=await rpc('vice_exec_mfa_begin',{p_action:'APPROVE',p_proposal:id,p_recovery:null});
  if(!started?.id||started.payload_hash!==p.payload_hash)throw Error('Server proposal hash changed. Refresh governance before approving.');
  const done=await edge({action:'mfa_authorize',authorization_action:'APPROVE',
    request_id:started.id,proposal_id:id,code});
  if(!done?.verified||done.action!=='APPROVE')throw Error('Authenticator approval was not verified');
  closeModal();
  await refresh();
  try{if(typeof refreshGovernance==='function')await refreshGovernance()}catch(e){console.warn('Governance feed refresh deferred',e)}
  toast('Verified '+execRole()+' 2FA authorization recorded for '+id,'success');
 }
 function diagnosis(el){if(denied(el))return;const d=state.diagnostics;el.innerHTML=`<div class="inst">${header('Self <em>Diagnosis</em>','Measured controls and explicitly identified infrastructure dependencies.')}<section class="band"><div class="band-head"><h2>Database integrity</h2><span class="meta">${d?new Date(d.checked_at).toLocaleString():'Awaiting check'}</span></div>${[['Reference ratio',d?.ratio_ok?'PASS · 1:160':'UNVERIFIED'],['Institutional audit chain',d?.audit_chain_ok?`PASS · ${d.audit_events} events`:'UNVERIFIED'],['Structural mutation gate',d?.structural_writes_locked?'LOCKED':'UNVERIFIED'],['On-chain quorum verifier',d?.onchain_quorum||'UNVERIFIED'],['Atomic scaling executor',d?.atomic_executor||'UNVERIFIED']].map(([a,b])=>`<div class="rw"><span>${a}</span><span class="bdg ${b.startsWith('PASS')?'gr':'gd'}">${esc(label(b))}</span></div>`).join('')}<p class="inst-hash">Audit head: ${esc(d?.audit_head||'No events recorded')}</p></section><section class="band"><div class="band-head"><h2>Runtime and perimeter evidence</h2></div>${[['Environment',d?.air_gap],['OI agent sandbox',d?.agent_runtime],['Model-weight verification',d?.model_weights],['Zero-leakage certification',d?.zero_leakage],['Socket / perimeter scan',d?.perimeter_scan]].map(([a,b])=>`<div class="rw"><span>${a}</span><span class="meta">${esc(label(b||'UNVERIFIED'))}</span></div>`).join('')}<p class="meta">This is a networked Netlify/Supabase application. No air-gapped agent runtime or embedding scrubber is connected. Hash-chain checks show database consistency; independent external anchoring is not yet configured. Refresh runs a new database integrity check.</p></section></div>`;}

 async function deviceKey(create=false){
  const user=S.user?.id;
  if(!user||user==='sim-user')throw Error('Executive sign-in required');
  if(!globalThis.crypto?.subtle||!globalThis.indexedDB)throw Error('Secure browser key storage unavailable. Use verified 2FA for proposal approval.');
  const storedSigner=state.signers.find(x=>x.user_id===user);
  let enrolled=storedSigner?.public_key;
  if(!enrolled){const q=await sb.from('vice_exec_signers').select('public_key').eq('user_id',user).maybeSingle();if(q.error)throw q.error;enrolled=q.data?.public_key||null;}
  const keyTimeout=(promise,label,ms=10000)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error(label+' timed out. Close other VICE OS tabs and retry.')),ms);
   Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},err=>{clearTimeout(timer);reject(err)});
  });
  const dbOpen=(name)=>keyTimeout(new Promise((resolve,reject)=>{
   let settled=false;
   const fail=(reason)=>{if(settled)return;settled=true;reject(reason instanceof Error?reason:Error(String(reason)))};
   const request=indexedDB.open(name,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('keys'))request.result.createObjectStore('keys')};
   request.onblocked=()=>fail(Error('Executive key database upgrade is blocked by another tab. Close other VICE OS tabs and retry.'));
   request.onerror=()=>fail(request.error||Error('Executive key database could not be opened'));
   request.onsuccess=()=>{
    const db=request.result;
    db.onversionchange=()=>{db.close()};
    if(settled){db.close();return}
    settled=true;resolve(db);
   };
  }),'Executive key database open');
  const get=(db,id)=>keyTimeout(new Promise((resolve,reject)=>{
   let tx,request;
   try{tx=db.transaction('keys','readonly');request=tx.objectStore('keys').get(id)}
   catch(err){reject(err);return}
   let value;
   request.onsuccess=()=>{value=request.result};
   request.onerror=()=>reject(request.error||Error('Executive key lookup failed'));
   tx.oncomplete=()=>resolve(value);
   tx.onabort=()=>reject(tx.error||Error('Executive key lookup transaction aborted'));
   tx.onerror=()=>reject(tx.error||Error('Executive key lookup transaction failed'));
  }),'Executive key lookup');
  const put=(db,id,pair,prior)=>keyTimeout(new Promise((resolve,reject)=>{
   let tx;
   try{
    tx=db.transaction('keys','readwrite');
    const store=tx.objectStore('keys');
    if(prior?.privateKey)store.put(prior,'prior:'+user+':'+Date.now());
    store.put(pair,id);
   }catch(err){if(tx)try{tx.abort()}catch{}reject(err);return}
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(tx.error||Error('Executive key write transaction aborted'));
   tx.onerror=()=>reject(tx.error||Error('Executive key write transaction failed'));
  }),'Executive key write');
  const same=async pair=>{if(!pair?.privateKey||!pair?.publicKey||!enrolled)return false;
   const key=await crypto.subtle.exportKey('jwk',pair.publicKey);
   return ['kty','crv','x','y'].every(k=>key[k]===enrolled[k])};
  const db=await dbOpen('vice-executive-keys');
  try{
   const local=await get(db,user);
   if(enrolled&&await same(local))return local;
   if(enrolled){
    // Recovery and proposal signing historically used two DIFFERENT IndexedDB databases.
    // Promote only a local, non-extractable key that matches the currently registered server key.
    const recovery=await dbOpen('vice-executive-signing');
    try{
     for(const name of ['recovery-replacement:'+user,'executive:'+user,'executive']){
      const candidate=await get(recovery,name);
      if(await same(candidate)){
       await put(db,user,candidate,local);
       return candidate;
      }
     }
    }finally{recovery.close()}
    throw Error('The local device key does not match the registered executive key. Choose "Authorize proposal with 2FA" instead. No signature was recorded.');
   }
   if(!create)throw Error('No registered executive key exists; enroll a device or authorize proposals using 2FA.');
   if(local?.privateKey) return local;
   const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
   await put(db,user,pair,null);
   return pair;
  }finally{db.close()}
 }
 async function attest(action,proposal){
  const user=S.user?.id;if(!user)throw Error('Executive authentication required');
  if(action==='APPROVE'){
   const p=state.proposals.find(x=>x.id===proposal);
   if(!p||p.status!=='REVIEW')throw Error('Proposal is not open for approval');
   if(execAlreadyAuthorized(p))throw Error('Executive '+execRole()+' already authorized this proposal. Check the 2FA authorization status; do not sign twice.');
  }
  if(action==='ENROLL'&&state.signers.some(x=>x.user_id===user&&x.public_key))throw Error('Key already enrolled. Use controlled recovery to replace it.');
  const pair=await deviceKey(action==='ENROLL');
  if(user!==S.user?.id)throw Error('Executive account changed');
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const signer=state.signers.find(x=>x.user_id===user);
  const enrolled=signer?.public_key;
  if(action!=='ENROLL'&&(!enrolled||['kty','crv','x','y'].some(k=>enrolled[k]!==jwk[k])))
   throw Error('Registered signing key mismatch. Use the proposal 2FA authorization button; no signature was created.');
  const c=await rpc('vice_exec_challenge',{p_action:action,p_proposal:proposal||null,
   p_public_key:action==='ENROLL'?{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y}:null});
  if(user!==S.user?.id)throw Error('Executive account changed');
  const bytes=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(c.message)));
  const signature=btoa(String.fromCharCode(...bytes));
  const result=await edge({action:'verify_signature',challenge_id:c.id,signature});
  if(!result.verified)throw Error('Executive device signature was not verified');
  return result;
 }
 NAV.find(g=>g.group==='Operations').items.splice(0,0,{id:'omega',label:'OMEGA Engine',icon:'building',perm:'assign'},{id:'sovereign',label:'Sovereign Governance',icon:'shield',perm:'assign'},{id:'self-diagnosis',label:'Self Diagnosis',icon:'activity',perm:'assign'});TABS.push('omega','sovereign','self-diagnosis');VIEWS.omega=omega;VIEWS.sovereign=sovereign;VIEWS['self-diagnosis']=diagnosis;
 // Preserve the direct simplified OUV proposal form in Admin. Sovereign Governance remains a separate approval/review view.
 document.addEventListener('input',e=>{if(e.target.closest('#inst-model,#inst-risk'))calculate();if(e.target.matches('[data-inst-search]')){const q=e.target.value.toLowerCase();document.querySelectorAll('[data-inst-lead]').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));}});
 document.addEventListener('submit',e=>{if(e.target.id?.startsWith('inst-'))e.preventDefault();});
 document.addEventListener('click',e=>{const t=e.target.closest('[data-inst]');if(!t||t.disabled)return;e.preventDefault();if(!allowed()){toast('CEO or CFO access required','error');return;}const act=t.dataset.inst,user=S.user?.id;t.disabled=true;(async()=>{try{
  if(act==='refresh'){await refresh();return;}
  if(act==='lead-new'){leadModal();return;}if(act==='lead-edit'){leadModal(state.leads.find(l=>l.id===t.dataset.id));return;}
  if(act==='lead-save'){const f=document.getElementById('inst-lead');if(!f.reportValidity())return;const v=values('inst-lead'),old=state.leads.find(l=>l.id===t.dataset.id);await rpc('vice_omega_save_lead',{p_id:old?.id||null,p_record:{...v,source:old?.source||'MANUAL',source_id:old?.source_id||null,suppressed:v.suppressed==='true',evidence:{offering_basis:v.offering_basis,counsel_reference:v.counsel_reference,investor_verification:v.investor_verification}}});}
  if(act==='draft'){const l=state.leads.find(l=>l.id===t.dataset.id),d=core.outreach(l);await rpc('vice_omega_draft',{p_lead:l.id,p_subject:d.subject,p_body:d.body,p_campaign:'OMEGA-INTRO-'+new Date(l.updated_at).getTime()});}
  if(act==='draft-view'){draftModal(state.drafts.find(d=>d.id===t.dataset.id));return;}
  if(act==='queue')await rpc('vice_omega_queue',{p_id:t.dataset.id});
  if(act==='send'){const r=await edge({action:'send',id:t.dataset.id});if(r.accepted)toast('Provider accepted the email. Delivery is not yet confirmed.','success');}
  if(act==='apollo'){const r=await edge({action:'import_apollo',page:Number(document.getElementById('inst-apollo-page')?.value||1)});if(user!==S.user?.id)return;toast(`Imported ${r.imported}; errors ${r.failed}. Drafts await review.`,r.failed?'info':'success');}
  if(act==='model-save'){if(!document.getElementById('inst-model').reportValidity())return;const v=values('inst-model');if(!v.lead_id)throw Error('Select a partner record');core.waterfall(v);await rpc('vice_omega_save_financing',{p_id:crypto.randomUUID(),p_record:{...v,evidence:{references:v.evidence}}});}
  if(act==='proposal-new'){modal('Record structural proposal',`<form id="inst-proposal">${text('payload','Complete JSON payload · claimed statuses are independently verified',JSON.stringify({protocol_version:'VICE4X-SOVEREIGN-ELITE-v3.0',proposal_id:'PROP-2026-10-NEW-REVISION',parameters:{previous_baseline:{vice_ouv:state.diagnostics?.reference?.vice_price,v4x_ouv:state.diagnostics?.reference?.v4x_price},target_scaled_tier:{vice_ouv:25,v4x_ouv:4000},structural_ratio:160}},null,2))}</form>`,button('proposal-save','Record & publish for review'));return;}
  if(act==='proposal-save'){const payload=JSON.parse(values('inst-proposal').payload);await rpc('vice_sovereign_submit',{p_payload:payload});}
  if(act==='ouv-model-quote'){releaseQuotePreview();return;}
  if(act==='ouv-model-compute'){await releaseQuoteCompute();return;}
  if(act==='gates'){
    const r=await rpc('vice_ouv_activation_readiness',{p_proposal_id:t.dataset.id});
    if(user!==S.user?.id)return;
    const reasons={
      NOT_IN_ACTIVE_REVIEW:'Proposal is not in active review.',
      PROPOSAL_VALIDATION_ISSUES:'Proposal validation issues must be cleared.',
      CEO_AND_CFO_AUTHORIZATIONS_REQUIRED:'Separate CEO and CFO authorization is required.',
      PUBLIC_REVIEW_WINDOW_OPEN:'Public review must finish before a reference revision can take effect.',
      PROPOSAL_BASELINE_DOES_NOT_MATCH_OFFICIAL_REFERENCE:'Proposal uses an outdated official OUV baseline.',
      PROPOSED_OUV_RATIO_OR_VALUES_INVALID:'Target OUV must be positive and keep the 1:160 ratio.',
      ISSUER_LEDGER_RECONCILIATION_FAILED:'Issuer unit balances must reconcile to their reserve and strategic counters.',
      INDEPENDENT_ONCHAIN_QUORUM_NOT_VERIFIED:'Independent on-chain quorum has not been verified.',
      ONCHAIN_QUORUM_VERIFIER_NOT_CONFIGURED:'Deploy and test an on-chain quorum verifier.',
      '72_HOUR_TIMELOCK_NOT_COMPLETED':'The 72-hour governance execution timelock is not complete.',
      ATOMIC_GOVERNANCE_EXECUTOR_NOT_CONFIGURED:'Build and independently audit the atomic OUV execution service.'
    };
    const blocked=Array.isArray(r.next_unmet_gates)?r.next_unmet_gates:[];
    modal('Official OUV activation status',
      '<p><strong>'+esc(r.proposal_id||t.dataset.id)+'</strong> · '+esc(String(r.executive_authorizations??0))+'/2 executives authorized</p>'+
      '<p class="note warn">NOT EFFECTIVE. Official OUVs, reserve allocations and holders’ unit quantities have not changed.</p>'+
      '<p class="meta">Public review closes: '+esc(r.review_deadline?new Date(r.review_deadline).toLocaleString():'Not available')+'</p>'+
      '<div class="rw"><span class="rw-l">Current official VICE / V4X</span><span class="rw-v">'+ouvMoney8(r.current_official_ouv?.VICE)+' / '+ouvMoney8(r.current_official_ouv?.V4X)+'</span></div>'+
      '<div class="rw"><span class="rw-l">Approved for review only</span><span class="rw-v">'+ouvMoney8(r.proposed_ouv?.VICE)+' / '+ouvMoney8(r.proposed_ouv?.V4X)+'</span></div>'+
      '<p><strong>Remaining gates</strong></p><ul>'+blocked.map(x=>'<li>'+esc(reasons[x]||label(x))+'</li>').join('')+'</ul>'+
      '<p class="meta">Read-only server verification. Viewing status cannot authorize or apply prices.</p>');
    return;
  }
  if(act==='approve-proposal'){approveWith2FADialog(t.dataset.id);return;}
  if(act==='approve-2fa-confirm'){await finish2FAApproval(t.dataset.id);return;}
  if(act==='enroll')await attest('ENROLL');if(act==='approve-device')await attest('APPROVE',t.dataset.id);if(act==='halt')await attest('HALT');
  if(user!==S.user?.id)return;closeModal();await refresh();toast('Confirmed by the institutional service','success');
 }catch(err){if(user===S.user?.id)toast(err.message,'error');}finally{t.disabled=false;}})();});
 return {clear,refresh,calculate};
})();window.ViceInstitutional=ViceInstitutional;
