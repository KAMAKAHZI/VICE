'use strict';
/* VICE4X operations: existing auth, ledger, documents and certificate contracts. */
const Vice4xOperations=(()=>{
 const empty=()=>({owner:null,epoch:0,settings:null,loans:[],students:[],loaded:{},errors:{},busy:{}});
 let state=empty();const pending=new Map();
 function ensureOwner(){if(state.owner!==S.user?.id){const epoch=state.epoch+1;state=empty();state.owner=S.user?.id;state.epoch=epoch;pending.clear();}}
 function clear(){if(S.engine2)S.engine2.running=false;const epoch=state.epoch+1;state=empty();state.epoch=epoch;pending.clear();}
 async function rpc(name,args){if(APP_MODE!=='LIVE'||!S.user||S.user.id==='sim-user')throw Error('Sign in to LIVE to save records');const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
 function fetchPart(kind,force=false){
  ensureOwner();if(state.busy[kind]||(!force&&state.loaded[kind]))return Promise.resolve();
  if(APP_MODE!=='LIVE'||!S.user||S.user.id==='sim-user'){state.loaded[kind]=true;return Promise.resolve();}
  const epoch=state.epoch;state.busy[kind]=true;
  return (async()=>{
   try{
    let data;
    if(kind==='settings'){const r=await sb.from('vice4x_settings').select('*').eq('id',true).single();if(r.error)throw r.error;data=r.data;}
    if(kind==='loans'){const r=await sb.from('vice_lending_records').select('*').order('created_at',{ascending:false}).limit(500);if(r.error)throw r.error;data=r.data||[];}
    if(kind==='bot'){data=await rpc('vice_personal_bot_access',{});if(epoch===state.epoch&&state.owner===S.user?.id)S.engine2.running=data.allowed===true&&data.enabled===true;}
    if(kind==='students')data=await rpc('vice_academy_member_status',{});
    if(epoch!==state.epoch||state.owner!==S.user?.id)return;
    state[kind]=data;state.errors[kind]=null;
   }catch(e){if(epoch===state.epoch)state.errors[kind]=e.message;}
   finally{if(epoch===state.epoch){state.busy[kind]=false;state.loaded[kind]=true;renderMain();}}
  })();
 }
 function load(kind){ensureOwner();if(!state.loaded[kind]&&!state.busy[kind])queueMicrotask(()=>fetchPart(kind));}
 const status=kind=>state.errors[kind]?`<p class="note warn">Unable to load records: ${esc(state.errors[kind])}</p>`:!state.loaded[kind]?'<p class="meta">Loading confirmed records…</p>':'';
 const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 const label=text=>String(text||'').replaceAll('_',' ').toLowerCase().replace(/^./,s=>s.toUpperCase());
 const input=(name,title,type='text',extra='')=>`<label class="field">${esc(title)}<input id="v4x-${name}" name="${name}" type="${type}" required ${extra}></label>`;
 const value=name=>document.getElementById('v4x-'+name)?.value?.trim()||'';
 function docsOptions(){return (S.documents||[]).filter(d=>d.sha256).map(d=>`<option value="${esc(d.id)}">${esc(d.name||d.id)}</option>`).join('');}
 function requestOnce(key,payload,fn){
  const fingerprint=JSON.stringify(payload);let p=pending.get(key);
  if(p?.busy)return p.promise;
  if(!p||p.fingerprint!==fingerprint){p={fingerprint,id:crypto.randomUUID()};pending.set(key,p);}
  p.busy=true;p.promise=Promise.resolve().then(()=>fn(p.id)).then(r=>{pending.delete(key);return r;}).finally(()=>{p.busy=false;});return p.promise;
 }
 async function toggleBot(){
  if(!canExecuteBot())throw Error('VICEBOT personal access is restricted to KAHZI');
  ensureOwner();const owner=S.user.id;
  const r=await requestOnce('personal-bot',{enabled:!S.engine2.running},()=>rpc('vice_set_personal_bot_enabled',{p_enabled:!S.engine2.running}));
  if(owner!==S.user?.id)return;
  if(r?.allowed!==true||r.mode!=='PERSONAL_ANALYSIS')throw Error('VICEBOT authorization not confirmed');
  S.engine2.running=r.enabled===true;state.bot=r;state.loaded.bot=true;
  S.engine2.events.push({t:Date.now(),kind:'ok',msg:'Personal analysis '+(r.enabled?'enabled':'disabled')+'; native MT5 order execution is separate.'});if(r.enabled)await loadCandles();renderMain();
 }
 const systemFields=[
  ['mode','Trading mode',['Auto','Scalp','Intraday','Swing']],['modeLookback','Mode sets lookback','bool'],
  ['structuralLookback','Auto / structural lookback',100,5000],['lbScalp','Scalp lookback',50,5000],['lbIntraday','Intraday lookback',50,5000],['lbSwing','Swing lookback',50,5000],
  ['holdLevels','Hold levels (never tighten)','bool'],['wickProof','Close beyond · wick-proof','bool'],['accCloses','Closes to accept break',1,5],['accATR','Or decisive close beyond (ATR)',0,5,.05],['breakCloses','Any-wick reset closes',1,10],['whipsaw','Any-wick raid extension','bool'],
  ['countTests','Count defended retests','bool'],['dtPullATR','Retest pullback (ATR)',.1,10,.1],['dtMinBars','Bars between retests',1,500],
  ['exhSrc','Zone oscillator',['Stochastic','CCI']],['oscMirror','Oscillator follows structural range','bool'],['exhLen','Manual macro oscillator length',2,5000],['oscIntLen','Manual internal oscillator length',2,5000],['exhSmooth','Oscillator smoothing',1,50],['exhUpper','Macro upper zone',50,100,.5],['exhLower','Macro lower zone',0,50,.5],['intUpper','Internal upper zone',50,100,.5],['intLower','Internal lower zone',0,50,.5],['exhWindow','Zone touch window',0,20],['exhOn','Macro zone exit confirmations','bool'],['zoneArmMacro','Zone exit arms macro side','bool'],
  ['fracDimCloses','Dim fractal closes',1,5],['fracBrightCloses','Confirmed fractal closes',1,5],['engulfCounts','Engulfing confirmation','bool'],['flipConfirmBars','Rejection confirmation closes',1,5],['useVolFilter','Volume confirmation filter','bool'],['volMult','Volume multiple',.1,10,.1],
  ['intArmMode','Internal pivot arms on',['Zone exit or retest held','Zone exit (oscillator)','Retest held (double bottom / top)','Touch + closes (FIX 8)','Any of them']],['intPlace','Move to defended tighter swing','bool'],['sweepRequireClose','Sweep closes back inside','bool'],['mtfEnabled','Flag lower-timeframe confluence','bool'],
  ['chochDetect','Detect CHoCH','bool'],['macroNeckPct','Macro neckline (%)',0,25,.5],['chochNeckPct','Internal neckline (%)',0,25,.5],['intNeckBase','Internal neckline range',['Internal','Macro']],
  ['stopATR','Stop beyond wick (ATR)',.1,20,.1],['minRR','Minimum reward / risk',1,100,.5],['autoBuffer','Solve entry buffer for ratio','bool'],['hideThinRR','Hide insufficient reward / risk','bool'],['extendBars','Right-side chart space (bars)',0,500]
 ];
 try{if(typeof ViceSolaceSystem!=='undefined'){const saved=JSON.parse(localStorage.getItem('vice-system-v106')||'null');if(saved&&typeof saved==='object')S.engine=ViceSolaceSystem.options(saved);}}catch{}
 function systemSettings(){openModal('VICESYSTEM · SOLACE v10.6',`<form id="v4x-system-form"><p class="meta">Settings follow the supplied System v10.6. Levels and signals use completed standard candles. Feed, timeframe, history and settings must match when comparing platforms.</p><div class="fields v4x-fields">${systemFields.map(([k,title,type,max,step])=>`<label class="field">${esc(title)}${Array.isArray(type)?`<select data-system-key="${k}">${type.map(v=>`<option ${S.engine[k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:type==='bool'?`<select data-system-key="${k}" data-system-bool><option value="true" ${S.engine[k]?'selected':''}>On</option><option value="false" ${!S.engine[k]?'selected':''}>Off</option></select>`:`<input data-system-key="${k}" type="number" required min="${type}" max="${max}" step="${step||1}" value="${Number(S.engine[k])}">`}</label>`).join('')}</div><div class="mact"><button type="button" class="btn btn-g" data-act="v4x-system-defaults">System defaults</button><button type="button" class="btn btn-p" data-act="v4x-system-save">Apply settings</button></div></form>`);}
 function reserveSection(){
  if(!isOwner())return '';load('settings');
  const programs=S.estateAdminLedger?.programs;
  const units=p=>programs?.[p]?fmtNum(Number(programs[p].unassigned_units)+Number(S.estateHolderBalances?.[p]||0)):'Awaiting ledger';
  return `<section class="band v4x-reserve"><div class="band-head"><div><div class="eb">Estate Reserve and Administrative Reserve</div><h2>Controlled by KAHZI</h2></div><span class="bdg gd">RESERVE CONTROL</span></div>
   <div class="stats"><div class="st"><span class="l">VICE · retained reserve</span><div class="v gd">${units('VICE')}</div></div><div class="st"><span class="l">V4X · retained reserve</span><div class="v gd">${units('V4X')}</div></div></div>
   <div class="rw"><span class="rw-l">Certificate designation</span><span class="rw-v">${esc(state.settings?.estate_entity||'Choose entity for issuance')}</span></div>
   <p class="meta">Founder / reserve controller. Strategic entry tier and legacy contribution classes apply to strategic-holder allocations separately.</p>
   <div class="actions"><button class="btn btn-gd" data-act="v4x-reserve-certificate">Entity &amp; certificate</button><button class="btn btn-g" data-act="estate-manager">Manage reserve</button></div>${status('settings')}</section>`;
 }
 function reserveModal(){
  openModal('Estate Reserve · Certificate designation',`<p class="meta">Select the single entity to appear as the certificate designee. KAHZI remains the reserve controller. Issuing a new designation supersedes the prior active reserve certificate.</p>
   <label class="field">Certificate entity<select id="v4x-entity"><option value="">Select one entity</option>${['VICE CAPITAL INC','ADKINS ESTATE TRUST'].map(n=>`<option ${n===state.settings?.estate_entity?'selected':''}>${n}</option>`).join('')}</select></label>
   <p class="note">The certificate records the current issuer reserve ledger and entity designation. Supporting organizational documents govern legal title and any authority to pledge.</p>
   <div class="mact"><button class="btn btn-g" data-act="modal-close">Cancel</button><button class="btn btn-p" data-act="v4x-reserve-issue">Issue confirmed reserve certificate</button></div>`);
 }
 function lendingView(el){
  load('loans');const rows=state.loans||[];
  el.innerHTML=`<div class="ph"><div><div class="eb">My Record · Private agreements</div><h1>Lending &amp; <em>Collateral</em></h1><p>Loan terms, pledged units and agreement history in one record.</p></div><div class="ph-acts"><button class="btn btn-g" data-act="v4x-refresh" data-kind="loans">Refresh</button><button class="btn btn-p" data-act="v4x-loan-new">+ Record agreement</button></div></div>
   <section class="band"><div class="band-head"><h2>Recorded commitments</h2><span class="meta">${rows.length} records</span></div>${status('loans')}
   ${rows.length?`<div class="scroll-x"><table class="pos"><thead><tr><th>Lender / reference</th><th>Collateral</th><th>Principal</th><th>Annual rate</th><th>LTV</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.lender_name)}</b><div class="meta">${esc(r.loan_reference)}</div></td><td>${fmtNum(Number(r.units))} ${esc(r.program)}<div class="meta">${esc(label(r.pool))}</div></td><td>${fmtMoney(Number(r.principal),r.currency)}</td><td>${Number(r.annual_rate)}%</td><td>${Number(r.ltv).toFixed(2)}%</td><td><span class="bdg ${r.status==='ACTIVE'?'gr':'gd'}">${esc(label(r.status))}</span></td><td><button class="btn btn-xs btn-g" data-act="v4x-loan-open" data-id="${r.id}">Details</button></td></tr>`).join('')}</tbody></table></div>`:state.loaded.loans?'<p class="emp">No loan agreements recorded yet.</p>':''}
   <p class="note">LTV uses the submitted appraisal, not the platform management reference. Registration reserves the pledged units in this ledger. Lender acceptance, security rights and remedies follow the signed agreement and applicable requirements.</p></section>
   <section class="band"><h2>Agreement lifecycle</h2><div class="v4x-stages"><span>1 · Submit agreement</span><span>2 · Review &amp; activate</span><span>3 · Monitor terms</span><span>4 · Release or review</span></div><p class="meta">Default notices include an evidence record and cure date. Disputes stop progression to enforcement review. Any external enforcement or asset transfer requires a separately authorized process.</p></section>`;
 }
 function loanModal(){
  const docs=docsOptions();openModal('Record lending & collateral agreement',`<form id="v4x-loan-form"><div class="fields v4x-fields">
   ${input('lender_name','Financial institution / lender','text','maxlength="200"')}
   <label class="field">Lender type<select id="v4x-lender_type" required><option value="FINANCIAL_INSTITUTION">Financial institution</option><option value="PRIVATE_LENDER">Private lender</option></select></label>
   ${input('lender_contact','Lender contact / department','text','maxlength="300"')}${input('loan_reference','Loan / agreement reference','text','maxlength="100"')}
   <label class="field">IRU program<select id="v4x-program"><option>VICE</option><option>V4X</option></select></label>
   <label class="field">Holding ledger<select id="v4x-pool"><option value="STRATEGIC">Strategic-holder units</option><option value="ESTATE">Transferred estate units</option></select></label>
   ${input('units','Pledged whole units','number','min="1" max="7500000" step="1"')}${input('currency','Loan / appraisal currency','text','value="USD" pattern="[A-Za-z]{3}" maxlength="3"')}
   ${input('principal','Loan principal','number','min="0.01" step="0.01"')}${input('annual_rate','Contract annual interest rate (%)','number','min="0" max="1000" step="0.0001"')}
   ${input('appraisal_value','Appraised pledged collateral value','number','min="0.01" step="0.01"')}${input('appraiser','Appraiser / valuation source','text','maxlength="200"')}
   ${input('appraisal_date','Appraisal date','date')}${input('maturity_date','Maturity date','date')}
   <label class="field fc">Uploaded agreement<select id="v4x-agreement_document_id" required><option value="">Choose agreement</option>${docs}</select></label>
   <label class="field fc">Payment, default, cure and release terms<textarea id="v4x-terms" required minlength="8" maxlength="5000" rows="3" placeholder="Record the relevant signed agreement clauses and notice/cure requirements."></textarea></label>
   <p class="meta fc" id="v4x-ltv">LTV is calculated from principal ÷ appraised pledged collateral value.</p>
   </div><p class="note">Upload the signed agreement in Documents first. Submitted units remain reserved until cancellation, rejection or documented release. The entry records a submitted agreement; lender approval is confirmed during review.</p>
   <div class="mact"><button type="button" class="btn btn-g" data-act="v4x-documents">Documents</button><button type="button" class="btn btn-p" data-act="v4x-loan-submit" ${docs?'':'disabled'}>Submit for review</button></div></form>`);
 }
 function transitions(r){
  const admin=isRegistryOperator()&&(isOwner()||!S.iru.state?.holders?.[r.holder_id]?.reserveProtected);
  const actions=[];
  if(admin){const map={SUBMITTED:['ACTIVE','REJECTED'],ACTIVE:['DEFAULT_NOTICE','RELEASED'],DEFAULT_NOTICE:['ACTIVE','ENFORCEMENT_REVIEW','RELEASED'],DISPUTED:['ACTIVE','RELEASED'],ENFORCEMENT_REVIEW:['ACTIVE','RELEASED']};actions.push(...(map[r.status]||[]));}
  if(r.owner_id===S.user?.id){if(r.status==='SUBMITTED')actions.push('CANCELLED');if(['ACTIVE','DEFAULT_NOTICE','ENFORCEMENT_REVIEW'].includes(r.status))actions.push('DISPUTED');}
  return [...new Set(actions)];
 }
 async function loanDetail(id){
  const r=state.loans.find(r=>r.id===id);if(!r)throw Error('Refresh loan records first');
  const owner=S.user?.id;const e=await sb.from('vice_lending_events').select('*').eq('record_id',id).order('created_at',{ascending:true});if(e.error)throw e.error;if(owner!==S.user?.id)return;
  const actions=transitions(r);
  openModal('Agreement · '+r.loan_reference,`<div class="stats"><div class="st"><span class="l">Principal</span><div class="v">${fmtMoney(r.principal,r.currency)}</div></div><div class="st"><span class="l">Loan-to-value</span><div class="v gd">${Number(r.ltv).toFixed(2)}%</div></div></div>
   ${[['Lender',r.lender_name],['Annual interest',r.annual_rate+'%'],['Pledged units',fmtNum(r.units)+' '+r.program],['Appraisal',fmtMoney(r.appraisal_value,r.currency)+' · '+r.appraiser],['Maturity',r.maturity_date],['Status',label(r.status)],['Cure deadline',r.cure_until||'—']].map(([k,v])=>`<div class="rw"><span class="rw-l">${esc(k)}</span><span class="rw-v">${esc(v)}</span></div>`).join('')}
   <p class="note" style="white-space:pre-wrap">${esc(r.terms)}</p><p class="meta">Agreement SHA-256: ${esc(r.agreement_sha256)}</p>
   <details><summary>Recorded history · ${(e.data||[]).length}</summary>${(e.data||[]).map(x=>`<div class="rw"><span><b>${esc(label(x.action))}</b><p class="meta">${esc(x.reason)}</p></span><time class="meta">${esc(fmtD(x.created_at))}</time></div>`).join('')}</details>
   ${actions.length?`<div class="fields v4x-fields" style="margin-top:14px"><label class="field">Next status<select id="v4x-next">${actions.map(a=>`<option value="${a}">${esc(label(a))}</option>`).join('')}</select></label><label class="field">Supporting evidence<select id="v4x-evidence"><option value="">Choose document</option>${docsOptions()}</select></label>${input('cure','Cure deadline for default notice','date')}<label class="field fc">Recorded reason<textarea id="v4x-reason" rows="2" minlength="8" maxlength="2000"></textarea></label></div><div class="mact"><button class="btn btn-g" data-act="modal-close">Close</button><button class="btn btn-p" data-act="v4x-loan-advance" data-id="${r.id}">Record status</button></div>`:''}`);
 }
 function academyView(el){
  if(!isRegistryOperator()){el.innerHTML='<p class="note">CFO or reserve administrator access required.</p>';return;}
  load('students');const rows=state.students||[];
  el.innerHTML=`<div class="ph"><div><div class="eb">Member learning · Administrator</div><h1>Learn &amp; Certify <em>Tracker</em></h1><p>Backend-confirmed progress, assessments and awards.</p></div><button class="btn btn-g" data-act="v4x-refresh" data-kind="students">Refresh</button></div>
   <div class="stats"><div class="st"><span class="l">Members</span><div class="v">${rows.length}</div></div><div class="st"><span class="l">Core exams passed</span><div class="v">${rows.filter(r=>Number(r.exams_passed)===7).length}</div></div><div class="st"><span class="l">Active certificates</span><div class="v gd">${rows.filter(r=>r.certificate_id).length}</div></div></div>
   <section class="band">${status('students')}<label class="field">Search member<input data-v4x-learning-search placeholder="Name or client ID"></label><div class="scroll-x"><table class="pos"><thead><tr><th>Member</th><th>Chapters</th><th>Exams</th><th>Certificate</th></tr></thead><tbody>${rows.map(r=>`<tr data-v4x-learner><td><b>${esc(r.name)}</b><div class="meta">${esc(r.client_id||'Profile only')}</div></td><td><progress max="21" value="${Number(r.chapters_completed)}"></progress><div class="meta">${r.chapters_completed}/21</div></td><td><b>${r.exams_passed}/7 passed</b><div class="meta">${Object.entries(r.scores||{}).map(([k,v])=>esc(k)+': '+Number(v)+'%').join(' · ')||'Not yet attempted'}</div></td><td>${r.certificate_id?`<a class="btn btn-xs btn-gd" target="_blank" rel="noopener" href="verify.html?id=${encodeURIComponent(r.certificate_id)}">Issued · Verify</a>`:'Not issued'}</td></tr>`).join('')}</tbody></table></div><p class="note">The core award requires 21 recorded chapters and seven passing server-graded assessments. An exam pass and an issued certificate are shown separately.</p></section>`;
 }
 function servicesModal(){
  openModal('Marketplace & estate planning',`<p class="meta">Provider links open the listed company’s website. Estate Planning opens the Google Calendar appointment schedule owned by vicecapitalinc@gmail.com.</p><div class="fields">${S.marketplace.filter(s=>s.id!=='svc-005').map(s=>`<label class="field fc">${esc(s.name+' · '+s.vendor)}<input id="v4x-url-${s.id}" type="url" value="${esc(state.settings?.marketplace_urls?.[s.id]||'')}" placeholder="https://provider.example/"></label>`).join('')}<label class="field fc">Google Calendar booking page<input id="v4x-booking" type="url" value="${esc(state.settings?.estate_booking_url||'')}" placeholder="https://calendar.google.com/calendar/appointments/schedules/…"></label></div>
   <p class="note">Create an appointment schedule on your Google Calendar, enable availability checks, and set the meeting location to your Zoom link or configured Zoom integration. Paste its public booking link here. Google manages live openings, reservations and calendar confirmations.</p>
   <div class="mact"><a class="btn btn-g" href="https://calendar.google.com/" target="_blank" rel="noopener">Open Google Calendar</a><button class="btn btn-p" data-act="v4x-services-save">Save provider links</button></div>`);
 }
 function marketplaceView(el){
  load('settings');el.innerHTML=`<div class="ph"><div><div class="eb">Member services</div><h1><em>Marketplace</em></h1><p>Open provider services and book estate planning appointments.</p></div>${isOwner()?'<button class="btn btn-g" data-act="v4x-services-settings">Configure services</button>':''}</div><section class="band">${status('settings')}${S.marketplace.map(s=>{const url=s.id==='svc-005'?state.settings?.estate_booking_url:state.settings?.marketplace_urls?.[s.id];return `<div class="row v4x-market-row"><span class="row-l"><b>${esc(s.name)}</b><span class="meta">${esc(s.vendor)} · ${esc(s.description)}</span></span><span class="row-r">${safeUrl(url)?`<button class="btn btn-gd" data-act="v4x-service-open" data-id="${s.id}">${s.id==='svc-005'?'View live openings':'Request ↗'}</button>`:`<button class="btn btn-g" data-act="v4x-service-unavailable" data-id="${s.id}">${s.id==='svc-005'?'Booking setup pending':'Provider link pending'}</button>`}</span></div>`;}).join('')}<p class="note">Provider availability, pricing and terms are confirmed on the provider’s website. A directory listing does not itself confer a provider membership or establish an institutional partnership.</p></section>`;
 }
 function reportedExternalUsd(){return (S.externalAccounts||[]).filter(a=>(a.currency||'USD').toUpperCase()==='USD'&&a.status!=='CLOSED').reduce((sum,a)=>{const n=Number(a.balance);return sum+(Number.isFinite(n)&&n>=0?n:0);},0);}
 function externalSummary(){const reported=reportedExternalUsd(),base=totalAccountPortfolioUsd();const amount=(label,n)=>`<div class="rw v4x-number-card" data-exact="false"><span class="rw-l">${label}</span><span class="rw-v"><span data-money-value="${n}" class="vc-metal-number">${fmtK(n)}</span><button type="button" class="btn btn-xs btn-g" data-money-precision-toggle aria-pressed="false">Show full amount</button></span></div>`;return `<section class="band v4x-reported"><div class="band-head"><h2>External accounts · reported balances</h2><button class="btn btn-g" data-go="external">Manage accounts</button></div>${amount('Reported external USD',reported)}${amount('Combined reference + reported total',base+reported)}<p class="meta">Reported accounts are included in this combined view at the amount entered. Source-verified balances remain separately identified. Other currencies are shown in their original denomination until a verified conversion is available.</p></section>`;}

 function wrapView(name,fn){const before=VIEWS[name];VIEWS[name]=el=>{before(el);fn(el);};}
 NAV.find(g=>g.group==='My Record').items.splice(2,0,{id:'lending',label:'Lending & Collateral',icon:'building',perm:'view'});
 NAV.find(g=>g.group==='Learn').items.push({id:'learning-status',label:'Member Learning Tracker',icon:'users',perm:'assign'});
 // Services and recorded external accounts are useful to members as well as staff.
 NAV.find(g=>g.group==='Accounts').items.find(i=>i.id==='external').perm='view';
 TABS.push('lending','learning-status');VIEWS.lending=lendingView;VIEWS['learning-status']=academyView;VIEWS.marketplace=marketplaceView;
 wrapView('iru',el=>{if(isOwner()){const ph=el.querySelector('.ph');ph?.insertAdjacentHTML('afterend',reserveSection());const c=[...el.querySelectorAll('.band')].find(b=>b.querySelector('h2')?.textContent==='Classification');if(c)c.innerHTML='<div class="band-head"><h2>Founder / Reserve Controller</h2></div><p class="meta">KAHZI administers the Estate Reserve and Administrative Reserve. Holder entry tiers apply separately to documented strategic-pool allocations.</p>';}});
 wrapView('treasury',el=>{if(isOwner())el.querySelector('.ph')?.insertAdjacentHTML('afterend',reserveSection());});
 wrapView('portfolio',el=>{el.querySelector('.v4x-reference-cards')?.insertAdjacentHTML('afterend',externalSummary());});
 wrapView('holders',el=>{if(isRegistryOperator())el.querySelector('.ph-acts')?.insertAdjacentHTML('beforeend','<button class="btn btn-g" data-go="learning-status">Learning tracker</button>');});
 wrapView('external',el=>{const note=el.querySelector('.note');if(note){note.classList.remove('warn');note.textContent='Record external accounts for your combined portfolio view. Manually entered amounts appear as reported balances, with source verification shown separately.';}el.querySelectorAll('.bdg').forEach(b=>{if(b.textContent==='UNVERIFIED')b.textContent='REPORTED';});el.insertAdjacentHTML('beforeend',externalSummary());});

 async function sourceRequest(body){
  const session=await sb.auth.getSession();const token=session.data?.session?.access_token;
  if(!token)throw Error('Sign in again to access the private source release');
  const response=await fetch(SUPABASE_URL+'/functions/v1/vice-trading-source',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){let msg='Private source request failed';try{msg=(await response.json()).error||msg;}catch{}throw Error(msg);}return response;
 }
 function botAnalysis(){
  if(!canExecuteBot())return '<p class="note">VICEBOT personal enablement is currently exclusive to KAHZI.</p>';
  if(!S.engine2.running)return '<p class="note">Enable personal analysis to inspect closed-bar macro and internal plans. This does not enable broker order execution.</p>';
  const r=S.res,l=r?.last;
  return `<section class="band"><div class="band-head"><h2>Personal System analysis</h2><button class="btn btn-g" data-act="v4x-bot-refresh">Refresh analysis</button></div>${l?`<p class="meta">${esc(S.ch.pair)} · ${esc(S.ch.tf)} · ${esc(S.ch.source)} · last completed candle ${esc(new Date(r.time).toISOString())}</p><div class="rw"><span>Macro side</span><b>${r.sellArmed?'SELL at F100':'BUY at F0'}</b></div><div class="rw"><span>F0 / F100</span><span class="mn">${fmtP(l.F0)} / ${fmtP(l.F100)}</span></div><div class="rw"><span>Internal pivot</span><span>${r.pivot?.type===1?'HIGH':'LOW'} · ${r.pivot?.armed?'ARMED':'WATCHING'}</span></div>${['macro','internal'].map(k=>{const t=r.trade?.[k];return t?`<div class="rw"><span>${esc(label(k))} ${t.side}</span><span>Entry ${fmtP(t.entry)} · Stop ${fmtP(t.stop)} · Target ${fmtP(t.target)} · 1:${t.rr.toFixed(2)}</span></div>`:`<p class="meta">No ${k} plan meets the current configured entry and reward/risk conditions.</p>`;}).join('')}`:'<p class="note">Refresh analysis or load an instrument in Markets. Provider failures leave data unavailable.</p>'}<p class="meta">Analysis only. Native MT5 execution remains under your broker and EA controls.</p></section>`;
 }
 wrapView('vicebot',el=>{if(canExecuteBot())load('bot');el.insertAdjacentHTML('beforeend',botAnalysis());el.querySelector('.ph')?.insertAdjacentHTML('afterend',`<section class="band"><div class="band-head"><h2>VICEBOT / VICESYSTEM · Source release</h2><span class="bdg gd">27.60 / 10.6</span></div><p class="meta">Full MT5 Expert Advisor, nine-leg basket engine, basket include and TradingView Pine v6 indicator. Native platform installation and testing are separate from the browser chart engine.</p>${canExecuteBot()?'<button class="btn btn-gd" data-act="v4x-source-list">Open private source vault</button>':'<p class="meta">Proprietary source distribution is controlled by the founder.</p>'}</section>`);});
 const previous=window.__viceAct;
 window.__viceAct=function(t,e){
  const act=t.dataset.act;if(!act?.startsWith('v4x-'))return previous?.(t,e);
  ensureOwner();
  if(act==='v4x-service-open'){
   const service=S.marketplace.find(s=>s.id===t.dataset.id);const url=safeUrl(service?.id==='svc-005'?state.settings?.estate_booking_url:state.settings?.marketplace_urls?.[service?.id]);if(!url){toast('Provider link has not been configured','warn');return;}
   window.open(url,'_blank','noopener,noreferrer');return;
  }
  (async()=>{const owner=S.user?.id;t.disabled=true;try{
   if(act==='v4x-source-list'){
    const data=await (await sourceRequest({action:'list'})).json();if(owner!==S.user?.id)return;
    openModal('Private VICE4X source release',`<p class="meta">Founder-supplied source files. Native compilation and strategy testing have not been executed by the web platform. These downloads do not enable live trading.</p>${data.files.map(f=>`<div class="rw"><span class="rw-l"><b>${esc(f.description)}</b><p class="meta">${esc(f.name)} · ${fmtNum(f.size)} bytes</p><p class="meta" style="overflow-wrap:anywhere">SHA-256 ${esc(f.sha256)}</p></span><button class="btn btn-gd" data-act="v4x-source-download" data-name="${esc(f.name)}">Download</button></div>`).join('')}`);return;
   }
   if(act==='v4x-source-download'){
    const response=await sourceRequest({action:'download',name:t.dataset.name});const bytes=await response.arrayBuffer();
    const expected=response.headers.get('X-Content-SHA256');const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw Error('Source integrity check failed');if(owner!==S.user?.id)return;
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=t.dataset.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Source SHA-256 verified and downloaded','success');return;
   }
   if(act==='v4x-bot-refresh'){if(!canExecuteBot()||!S.engine2.running)throw Error('KAHZI personal analysis must be enabled');await loadCandles();renderMain();return;}
   if(act==='v4x-system-settings'){systemSettings();return;}
   if(act==='v4x-system-defaults'){S.engine={...ViceSolaceSystem.defaults};systemSettings();return;}
   if(act==='v4x-system-save'){
    const form=document.getElementById('v4x-system-form');if(!form.reportValidity())return;
    const cfg={};for(const el of form.querySelectorAll('[data-system-key]'))cfg[el.dataset.systemKey]=el.hasAttribute('data-system-bool')?el.value==='true':el.type==='number'?Number(el.value):el.value;
    S.engine=ViceSolaceSystem.options(cfg);localStorage.setItem('vice-system-v106',JSON.stringify(cfg));closeModal();await loadCandles();toast('System v10.6 settings applied','success');return;
   }
   if(act==='v4x-documents'){closeModal();S.tab='documents';render();return;}
   if(act==='v4x-refresh'){await fetchPart(t.dataset.kind,true);return;}
   if(act==='v4x-loan-new'){loanModal();return;}
   if(act==='v4x-loan-open'){await loanDetail(t.dataset.id);return;}
   if(act==='v4x-reserve-certificate'){reserveModal();return;}
   if(act==='v4x-services-settings'){servicesModal();return;}
   if(act==='v4x-service-unavailable'){if(isOwner()){servicesModal();return;}toast(t.dataset.id==='svc-005'?'The calendar owner must publish the live appointment schedule before bookings can be made.':'The service provider’s verified website is awaiting configuration. Contact support for assistance.','info');return;}
   if(act==='v4x-services-save'){
    const urls={};for(const s of S.marketplace.filter(s=>s.id!=='svc-005')){const u=value('url-'+s.id);if(u){if(!safeUrl(u))throw Error('Use an HTTPS provider website');urls[s.id]=u;}}
    await rpc('vice4x_save_services',{p_urls:urls,p_booking_url:value('booking')||null});if(owner!==S.user?.id)return;closeModal();await fetchPart('settings',true);toast('Service links saved','success');return;
   }
   if(act==='v4x-reserve-issue'){
    const entity=value('entity');if(!entity)throw Error('Select one certificate entity');
    const result=await requestOnce('reserve-certificate',{entity},id=>rpc('vice_issue_reserve_certificate',{p_entity:entity,p_request_id:id}));if(owner!==S.user?.id)return;
    await ViceTokenCertificates.load();await fetchPart('settings',true);const cert=ViceTokenCertificates.find(result.cert_id);if(!cert)throw Error('Certificate was issued; refresh the certificate registry to download it');ViceTokenCertificates.open(cert);return;
   }
   if(act==='v4x-loan-submit'){
    const form=document.getElementById('v4x-loan-form');if(!form.reportValidity())return;
    const data={};for(const k of ['lender_name','lender_type','lender_contact','loan_reference','program','pool','units','currency','principal','annual_rate','appraisal_value','appraiser','appraisal_date','maturity_date','agreement_document_id','terms'])data[k]=value(k);
    await requestOnce('loan-submit',data,id=>rpc('vice_submit_lending_record',{p_record:data,p_request_id:id}));if(owner!==S.user?.id)return;
    closeModal();await fetchPart('loans',true);toast('Agreement submitted; pledged units reserved for review','success');return;
   }
   if(act==='v4x-loan-advance'){
    const data={p_id:t.dataset.id,p_action:value('next'),p_reason:value('reason'),p_evidence:value('evidence')||null,p_cure_until:value('cure')||null};
    await requestOnce('loan-'+data.p_id,data,id=>rpc('vice_advance_lending_record',{...data,p_request_id:id}));if(owner!==S.user?.id)return;
    closeModal();await fetchPart('loans',true);toast('Agreement status recorded','success');return;
   }
  }catch(err){if(owner===S.user?.id)toast(err.message,'error');}finally{t.disabled=false;}})();
 };
 document.addEventListener('input',e=>{
  if(e.target.matches('[data-v4x-learning-search]')){const q=e.target.value.toLowerCase();document.querySelectorAll('[data-v4x-learner]').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(q);});}
  if(['v4x-principal','v4x-appraisal_value'].includes(e.target.id)){const n=Number(value('principal')),d=Number(value('appraisal_value'));const out=document.getElementById('v4x-ltv');if(out)out.textContent=n>0&&d>0?'Calculated loan-to-value: '+(n/d*100).toFixed(2)+'%':'Enter principal and appraised collateral value to calculate LTV.';}
 });
 return {clear,toggleBot,reportedExternalUsd,safeUrl,requestOnce,reserveSection,transitions};
})();
window.Vice4xOperations=Vice4xOperations;
